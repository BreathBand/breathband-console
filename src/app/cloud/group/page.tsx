"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { BackendError } from "@/lib/backend";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { formatDay, formatDuration, formatTime, initials } from "@/lib/domain/format";
import { describeGroupAverage, describePacer, GROUP_SIZE } from "@/lib/domain/group";
import type { GroupSession, PacerHalfCycle } from "@/lib/domain/types";
import { useLoad } from "@/lib/useLoad";
import { sessionHref } from "../links";
import "./group.css";

const LENGTHS = [3, 5, 10];

// /cloud/group/ — coaches start a live group session and find past ones.
export default function GroupPage() {
  const auth = useAuth();
  if (auth.status !== "signed-in") return null;
  return auth.profile?.role === "coach" ? <GroupHome coachId={auth.user.uid} /> : <AthleteGroups uid={auth.user.uid} />;
}

function GroupHome({ coachId }: { coachId: string }) {
  const backend = useBackend();
  const history = useLoad(`groups:${coachId}`, () => backend.data.listGroupSessions(coachId));

  return (
    <div className="container review">
      <div className="title-row">
        <h1>Group sessions</h1>
        <span>Several athletes follow one pacer at the same time. You lead it and see everyone&apos;s breathing, lined up in time.</span>
      </div>
      <NewGroup coachId={coachId} />
      <section className="pane pane-pad" aria-labelledby="history-h">
        <div className="pane-h">
          <h2 id="history-h">Earlier group sessions</h2>
        </div>
        {history.status === "loading" ? (
          <Skeleton lines={3} />
        ) : history.status === "error" ? (
          <ErrorState error={history.error} what="group sessions" onRetry={history.retry} />
        ) : history.data.length === 0 ? (
          <p className="muted small-text dash-empty">None yet. Your first one will show up here with its results.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Session</th>
                  <th>Pacer · length</th>
                  <th className="num">Took part</th>
                  <th className="num">Group average</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((g) => (
                  <tr key={g.id}>
                    <td>
                      {formatDay(g.createdAt)}
                      <span className="sub-line">{formatTime(g.createdAt)}</span>
                    </td>
                    <td>
                      <Link className="row-link" href={`/cloud/group/live/?id=${encodeURIComponent(g.id)}`}>
                        {g.title}
                      </Link>
                    </td>
                    <td className="sub">
                      {describePacer(g)} · {formatDuration(g.durationSec)}
                    </td>
                    <td className="num">
                      {g.status === "ended" ? Object.keys(g.results).length : "–"} of {g.athleteIds.length}
                    </td>
                    <td className="num">{describeGroupAverage(g.groupAverage)}</td>
                    <td>
                      <span className="chip" data-status={g.status === "ended" ? "done" : g.status === "cancelled" ? "cancelled" : "active"}>
                        {STATUS[g.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const STATUS: Record<GroupSession["status"], string> = {
  lobby: "In the lobby",
  live: "Live",
  ended: "Ended",
  cancelled: "Cancelled",
};

function NewGroup({ coachId }: { coachId: string }) {
  const backend = useBackend();
  const router = useRouter();
  const athletes = useLoad(`group-athletes:${coachId}`, async () => {
    const [list, squads] = await Promise.all([backend.data.listAthletes(coachId), backend.data.listSquads(coachId)]);
    const links = await Promise.all(list.map((a) => backend.data.getCoachLink(coachId, a.uid)));
    return { squads, people: list.map((profile, i) => ({ profile, scope: links[i]?.scope ?? "scores" })) };
  });
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [title, setTitle] = useState("");
  const [pacer, setPacer] = useState<PacerHalfCycle>(5);
  const [minutes, setMinutes] = useState(5);
  const [status, setStatus] = useState<{ busy: boolean; error: string }>({ busy: false, error: "" });

  const everyone = athletes.status === "ready" ? athletes.data.people : [];
  const squads = athletes.status === "ready" ? athletes.data.squads : [];
  // Everyone is picked until the coach changes it.
  const chosen = picked ?? new Set(everyone.map((a) => a.profile.uid));
  const toggle = (uid: string) => {
    const next = new Set(chosen);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    setPicked(next);
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus({ busy: true, error: "" });
    try {
      const group = await backend.data.createGroupSession(coachId, {
        title: title || `Group session · ${formatDay(new Date().toISOString())}`,
        athleteIds: [...chosen],
        pacerHalfCycleSec: pacer,
        durationSec: minutes * 60,
      });
      router.push(`/cloud/group/live/?id=${encodeURIComponent(group.id)}`);
    } catch (e) {
      setStatus({
        busy: false,
        error:
          e instanceof BackendError && e.code === "permission-denied"
            ? "One of these athletes no longer shares with you. Reload and try again."
            : "Couldn't open the lobby. Try again.",
      });
    }
  }

  return (
    <section className="pane pane-pad" aria-labelledby="new-group-h">
      <div className="pane-h">
        <h2 id="new-group-h">Start a group session</h2>
        <span className="meta">Each athlete gets a Join notification in the Breathband app</span>
      </div>
      {athletes.status === "loading" ? (
        <Skeleton lines={3} />
      ) : athletes.status === "error" ? (
        <ErrorState error={athletes.error} what="your athletes" onRetry={athletes.retry} />
      ) : everyone.length < GROUP_SIZE.min ? (
        <EmptyState title="You need at least two athletes">
          <p className="muted">
            Group sessions are for {GROUP_SIZE.min} to {GROUP_SIZE.max} athletes.{" "}
            <Link href="/cloud/athletes/#invite-athlete">Invite an athlete</Link> by text or email.
          </p>
        </EmptyState>
      ) : (
        <form className="group-form" onSubmit={onSubmit}>
          <fieldset className="field">
            <legend>
              Who&apos;s breathing ({chosen.size} of {everyone.length})
            </legend>
            <ul className="pick-list">
              {everyone.map(({ profile, scope }) => (
                <li key={profile.uid}>
                  <label className="pick" data-on={chosen.has(profile.uid) || undefined}>
                    <input type="checkbox" checked={chosen.has(profile.uid)} onChange={() => toggle(profile.uid)} />
                    <span className="avatar" aria-hidden="true">
                      {initials(profile.displayName)}
                    </span>
                    <span className="pick-name">
                      {profile.displayName}
                      <small>
                        {scope === "curves" ? (
                          "Live curve shown"
                        ) : (
                          <>
                            <Icon name="lock" size={12} /> Shares scores only: curve stays private
                          </>
                        )}
                      </small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {squads.length > 0 && (
              <p className="label squad-quick">
                Pick a squad:{" "}
                {squads.map((q) => (
                  <button key={q.id} type="button" className="link small" onClick={() => setPicked(new Set(q.athleteIds))}>
                    {q.name}
                  </button>
                ))}
                <button type="button" className="link small" onClick={() => setPicked(new Set(everyone.map((a) => a.profile.uid)))}>
                  Everyone
                </button>
              </p>
            )}
          </fieldset>
          <div className="group-form-row">
            <label className="field grow">
              Name <span className="muted">(optional)</span>
              <input value={title} maxLength={80} placeholder="e.g. Tuesday squad warm-up" onChange={(e) => setTitle(e.target.value)} />
            </label>
            <fieldset className="field">
              <legend>Pacer to start</legend>
              <div className="seg">
                {([5, 2] as const).map((h) => (
                  <button key={h} type="button" aria-pressed={pacer === h} onClick={() => setPacer(h)}>
                    Paced {h}-{h}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="field">
              <legend>Length</legend>
              <div className="seg">
                {LENGTHS.map((n) => (
                  <button key={n} type="button" aria-pressed={minutes === n} onClick={() => setMinutes(n)}>
                    {n} min
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <p className="label">
            You can switch the pacer and drop markers while it runs. Each athlete&apos;s app records and scores their own session, and
            it shows up in their history and yours.
          </p>
          {status.error && (
            <p className="error" role="alert">
              {status.error}
            </p>
          )}
          <div className="row">
            <button type="submit" className="button" disabled={status.busy || chosen.size < GROUP_SIZE.min}>
              <Icon name="group" size={18} />
              {status.busy ? "Opening…" : "Open the lobby"}
            </button>
            {chosen.size < GROUP_SIZE.min && <span className="label">Pick at least {GROUP_SIZE.min} athletes.</span>}
          </div>
        </form>
      )}
    </section>
  );
}

/** Athletes join group sessions from the app; here they can find the ones they were in. */
function AthleteGroups({ uid }: { uid: string }) {
  const backend = useBackend();
  const groups = useLoad(`groups:${uid}`, () => backend.data.listGroupSessions(uid));
  return (
    <div className="container review narrow">
      <div className="title-row">
        <h1>Group sessions</h1>
        <span>Your coach starts them; you join from the Breathband app when you get the notification.</span>
      </div>
      <section className="pane pane-pad">
        {groups.status === "loading" ? (
          <Skeleton lines={2} />
        ) : groups.status === "error" ? (
          <ErrorState error={groups.error} what="group sessions" onRetry={groups.retry} />
        ) : groups.data.length === 0 ? (
          <p className="muted">You haven&apos;t been in a group session yet.</p>
        ) : (
          <ul className="people">
            {groups.data.map((g) => (
              <li key={g.id}>
                <span className="people-name">
                  {g.title}
                  <small>
                    {formatDay(g.createdAt)} · with {g.hostName} · {describePacer(g)}
                  </small>
                </span>
                {g.results[uid] ? (
                  <Link className="button" data-variant="ghost" data-size="small" href={sessionHref(uid, g.results[uid])}>
                    Your session
                  </Link>
                ) : (
                  <span className="label">{g.status === "ended" ? "You didn't take part" : STATUS[g.status]}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
