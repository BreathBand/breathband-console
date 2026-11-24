"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useEffectEvent, useMemo, useReducer, useState } from "react";
import { Icon } from "@/components/Icon";
import { Measured } from "@/components/Measured";
import { Score } from "@/components/Score";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import type { LiveFrame, Presence } from "@/lib/backend";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { formatDay, formatDuration, formatTime, initials } from "@/lib/domain/format";
import {
  describeGroupAverage,
  describePacer,
  formatDepth,
  formatLag,
  liveRead,
  MIN_SAVED_SEC,
  pacerAt,
  pacerValue,
} from "@/lib/domain/group";
import { isTransitionScores } from "@/lib/domain/scores";
import type { GroupSession, PacerHalfCycle, SessionSummary, ShareScope } from "@/lib/domain/types";
import { breathDeviations, waveFrame, type BreathDeviation } from "@/lib/domain/waveform";
import { useLoad } from "@/lib/useLoad";
import { sessionHref } from "../../links";
import { AlignedLanes, MiniRing, MiniTrace, PacerRing, type Lane } from "../LiveCharts";
import "../group.css";

// /cloud/group/live/?id=<groupId> — the host's screen for one group session:
// the lobby, the live room, and the results once it ends.
export default function GroupLivePage() {
  return (
    <Suspense fallback={null}>
      <GroupLiveRoute />
    </Suspense>
  );
}

function GroupLiveRoute() {
  const id = useSearchParams().get("id");
  const auth = useAuth();
  if (auth.status !== "signed-in") return null;
  if (!id) {
    return (
      <div className="container">
        <EmptyState title="This link is missing a group session" level={1}>
          <Link href="/cloud/group/">Back to group sessions</Link>
        </EmptyState>
      </div>
    );
  }
  return <GroupLive key={id} id={id} viewerId={auth.user.uid} />;
}

interface Person {
  name: string;
  scope: ShareScope;
}

// ---------------------------------------------------------------- live buffer

/** The last 40 seconds of every athlete's breathing, on the frames' shared clock. */
interface Buffer {
  t: number[];
  s: Record<string, (number | null)[]>;
}

const KEEP_SEC = 40;
const EMPTY: Buffer = { t: [], s: {} };

function addFrame(b: Buffer, f: LiveFrame): Buffer {
  const last = b.t[b.t.length - 1];
  if (last !== undefined && f.t <= last) return b;
  const cut = b.t.length && b.t[0] < f.t - KEEP_SEC ? b.t.findIndex((x) => x >= f.t - KEEP_SEC) : 0;
  const s: Buffer["s"] = {};
  for (const [id, v] of Object.entries(f.samples)) {
    s[id] = [...(b.s[id] ?? new Array(b.t.length).fill(null)).slice(cut), v];
  }
  return { t: [...b.t.slice(cut), f.t], s };
}

/** The most recent finished breath for one athlete, measured against the pacer. */
function lastBreath(b: Buffer, id: string, g: GroupSession): BreathDeviation | undefined {
  const values = b.s[id];
  if (!values) return undefined;
  const lastGap = values.lastIndexOf(null);
  const from = Math.max(lastGap + 1, values.length - 300);
  const user = values.slice(from) as number[];
  if (user.length < 40) return undefined;
  const times = b.t.slice(from);
  const pacer = times.map((t) => pacerValue(g, t));
  const hz = 10;
  const breaths = breathDeviations(
    { sampleIntervalMs: 100, user, pacer, markers: [], calibration: { min: -1, max: 1 } },
    { hz, duration: user.length / hz, midline: 0, range: 1.35 },
  );
  // Leave out a breath whose exhale might still be going.
  const settled = user.length / hz - pacerAt(g, times[times.length - 1]) / 2;
  return breaths.filter((x) => x.tTrough < settled).at(-1);
}

// ---------------------------------------------------------------- page

