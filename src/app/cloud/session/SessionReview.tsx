"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Measured } from "@/components/Measured";
import { Progress } from "@/components/Progress";
import { Arrow, Dot, ScaleStrip, TransitionTable } from "@/components/Score";
import { ErrorState, Skeleton } from "@/components/States";
import { BackendError } from "@/lib/backend";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { assignmentProgress, countsToward, describeAssignment, timeAgo } from "@/lib/domain/coaching";
import { describeMode, formatDay, formatDuration, formatLongDay, formatTime, initials } from "@/lib/domain/format";
import { dailyMinutesOf, ringOf } from "@/lib/domain/habit";
import { formatScore, isLegacyScores, isTransitionScores, legacyBand, scoreWord } from "@/lib/domain/scores";
import type { BreathGoal, SessionComment, SessionSummary, UserProfile } from "@/lib/domain/types";
import { breathDeviations, waveFrame } from "@/lib/domain/waveform";
import { analyzePacedRecording } from "@/lib/analysis/session";
import { SCORING_VERSIONS } from "@/lib/domain/types";
import { MethodCScores, OpenScores, TurnTable, turnsAsBreaths } from "./MethodC";
import { useLoad, type Loaded } from "@/lib/useLoad";
import type { ConsoleContext } from "../AthleteConsole";
import { streakDays } from "../AthleteHome";
import { commentAuthorWord, minutesLeftToday, professionalFrom, yourProfessionals, type Professional } from "../home/tailor";
import { coaching, onTargetShare, rateChange, resultsEmphasis, type ResultsEmphasis, type TurnPoints } from "../results/tone";
import { BreathTable, DeviationStrip, SessionScrubber, WaveChart } from "./Waveform";

const ZOOMS = [
  { label: "5 s", sec: 5 },
  { label: "10 s", sec: 10 },
  { label: "30 s", sec: 30 },
  { label: "60 s", sec: 60 },
  { label: "5 min", sec: 300 },
  { label: "Full", sec: Infinity },
];