function GroupLive({ id, viewerId }: { id: string; viewerId: string }) {
  const backend = useBackend();
  const loaded = useLoad(`group:${id}`, () => backend.data.getGroupSession(id));
  const people = useLoad(`group-people:${viewerId}`, async () => {
    const list = await backend.data.listAthletes(viewerId);
    const links = await Promise.all(list.map((a) => backend.data.getCoachLink(viewerId, a.uid)));
    return new Map<string, Person>(list.map((a, i) => [a.uid, { name: a.displayName, scope: links[i]?.scope ?? "scores" }]));
  });
  const [local, setLocal] = useState<GroupSession | null>(null);
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [buffer, dispatch] = useReducer(addFrame, EMPTY);
  const [busy, setBusy] = useState<"" | "start" | "pacer" | "marker" | "end" | "cancel">("");
  const [error, setError] = useState("");

  const g = local ?? (loaded.status === "ready" ? loaded.data : null);
  const status = g?.status;
  const isHost = g?.hostId === viewerId;

  async function act(kind: typeof busy, run: () => Promise<GroupSession | void>) {
    setBusy(kind);
    setError("");
    try {
      const next = await run();
      if (next) setLocal(next);
    } catch {
      setError("That didn't go through. Try again.");
    } finally {
      setBusy("");
    }
  }

  const finish = () => act("end", () => backend.data.endGroupSession(id));
  const onPlannedEnd = useEffectEvent(() => {
    if (busy !== "end") finish();
  });

  useEffect(() => {
    if (!isHost || (status !== "lobby" && status !== "live")) return;
    let ended = false;
    return backend.data.watchGroupLive(id, {
      onPresence: setPresence,
      onFrame: (frame) => {
        dispatch(frame);
        if (!ended && status === "live" && g && frame.t >= g.durationSec - 0.05) {
          ended = true;
          onPlannedEnd();
        }
      },
    });
    // `g` only matters for its planned length, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, id, status, isHost]);

  if (loaded.status === "loading" || people.status === "loading") {
    return (
      <div className="container review">
        <Skeleton lines={6} label="Loading the group session…" />
      </div>
    );
  }
  if (loaded.status === "error") {
    return (
      <div className="container review">
        <ErrorState error={loaded.error} what="the group session" onRetry={loaded.retry} />
      </div>
    );
  }
  if (!g) {
    return (
      <div className="container review">
        <EmptyState title="This group session doesn't exist">
          <Link href="/cloud/group/">Back to group sessions</Link>
        </EmptyState>
      </div>
    );
  }
  if (!isHost) {
    return (
      <div className="container review narrow">
        <EmptyState title={g.title}>
          <p className="muted">
            Hosted by {g.hostName}. Athletes join group sessions from the Breathband app.{" "}
            {g.results[viewerId] && <Link href={sessionHref(viewerId, g.results[viewerId])}>See your session</Link>}
          </p>
        </EmptyState>
      </div>
    );
  }

  const names = people.status === "ready" ? people.data : new Map<string, Person>();
  const person = (uid: string): Person => names.get(uid) ?? { name: "Athlete", scope: "scores" };

  return (
    <div className="container review group-room" data-status={g.status}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/cloud/group/" className="link">
          <Icon name="chevronLeft" size={18} />
          Group sessions
        </Link>
      </nav>
      <div className="title-row">
        <h1>{g.title}</h1>
        {g.status === "live" && (
          <span className="live-badge">
            <i aria-hidden="true" /> Live
          </span>
        )}
        <span>
          {formatDay(g.createdAt)} · {describePacer(g)} · {formatDuration(g.durationSec)} planned · {g.athleteIds.length} athletes
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {g.status === "lobby" && (
        <Lobby
          g={g}
          presence={presence}
          person={person}
          busy={busy}
          onStart={() => act("start", () => backend.data.startGroupSession(id))}
          onCancel={() => act("cancel", async () => {
            await backend.data.cancelGroupSession(id);
            return { ...g, status: "cancelled" };
          })}
        />
      )}
      {g.status === "live" && (
        <LiveRoom
          g={g}
          presence={presence}
          buffer={buffer}
          person={person}
          busy={busy}
          onPacer={(h) => act("pacer", () => backend.data.setGroupPacer(id, h))}
          onMarker={() => act("marker", () => backend.data.addGroupMarker(id))}
          onEnd={finish}
        />
      )}
      {g.status === "ended" && <Results g={g} person={person} />}
      {g.status === "cancelled" && (
        <EmptyState title="This group session was cancelled">
          <Link className="button" href="/cloud/group/">
            Start another
          </Link>
        </EmptyState>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- lobby

const PRESENCE_TEXT: Record<Presence, string> = {
  invited: "Waiting to join…",
  joined: "Joined",
  reconnecting: "Reconnecting…",
  left: "Left",
};

function Lobby({
  g,
  presence,
  person,
  busy,
  onStart,
  onCancel,
}: {
  g: GroupSession;
  presence: Record<string, Presence>;
  person: (uid: string) => Person;
  busy: string;
  onStart: () => void;
  onCancel: () => void;
}) {
  const joined = g.athleteIds.filter((a) => presence[a] === "joined").length;
  return (
    <div className="lobby">
      <section className="pane pane-pad" aria-labelledby="lobby-h">
        <div className="pane-h">
          <h2 id="lobby-h">Lobby</h2>
          <span className="meta" aria-live="polite">
            {joined} of {g.athleteIds.length} joined
          </span>
        </div>
        <p className="muted small-text">
          Everyone you invited has a notification in the Breathband app. They put on their band, tap <b>Join</b>, and wait here
          until you start.
        </p>
        <ul className="lobby-list">
          {g.athleteIds.map((a) => {
            const p = presence[a] ?? "invited";
            return (
              <li key={a} data-presence={p}>
                <span className="avatar" aria-hidden="true">
                  {initials(person(a).name)}
                </span>
                <span className="people-name">
                  {person(a).name}
                  <small>{person(a).scope === "curves" ? "Live curve shown" : "Shares scores only"}</small>
                </span>
                <span className="presence" data-presence={p}>
                  {p === "joined" ? <Icon name="check" size={16} /> : <i className="pulse" aria-hidden="true" />}
                  {PRESENCE_TEXT[p]}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="row">
          <button type="button" className="button" disabled={joined === 0 || busy !== ""} onClick={onStart}>
            <Icon name="play" size={18} />
            {busy === "start" ? "Starting…" : joined === g.athleteIds.length ? "Start the session" : `Start with ${joined}`}
          </button>
          <button type="button" className="button" data-variant="ghost" disabled={busy !== ""} onClick={onCancel}>
            Cancel
          </button>
          {joined < g.athleteIds.length && joined > 0 && (
            <span className="label">Anyone who joins late comes in on the running pacer.</span>
          )}
        </div>
      </section>
      <section className="pane pane-pad lobby-pacer" aria-label="Pacer preview">
        <PacerRing plan={g} t={0} size={180} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- live room

function LiveRoom({
  g,
  presence,
  buffer,
  person,
  busy,
  onPacer,
  onMarker,
  onEnd,
}: {
  g: GroupSession;
  presence: Record<string, Presence>;
  buffer: Buffer;
  person: (uid: string) => Person;
  busy: string;
  onPacer: (h: PacerHalfCycle) => void;
  onMarker: () => void;
  onEnd: () => void;
}) {
  const [view, setView] = useState<"grid" | "aligned">("grid");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const t = buffer.t[buffer.t.length - 1] ?? 0;
  const half = pacerAt(g, t);
  const joined = g.athleteIds.filter((a) => presence[a] === "joined" || presence[a] === "reconnecting").length;

  return (
    <>
      <section className="pane control-bar" aria-label="Session controls">
        <div className="clock">
          <span className="label">Elapsed</span>
          <b>{formatDuration(t)}</b>
        </div>
        <div className="timeline" aria-hidden="true">
          <span className="timeline-fill" style={{ width: `${Math.min(100, (t / g.durationSec) * 100)}%` }} />
          {g.markers.map((m) => (
            <i key={`m${m}`} className="tick-marker" style={{ left: `${(m / g.durationSec) * 100}%` }} />
          ))}
          {g.pacerChanges.map((c) => (
            <i key={`p${c.atSec}`} className="tick-pacer" style={{ left: `${(c.atSec / g.durationSec) * 100}%` }} />
          ))}
        </div>
        <div className="clock">
          <span className="label">Remaining</span>
          <b>{formatDuration(Math.max(0, g.durationSec - t))}</b>
        </div>
        <div className="seg" role="group" aria-label="Pacer for everyone">
          {([5, 2] as const).map((h) => (
            <button key={h} type="button" aria-pressed={half === h} disabled={busy !== ""} onClick={() => onPacer(h)}>
              {h}-{h}
            </button>
          ))}
        </div>
        <button type="button" className="button" data-variant="ghost" data-size="small" disabled={busy !== ""} onClick={onMarker}>
          <Icon name="marker" size={16} />
          Marker
        </button>
        {confirmEnd ? (
          <span className="row">
            <button type="button" className="button" data-variant="danger" data-size="small" disabled={busy !== ""} onClick={onEnd}>
              {busy === "end" ? "Ending…" : "End for everyone"}
            </button>
            <button type="button" className="button" data-variant="ghost" data-size="small" onClick={() => setConfirmEnd(false)}>
              Keep going
            </button>
          </span>
        ) : (
          <button type="button" className="button" data-size="small" disabled={busy !== ""} onClick={() => setConfirmEnd(true)}>
            <Icon name="stop" size={16} />
            End session
          </button>
        )}
      </section>

      <div className="room">
        <section className="pane pane-pad room-pacer" aria-label="Pacer everyone follows">
          <PacerRing plan={g} t={t} />
          <p className="label">
            {joined} of {g.athleteIds.length} breathing · {g.markers.length} {g.markers.length === 1 ? "marker" : "markers"}
          </p>
          <div className="legend">
            <span>
              <i className="sw-line" data-dir="in" /> Inhale, above
            </span>
            <span>
              <i className="sw-line" data-dir="out" /> Exhale, below
            </span>
            <span>
              <i className="sw-pacer" /> Pacer
            </span>
          </div>
        </section>

        <section className="pane pane-pad room-main" aria-label="Athletes">
          <div className="pane-h">
            <h2>{view === "grid" ? "Everyone, live" : "Lined up in time · last 30 s"}</h2>
            <div className="seg" role="group" aria-label="View">
              <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}>
                Grid
              </button>
              <button type="button" aria-pressed={view === "aligned"} onClick={() => setView("aligned")}>
                Aligned
              </button>
            </div>
          </div>
          {view === "grid" ? (
            <ul className="athlete-grid">
              {g.athleteIds.map((a) => (
                <AthleteCard key={a} id={a} g={g} p={presence[a] ?? "invited"} person={person(a)} buffer={buffer} t={t} />
              ))}
            </ul>
          ) : (
            <>
              <p className="label">
                Each athlete&apos;s breathing on one shared clock, against the same pacer, so you can compare them breath by breath.
              </p>
              <Measured height={g.athleteIds.length * 64 + 30}>
                {(width) => (
                  <AlignedLanes
                    width={width}
                    plan={g}
                    markers={g.markers}
                    t0={t - 30}
                    t1={t}
                    now={t}
                    lanes={g.athleteIds.map((a) => liveLane(a, person(a), presence[a] ?? "invited", buffer))}
                  />
                )}
              </Measured>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function liveLane(id: string, person: Person, p: Presence, buffer: Buffer): Lane {
  const first = person.name.split(" ")[0];
  return {
    id,
    label: first,
    t: buffer.t,
    v: buffer.s[id] ?? [],
    placeholder:
      person.scope !== "curves"
        ? "Curve private · shares scores only"
        : p === "invited"
          ? "Waiting to join…"
          : undefined,
    dim: p === "reconnecting",
  };
}

function AthleteCard({
  id,
  g,
  p,
  person,
  buffer,
  t,
}: {
  id: string;
  g: GroupSession;
  p: Presence;
  person: Person;
  buffer: Buffer;
  t: number;
}) {
  const values = buffer.s[id] ?? [];
  const latest = values[values.length - 1] ?? null;
  const hidden = person.scope !== "curves";
  const breath = useMemo(() => (hidden ? undefined : lastBreath(buffer, id, g)), [hidden, buffer, id, g]);
  const read = liveRead(breath, pacerAt(g, t));

  return (
    <li className="athlete-card" data-presence={p} data-state={hidden || p !== "joined" ? undefined : read.state}>
      <div className="card-h">
        <span className="avatar" aria-hidden="true">
          {initials(person.name)}
        </span>
        <b>{person.name}</b>
        <span className="presence" data-presence={p}>
          {p === "joined" ? (hidden ? "Joined" : read.text) : PRESENCE_TEXT[p]}
        </span>
      </div>
      {hidden ? (
        <p className="card-private">
          <Icon name="lock" size={16} /> Shares scores only, so the live curve stays private. Their score arrives when the session
          ends.
        </p>
      ) : p === "invited" ? (
        <p className="card-private">Hasn&apos;t joined yet. They come in on the running pacer when they do.</p>
      ) : (
        <>
          <div className="card-body">
            <MiniRing value={p === "joined" ? latest : null} pacer={pacerValue(g, t)} />
            <dl className="card-stats">
              <dt>Timing in · out</dt>
              <dd>{breath ? `${formatLag(breath.inLag)} · ${formatLag(breath.outLag)}` : "–"}</dd>
              <dt>Depth in · out</dt>
              <dd>{breath ? `${formatDepth(breath.inDepth)} · ${formatDepth(breath.outDepth)}` : "–"}</dd>
            </dl>
          </div>
          <Measured height={84}>{(width) => <MiniTrace t={buffer.t} v={values} plan={g} t1={t} width={width} />}</Measured>
        </>
      )}
    </li>
  );
}

// ---------------------------------------------------------------- results

function Results({ g, person }: { g: GroupSession; person: (uid: string) => Person }) {
  const backend = useBackend();
  const sessions = useLoad(`group-results:${g.id}`, async () => {
    const entries = Object.entries(g.results);
    const found = await Promise.all(entries.map(([athleteId, sid]) => backend.data.getSession(athleteId, sid)));
    return found.filter((s): s is SessionSummary => s !== null);
  });
  const length = g.startedAt && g.endedAt ? (Date.parse(g.endedAt) - Date.parse(g.startedAt)) / 1000 : 0;
  const took = Object.keys(g.results).length;

  return (
    <>
      <div className="stats">
        <section className="pane hero" aria-label="Group average">
          <span className="lbl">Group average</span>
          <span className="n">{describeGroupAverage(g.groupAverage)}</span>
          <span className="d">Total Breath Score of everyone who took part</span>
        </section>
        <section className="pane stat">
          <span className="lbl">Took part</span>
          <span className="n">
            {took}
            <small> of {g.athleteIds.length}</small>
          </span>
          <span className="d">athletes</span>
        </section>
        <section className="pane stat">
          <span className="lbl">Length</span>
          <span className="n sm">{formatDuration(length)}</span>
          <span className="d">
            of {formatDuration(g.durationSec)} planned · {g.startedAt && formatTime(g.startedAt)}
          </span>
        </section>
        <section className="pane stat">
          <span className="lbl">Pacer</span>
          <span className="n sm">{describePacer(g)}</span>
          <span className="d">
            {g.markers.length} {g.markers.length === 1 ? "marker" : "markers"}
          </span>
        </section>
      </div>

      {took === 0 && (
        <EmptyState title="Nothing was saved">
          <p className="muted">Sessions shorter than {MIN_SAVED_SEC} seconds aren&apos;t saved, the same as in the app.</p>
        </EmptyState>
      )}

      <section className="pane pane-pad" aria-labelledby="results-h">
        <div className="pane-h">
          <h2 id="results-h">Each athlete</h2>
          <span className="meta">Saved to their history as a paced session</span>
        </div>
        {sessions.status === "loading" ? (
          <Skeleton lines={3} />
        ) : sessions.status === "error" ? (
          <ErrorState error={sessions.error} what="the results" onRetry={sessions.retry} />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Athlete</th>
                  <th className="num">Total Breath Score</th>
                  <th className="num">Timing in · out</th>
                  <th className="num">Depth in · out</th>
                  <th className="num">Time in</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {g.athleteIds.map((a) => {
                  const s = sessions.data.find((x) => x.athleteId === a);
                  const sc = s && isTransitionScores(s.scores) ? s.scores : null;
                  return (
                    <tr key={a}>
                      <td>{person(a).name}</td>
                      <td className="num">{sc ? <Score value={sc.total} /> : <span className="muted">–</span>}</td>
                      <td className="num">{sc ? `${sc.timing.inhale} · ${sc.timing.exhale}` : "–"}</td>
                      <td className="num">{sc ? `${sc.depth.inhale} · ${sc.depth.exhale}` : "–"}</td>
                      <td className="num sub">{s ? formatDuration(s.durationSec) : "Didn't join"}</td>
                      <td>
                        {s && (
                          <Link className="link small" href={sessionHref(a, s.id)}>
                            Open review
                            <Icon name="chevronRight" size={16} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {sessions.status === "ready" && sessions.data.length > 0 && <Replay g={g} sessions={sessions.data} person={person} />}
    </>
  );
}

/** The whole session afterwards, lined up in time, with a window the coach can move. */
function Replay({ g, sessions, person }: { g: GroupSession; sessions: SessionSummary[]; person: (uid: string) => Person }) {
  const backend = useBackend();
  const shown = g.athleteIds.filter((a) => sessions.some((s) => s.athleteId === a));
  const curves = useLoad(`group-replay:${g.id}`, async () => {
    const out: Lane[] = [];
    for (const a of shown) {
      const s = sessions.find((x) => x.athleteId === a)!;
      if (person(a).scope !== "curves") {
        out.push({ id: a, label: person(a).name.split(" ")[0], t: [], v: [], placeholder: "Curve private · shares scores only" });
        continue;
      }
      const w = await backend.data.getWaveform(s);
      const frame = waveFrame(w);
      const amp = Math.max(...(w.pacer ?? w.user).map((v) => Math.abs(v - frame.midline))) || 1;
      const offset = (Date.parse(s.startedAt) - Date.parse(g.startedAt!)) / 1000;
      out.push({
        id: a,
        label: person(a).name.split(" ")[0],
        t: w.user.map((_, i) => offset + i / frame.hz),
        v: w.user.map((v) => (v - frame.midline) / amp),
      });
    }
    return out;
  });
  const end = Math.max(...sessions.map((s) => (Date.parse(s.startedAt) - Date.parse(g.startedAt!)) / 1000 + s.durationSec));
  const [span, setSpan] = useState(30);
  const [from, setFrom] = useState(0);
  const width = Math.min(span, end);
  const t0 = Math.max(0, Math.min(from, end - width));

  return (
    <section className="pane pane-pad" aria-labelledby="replay-h">
      <div className="pane-h">
        <h2 id="replay-h">
          Lined up in time · {formatDuration(t0)}–{formatDuration(t0 + width)}
        </h2>
        <div className="seg" role="group" aria-label="Window">
          {[30, 60, Infinity].map((s) => (
            <button key={s} type="button" aria-pressed={span === s} onClick={() => setSpan(s)}>
              {s === Infinity ? "Full" : `${s} s`}
            </button>
          ))}
        </div>
      </div>
      {curves.status === "loading" ? (
        <Skeleton lines={3} />
      ) : curves.status === "error" ? (
        <ErrorState error={curves.error} what="the curves" onRetry={curves.retry} />
      ) : (
        <>
          <Measured height={curves.data.length * 64 + 30}>
            {(w) => <AlignedLanes width={w} plan={g} markers={g.markers} t0={t0} t1={t0 + width} lanes={curves.data} />}
          </Measured>
          {width < end && (
            <label className="field replay-range">
              <span className="sr-only">Move the window</span>
              <input type="range" min={0} max={Math.floor(end - width)} step={1} value={Math.floor(t0)} onChange={(e) => setFrom(Number(e.target.value))} />
            </label>
          )}
        </>
      )}
    </section>
  );
}