/** The review screen: scores, the waveform against the pacer, breath-by-breath detail and the note. */
export function SessionReview({ session, ctx }: { session: SessionSummary; ctx: ConsoleContext }) {
  const backend = useBackend();
  const auth = useAuth();
  const viewerId = auth.status === "signed-in" ? auth.user.uid : "";
  const waveform = useLoad(`waveform:${session.athleteId}/${session.id}`, () => backend.data.getWaveform(session));
  const comments = useLoad(`comments:${session.athleteId}/${session.id}`, () =>
    backend.data.listComments(session.athleteId, session.id),
  );
  const curvesPrivate =
    !ctx.self && waveform.status === "error" && waveform.error instanceof BackendError && waveform.error.code === "permission-denied";

  // Opening a review is what takes a session off the coach's "To review" list.
  useEffect(() => {
    if (!ctx.self && viewerId) backend.data.markSessionSeen(viewerId, session.athleteId, session.id).catch(() => {});
  }, [backend, ctx.self, viewerId, session.athleteId, session.id]);
  const signal = waveform.status === "ready" ? waveform.data : null;
  const methodC = session.scoringVersion === SCORING_VERSIONS.methodC;
  const analysis = useMemo(() => {
    if (!signal) return null;
    const frame = waveFrame(signal);
    if (methodC && signal.pacer && signal.units === "pct-max" && session.pacerHalfCycleSec) {
      try {
        const turns = analyzePacedRecording(signal.user, frame.hz, {
          halfCycleS: session.pacerHalfCycleSec,
          skillLevel: session.skillLevel ?? "intermediate",
        });
        return { frame, breaths: turnsAsBreaths(turns), turns };
      } catch {
        // A signal the analysis can't read still shows; it just has no per-turn detail.
      }
    }
    return { frame, breaths: breathDeviations(signal, frame), turns: null };
  }, [signal, methodC, session.pacerHalfCycleSec, session.skillLevel]);

  // The person's own review follows their goal (results/tone.ts); a coach sees every number and no coaching line.
  const prefs = ctx.self && auth.status === "signed-in" ? auth.profile?.preferences : null;
  const goal = prefs?.goal ?? null;
  const emphasis = resultsEmphasis(goal);
  // The person's own professionals, to name them as Home does: the coaching line and who reads the comments.
  const linked = useLoad(ctx.self ? `coaches:${session.athleteId}` : null, () => backend.data.listCoaches(session.athleteId));
  const professionals = linked.status === "ready" ? linked.data : [];
  const named = professionals.map(professionalFrom).filter((p): p is Professional => p !== null);
  const audience = yourProfessionals(goal, named);
  const rates = useMemo(
    () => (emphasis.rateChange && signal && signal.units === "pct-max" && !signal.pacer && analysis ? rateChange(signal.user, analysis.frame.hz) : null),
    [emphasis.rateChange, signal, analysis],
  );
  const lead = ctx.self ? (
    <CoachingPane
      goal={goal}
      emphasis={emphasis}
      session={session}
      sessions={ctx.sessions}
      dailyMinutes={dailyMinutesOf(prefs)}
      professional={named[0] ?? null}
      turns={analysis?.turns?.transitions ?? null}
      rates={rates}
    />
  ) : null;

  const paced = session.mode === "paced";
  const zooms = ZOOMS.filter((z) => z.sec < session.durationSec || z.sec === Infinity);
  const [zoom, setZoom] = useState(zooms.some((z) => z.sec === 60) ? 60 : Infinity);
  const [start, setStart] = useState(0);
  const duration = analysis?.frame.duration ?? session.durationSec;
  const span = Math.min(zoom, duration);
  const t0 = Math.max(0, Math.min(start, duration - span));
  const t1 = t0 + span;

  const setZoomKeepingCentre = (sec: number) => {
    const next = Math.min(sec, duration);
    setStart(Math.max(0, t0 + span / 2 - next / 2));
    setZoom(sec);
  };

  return (
    <div className="review">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href={ctx.overviewHref} className="link">
          <Icon name="chevronLeft" size={18} />
          {ctx.self ? "All sessions" : ctx.name}
        </Link>
      </nav>
      <div className="title-row">
        <h1>
          {describeMode(session)} · {formatLongDay(session.startedAt)}
        </h1>
        <span>
          {formatTime(session.startedAt)} · {formatDuration(session.durationSec)} ·{" "}
          {paced ? `pacer ${session.pacerHalfCycleSec} s in, ${session.pacerHalfCycleSec} s out` : "no pacer"} ·{" "}
          {session.source === "web"
            ? `recorded in BreathCloud${session.appVersion.includes("simulator") ? " with the simulated band" : ""}`
            : `app ${session.appVersion}`}
        </span>
        <div className="title-actions no-print">
          {!ctx.self && comments.status === "ready" && (
            <KudosButton session={session} comments={comments.data} viewerId={viewerId} onChange={comments.retry} />
          )}
          <button type="button" className="button" data-variant="ghost" data-size="small" onClick={() => window.print()}>
            <Icon name="print" size={16} />
            Print or PDF
          </button>
        </div>
      </div>

      <PlanBadge session={session} sessions={ctx.sessions} />
      {session.groupSessionId && <GroupLine groupId={session.groupSessionId} viewerId={viewerId} />}
      {ctx.self && comments.status === "ready" && <KudosLine comments={comments.data} />}

      <ScoreRow session={session} sessions={ctx.sessions} emphasis={emphasis} lead={lead} />

      <section className="pane wave-pane" aria-label="Waveform">
        <div className="wave-h">
          <h2>
            {paced ? "Breathing vs pacer" : "Breathing"}
            {!curvesPrivate && ` · ${formatDuration(t0)}–${formatDuration(t1)}`}
          </h2>
          {!curvesPrivate && (
            <>
              <Legend paced={paced} />
              <div className="seg" role="group" aria-label="Time shown">
                {zooms.map((z) => (
                  <button key={z.label} type="button" aria-pressed={z.sec === zoom} onClick={() => setZoomKeepingCentre(z.sec)}>
                    {z.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {curvesPrivate ? (
          <div className="empty locked">
            <h2>
              <Icon name="lock" size={18} /> {ctx.name.split(" ")[0]} shares scores only
            </h2>
            <p className="muted">
              The breathing curve stays private: they share scores, notes and comments only. They can
              change this under Sharing.
            </p>
          </div>
        ) : waveform.status === "error" ? (
          <ErrorState error={waveform.error} what="the breathing signal" onRetry={waveform.retry} />
        ) : waveform.status !== "ready" || !analysis ? (
          <Skeleton lines={4} label="Loading the breathing signal…" />
        ) : (
          <Measured height={260}>
            {(width) => (
              <div className="wave-stack">
                <WaveChart waveform={waveform.data} frame={analysis.frame} t0={t0} t1={t1} width={width} />
                {paced && (
                  <DeviationStrip
                    breaths={analysis.breaths}
                    t0={t0}
                    t1={t1}
                    width={width}
                    halfCycle={session.pacerHalfCycleSec ?? 5}
                    depthMax={analysis.turns ? 4.5 : undefined}
                  />
                )}
                {span < duration && (
                  <SessionScrubber
                    waveform={waveform.data}
                    frame={analysis.frame}
                    t0={t0}
                    span={span}
                    width={width}
                    onChange={setStart}
                  />
                )}
              </div>
            )}
          </Measured>
        )}
      </section>

      <div className="low" data-single={curvesPrivate || undefined}>
        {curvesPrivate ? null : paced && analysis?.turns ? (
          <section className="pane pane-pad" aria-label="Pacer turns in view">
            <div className="pane-h">
              <h2>Each turn of the pacer</h2>
              <span className="meta">+ late / deeper · depth in % of your max · points for timing · depth</span>
            </div>
            <TurnTable result={analysis.turns} t0={t0} t1={t1} />
          </section>
        ) : paced ? (
          <section className="pane pane-pad" aria-label="Breaths in view">
            <div className="pane-h">
              <h2>Breaths in view</h2>
              <span className="meta">vs the pacer&apos;s peak and trough · + late / deeper</span>
            </div>
            {analysis ? <BreathTable breaths={analysis.breaths} t0={t0} t1={t1} /> : <Skeleton lines={3} />}
          </section>
        ) : (
          <section className="pane pane-pad" aria-label="Markers">
            <div className="pane-h">
              <h2>Markers</h2>
              <span className="meta">Tapped during the session</span>
            </div>
            {waveform.status === "ready" ? (
              waveform.data.markers.length === 0 ? (
                <p className="muted">No markers in this session.</p>
              ) : (
                <ul className="markers">
                  {waveform.data.markers.map((i) => {
                    const t = i / (analysis?.frame.hz ?? 20);
                    return (
                      <li key={i}>
                        <Icon name="marker" size={16} />
                        <button type="button" className="link" onClick={() => setStart(Math.max(0, t - span / 2))}>
                          {formatDuration(t)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : (
              <Skeleton lines={2} />
            )}
          </section>
        )}
        <div className="stack">
          <NotePane session={session} ctx={ctx} audience={audience} />
          <CommentsPane session={session} ctx={ctx} viewerId={viewerId} comments={comments} audience={audience} professionals={professionals} />
        </div>
      </div>
    </div>
  );
}

function Legend({ paced }: { paced: boolean }) {
  return (
    <div className="legend">
      <span>
        <i className="sw-line" data-dir="in" />
        <Arrow dir="in" />
        Inhale, above
      </span>
      <span>
        <i className="sw-line" data-dir="out" />
        <Arrow dir="out" />
        Exhale, below
      </span>
      {paced && (
        <span>
          <i className="sw-pacer" />
          Pacer
        </span>
      )}
    </div>
  );
}

/**
 * The one coaching line in the person's goal's tone, beside or under the
 * score; Focus also gets the share on target (or the rate falling), Calm one tip.
 */
export function CoachingPane({
  goal,
  emphasis,
  session,
  sessions,
  dailyMinutes,
  professional,
  turns,
  rates,
}: {
  goal: BreathGoal | null;
  emphasis: ResultsEmphasis;
  session: SessionSummary;
  sessions: SessionSummary[];
  /** The ring's minutes a day, for Home's rule on "done for today". */
  dailyMinutes: number;
  /** The person's professional, as Home has them: a clinician's client hears the clinician's line, not streaks. */
  professional: Professional | null;
  turns: readonly TurnPoints[] | null;
  rates: { from: number; to: number } | null;
}) {
  const at = Date.parse(session.startedAt);
  const streak = streakDays(sessions.filter((s) => Date.parse(s.startedAt) <= at), new Date(at));
  // Today's ring, as Home shows it, when this session is from today; an older day's review keeps "done".
  const now = new Date();
  const today = new Date(at).toDateString() === now.toDateString();
  const leftToday = today ? minutesLeftToday(ringOf([session, ...sessions.filter((s) => s.id !== session.id)], now, dailyMinutes)) : 0;
  const { line, tip } = coaching({ goal, session, streakDays: streak, leftToday, professional, turns, rates });
  const share = emphasis.share ? onTargetShare(session) : null;
  if (!line) return null;
  return (
    <section className="pane pane-pad mc-lead" aria-label="Coaching" data-goal={goal ?? undefined}>
      {share !== null && (
        <p className="mc-share">
          <b className="display">{share}%</b> of the session on target
        </p>
      )}
      {rates && (
        <p className="mc-share">
          <b className="display">
            {rates.from} → {rates.to}
          </b>{" "}
          br/min, start to end
        </p>
      )}
      <p className="mc-line">{line}</p>
      {tip && (
        <p className="mc-tip">
          <Icon name="info" size={16} />
          {tip}
        </p>
      )}
    </section>
  );
}

/** Headline, breakdown and explainer, shaped by the session's scoring version; `lead` is the coaching pane. */
function ScoreRow({
  session,
  sessions,
  emphasis,
  lead,
}: {
  session: SessionSummary;
  sessions: SessionSummary[];
  emphasis: ResultsEmphasis;
  lead: ReactNode;
}) {
  const { scores } = session;

  if (session.scoringVersion === SCORING_VERSIONS.methodC && isTransitionScores(scores)) {
    return <MethodCScores session={session} sessions={sessions} scores={scores} emphasis={emphasis} lead={lead} />;
  }
  if (session.open) return <OpenScores session={session} emphasis={emphasis} lead={lead} />;
  return (
    <>
      <EarlierScores session={session} sessions={sessions} />
      {lead}
    </>
  );
}

/** Sessions scored before method C: the transition-v1 and legacy scores, and open sessions without metrics. */
function EarlierScores({ session, sessions }: { session: SessionSummary; sessions: SessionSummary[] }) {
  const { scores } = session;

  if (isTransitionScores(scores)) {
    const { word, band } = scoreWord(scores.total);
    const index = sessions.findIndex((s) => s.id === session.id);
    const previous = sessions.slice(index + 1).find((s) => isTransitionScores(s.scores));
    const delta =
      previous && isTransitionScores(previous.scores)
        ? Math.round((scores.total - previous.scores.total) * 10) / 10
        : null;
    const subs = [scores.timing.inhale, scores.timing.exhale, scores.depth.inhale, scores.depth.exhale];
    return (
      <div className="scores">
        <section className="pane hero" aria-label="Total Breath Score">
          <span className="lbl">Total Breath Score</span>
          <span className="n">{formatScore(scores.total)}</span>
          <span className="w">
            <Dot band={band} />
            {word}
          </span>
          <span className="d">
            {delta === null
              ? "First scored session"
              : `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${formatScore(Math.abs(delta))} vs ${formatDay(previous!.startedAt, undefined, false)}`}{" "}
            · mean of timing and depth
          </span>
        </section>
        <section className="pane pane-pad" aria-label="Scores">
          <TransitionTable scores={scores} />
        </section>
        <section className="pane pane-pad how" aria-label="How scores work">
          <div className="pane-h">
            <h2>How scores work</h2>
            <span className="meta">1–10</span>
          </div>
          <ScaleStrip hits={subs} />
          <p className="rules">
            Each score compares the breathing with the pacer. Within 10% of the pacer scores <b>10</b>; every further
            10% off takes a point away, down to <b>1</b>.
          </p>
        </section>
      </div>
    );
  }

  if (isLegacyScores(scores)) {
    const rows: [string, number][] = [
      ["Timing", scores.timing],
      ["Depth", scores.depth],
    ];
    return (
      <div className="scores">
        <section className="pane hero" aria-label="Overall score">
          <span className="lbl">Overall · earlier scoring</span>
          <span className="n">{Math.round(scores.overall)}%</span>
          <span className="w">
            <Dot band={legacyBand(scores.overall)} />
            0–100% scale
          </span>
          <span className="d">Mean of timing and depth</span>
        </section>
        <section className="pane pane-pad" aria-label="Scores">
          <table className="table sc">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="num">
                    <span className="score">
                      <span className="score-n">{Math.round(value)}%</span>
                      <span className="score-w">
                        <Dot band={legacyBand(value)} />
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="pane pane-pad how" aria-label="About this score">
          <div className="pane-h">
            <h2>Recorded before per-breath scores</h2>
          </div>
          <p className="rules">
            App {session.appVersion} scored whole sessions from 0 to 100%, with no inhale and exhale breakdown. These
            scores aren&apos;t on the same scale as the 1–10 scores, so they&apos;re left out of the trend.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="scores" data-cols="2">
      <section className="pane hero" aria-label="Breathing rate">
        <span className="lbl">Breathing rate</span>
        <span className="n">{session.respirationRateBpm ?? "–"}</span>
        <span className="w">breaths per minute</span>
        <span className="d">{session.respirationRateBpm === null ? "Too few breaths to measure" : "Typical at rest: 12–16"}</span>
      </section>
      <section className="pane pane-pad how" aria-label="About open sessions">
        <div className="pane-h">
          <h2>Open session</h2>
        </div>
        <p className="rules">
          Natural breathing with no pacer, so there&apos;s nothing to score timing or depth against. Markers show where
          the athlete tapped to note an event.
        </p>
      </section>
    </div>
  );
}

/** The athlete's note: editable by the athlete, read-only for a coach. `audience` names who reads it, for the athlete. */
function NotePane({ session, ctx, audience }: { session: SessionSummary; ctx: ConsoleContext; audience: string }) {
  const backend = useBackend();
  const [note, setNote] = useState(session.note);
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function save() {
    if (draft === null) return;
    setStatus("saving");
    try {
      await backend.data.updateSessionNote(session.athleteId, session.id, draft.trim());
      setNote(draft.trim());
      setDraft(null);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="pane pane-pad" aria-label="Session note">
      <div className="pane-h">
        <h2>Session note</h2>
        <span className="meta">{ctx.self ? `Visible to ${audience}` : `${ctx.name.split(" ")[0]}'s note`}</span>
      </div>
      {draft !== null ? (
        <form
          className="stack note-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="field">
            <span className="sr-only">Note</span>
            <textarea rows={4} value={draft} maxLength={1000} autoFocus onChange={(e) => setDraft(e.target.value)} />
          </label>
          {status === "error" && (
            <p className="error" role="alert">
              Couldn&apos;t save the note. Try again.
            </p>
          )}
          <div className="row">
            <button type="submit" className="button" data-size="small" disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Save note"}
            </button>
            <button type="button" className="button" data-variant="ghost" data-size="small" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className={note ? "note-txt" : "note-txt muted"}>{note || "No note for this session."}</p>
          {ctx.self && (
            <button type="button" className="link note-edit" onClick={() => setDraft(note)}>
              <Icon name="pencil" size={16} />
              {note ? "Edit note" : "Add a note"}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** Which of the coach's practice this session counts toward, if any. */
function PlanBadge({ session, sessions }: { session: SessionSummary; sessions: SessionSummary[] }) {
  const backend = useBackend();
  const [now] = useState(() => new Date());
  const plans = useLoad(`plans:${session.athleteId}`, () => backend.data.listAssignments(session.athleteId));
  if (plans.status !== "ready") return null;
  const matching = plans.data.filter((a) => !a.cancelled && countsToward(a, session));
  if (matching.length === 0) return null;
  return (
    <ul className="plan-badges">
      {matching.map((a) => {
        const p = assignmentProgress(a, sessions, now);
        return (
          <li key={a.id}>
            <Icon name="plan" size={16} />
            <span>
              Counts toward practice: <b>{describeAssignment(a)}</b>
            </span>
            <Progress done={p.done} target={a.target} status={p.status} />
          </li>
        );
      })}
    </ul>
  );
}

/** A coach's one-tap "nice work". Pressing it again takes it back. */
function KudosButton({
  session,
  comments,
  viewerId,
  onChange,
}: {
  session: SessionSummary;
  comments: SessionComment[];
  viewerId: string;
  onChange: () => void;
}) {
  const backend = useBackend();
  const [busy, setBusy] = useState(false);
  const mine = comments.find((c) => c.kind === "kudos" && c.authorId === viewerId);

  async function toggle() {
    setBusy(true);
    try {
      if (mine) await backend.data.deleteComment(session.athleteId, session.id, mine.id);
      else await backend.data.addComment(session.athleteId, session.id, { kind: "kudos", text: "" });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="button kudos"
      data-variant="ghost"
      data-size="small"
      aria-pressed={Boolean(mine)}
      disabled={busy}
      onClick={toggle}
      title={mine ? "Take back your kudos" : "Send kudos for this session"}
    >
      <Icon name="kudos" size={16} />
      {mine ? "Kudos sent" : "Send kudos"}
    </button>
  );
}

/** What the athlete sees: who sent kudos. */
function KudosLine({ comments }: { comments: SessionComment[] }) {
  const kudos = comments.filter((c) => c.kind === "kudos");
  if (kudos.length === 0) return null;
  return (
    <p className="kudos-line">
      <Icon name="kudos" size={16} />
      {kudos.map((k) => k.authorName).join(" and ")} sent kudos for this session
    </p>
  );
}

/** The conversation on one session between the athlete and their coaches. */
function CommentsPane({
  session,
  ctx,
  viewerId,
  comments,
  audience,
  professionals,
}: {
  session: SessionSummary;
  ctx: ConsoleContext;
  viewerId: string;
  comments: Loaded<SessionComment[]>;
  /** For the athlete: who reads the thread ("your clinician"). */
  audience: string;
  /** The athlete's linked professionals, to tag each one's comments with their kind; empty for a coach. */
  professionals: readonly UserProfile[];
}) {
  const backend = useBackend();
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [now] = useState(() => new Date());

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setStatus("sending");
    try {
      await backend.data.addComment(session.athleteId, session.id, { kind: "comment", text: draft });
      setDraft("");
      setStatus("idle");
      comments.retry();
    } catch {
      setStatus("error");
    }
  }

  async function remove(id: string) {
    try {
      await backend.data.deleteComment(session.athleteId, session.id, id);
      comments.retry();
    } catch {
      setStatus("error");
    }
  }

  const thread = comments.status === "ready" ? comments.data.filter((c) => c.kind === "comment") : [];
  const other = ctx.self ? audience : ctx.name.split(" ")[0];
  // " · clinician" beside a professional's comment, in their own kind's word.
  const tagOf = (c: SessionComment) => {
    const word = commentAuthorWord(c, professionals);
    return word ? ` · ${word}` : null;
  };

  return (
    <section className="pane pane-pad" aria-labelledby="comments-h" id="comments">
      <div className="pane-h">
        <h2 id="comments-h">Comments</h2>
        <span className="meta">{ctx.self ? `Between you and ${audience}` : `Visible to ${other}`}</span>
      </div>
      {comments.status === "loading" ? (
        <Skeleton lines={2} />
      ) : comments.status === "error" ? (
        <ErrorState error={comments.error} what="comments" onRetry={comments.retry} />
      ) : thread.length === 0 ? (
        <p className="muted small-text">No comments yet.</p>
      ) : (
        <ol className="thread">
          {thread.map((c) => (
            <li key={c.id} data-mine={c.authorId === viewerId || undefined}>
              <span className="avatar sm" aria-hidden="true">
                {initials(c.authorName)}
              </span>
              <div className="bubble">
                <span className="label">
                  <b>{c.authorId === viewerId ? "You" : c.authorName}</b>
                  {c.authorId !== viewerId && tagOf(c)} · {timeAgo(c.createdAt, now)}
                </span>
                <p>{c.text}</p>
                {c.authorId === viewerId && (
                  <button type="button" className="link small no-print" onClick={() => remove(c.id)}>
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <form className="comment-form no-print" onSubmit={send}>
        <label className="field">
          <span className="sr-only">Write a comment</span>
          <textarea
            rows={2}
            maxLength={1000}
            value={draft}
            placeholder={`${ctx.self ? "Reply" : "Write"} to ${other}…`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(e);
            }}
          />
        </label>
        <div className="row">
          <button type="submit" className="button" data-size="small" disabled={status === "sending" || !draft.trim()}>
            <Icon name="comment" size={16} />
            {status === "sending" ? "Sending…" : "Comment"}
          </button>
          {status === "error" && (
            <span className="error" role="alert">
              Couldn&apos;t send. Try again.
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

/** For sessions recorded in a group session: who hosted it and how the group did. */
function GroupLine({ groupId, viewerId }: { groupId: string; viewerId: string }) {
  const backend = useBackend();
  // Coaches other than the host can't read the group session; they just don't see this line.
  const group = useLoad(`group:${groupId}`, () => backend.data.getGroupSession(groupId).catch(() => null));
  if (group.status !== "ready" || !group.data) return null;
  const g = group.data;
  return (
    <p className="group-line">
      <Icon name="group" size={16} />
      <span>
        Recorded in a group session, <b>{g.title}</b>, led by {g.hostId === viewerId ? "you" : g.hostName} ·{" "}
        {Object.keys(g.results).length} took part
        {g.groupAverage !== null && <> · group average {formatScore(g.groupAverage)}</>}
      </span>
      {g.hostId === viewerId && (
        <Link className="link small" href={`/cloud/group/live/?id=${encodeURIComponent(g.id)}`}>
          See everyone
          <Icon name="chevronRight" size={16} />
        </Link>
      )}
    </p>
  );
}
