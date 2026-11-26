"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Progress, StatusChip } from "@/components/Progress";
import { HeadlineScore } from "@/components/Score";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { daysAgoText } from "@/lib/domain/activity";
import { dayKey, describeAssignment, dueText, isOpen, lastDays, timeAgo } from "@/lib/domain/coaching";
import { describeMode, formatDay, formatDuration, formatTime, initials } from "@/lib/domain/format";
import { formatScore, headline, isTransitionScores, scoreWord } from "@/lib/domain/scores";
import { aPerson } from "@/lib/domain/terminology";
import type { SessionSummary } from "@/lib/domain/types";
import { athleteHref, sessionHref } from "./links";
import { inSquad, SquadFilter } from "./SquadFilter";
import { useTerms } from "./useTerms";
import { REVIEW_WINDOW_DAYS, useTeam, type Team, type TeamMember } from "./useTeam";

const DAY_MS = 86_400_000;
const GRID_DAYS = 14;

/**
 * The coach's landing page: what changed since they last looked and who
 * needs them, across every athlete who shares with them.
 */
export function CoachDashboard({ coachId }: { coachId: string }) {
  const auth = useAuth();
  const [now] = useState(() => new Date());
  const team = useTeam(coachId, now);
  const t = useTerms();
  const name = auth.status === "signed-in" ? auth.profile?.displayName : undefined;

  return (
    <div className="container review">
      <div className="title-row">
        <h1>
          {greeting(now)}
          {name ? `, ${name.split(" ")[0]}` : ""}
        </h1>
        <span>
          {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          {team.status === "ready" &&
            ` · ${team.data.members.length} ${team.data.members.length === 1 ? t.one : t.many}`}
        </span>
      </div>

      {team.status === "loading" ? (
        <Skeleton lines={8} label={`Loading your ${t.many}…`} />
      ) : team.status === "error" ? (
        <ErrorState error={team.error} what={`your ${t.many}`} onRetry={team.retry} />
      ) : team.data.members.length === 0 ? (
        <EmptyState title={`No ${t.many} yet`}>
          <p className="muted">
            {t.Many} share their sessions with you by creating an invite code under <b>Sharing</b> in BreathCloud. Enter
            it on the <Link href="/cloud/athletes/">{t.Many}</Link> page and they&apos;ll appear here.
          </p>
          <Link className="button" href="/cloud/athletes/#invite-athlete">
            <Icon name="plus" size={18} />
            Add {aPerson(t)}
          </Link>
        </EmptyState>
      ) : (
        <Dashboard team={team.data} now={now} coachId={coachId} onChange={team.retry} />
      )}
    </div>
  );
}

function Dashboard({ team, now, coachId, onChange }: { team: Team; now: Date; coachId: string; onChange: () => void }) {
  const t = useTerms();
  const [squad, setSquad] = useState("");
  const members = inSquad(team.members, team.squads, squad);
  return (
    <>
      {team.squads.length > 0 && (
        <div className="dash-filter">
          <SquadFilter squads={team.squads} value={squad} onChange={setSquad} />
          {squad && (
            <span className="label">
              Showing {members.length} of {team.members.length} {t.many}
            </span>
          )}
        </div>
      )}
      <TeamStats members={members} now={now} />
      <div className="dash">
        <div className="dash-main">
          <NeedsALook members={members} practiceBehind={team.rules.practiceBehind} />
          <ToReview members={members} now={now} coachId={coachId} onChange={onChange} />
        </div>
        <div className="dash-side">
          <TrainingGrid members={members} now={now} />
          <PracticeDue members={members} />
          <FromAthletes members={members} now={now} />
        </div>
      </div>
    </>
  );
}

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// ---------------------------------------------------------------- headline numbers

function TeamStats({ members, now }: { members: TeamMember[]; now: Date }) {
  const inWindow = (s: SessionSummary, fromDays: number, toDays: number) => {
    const age = now.getTime() - Date.parse(s.startedAt);
    return age >= fromDays * DAY_MS && age < toDays * DAY_MS;
  };
  const all = members.flatMap((m) => m.sessions);
  const thisWeek = all.filter((s) => inWindow(s, 0, 7));
  const lastWeek = all.filter((s) => inWindow(s, 7, 14));
  const avg = (sessions: SessionSummary[]) => {
    const totals = sessions.flatMap((s) => (isTransitionScores(s.scores) ? [s.scores.total] : []));
    return totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null;
  };
  const avgNow = avg(thisWeek);
  const avgBefore = avg(lastWeek);
  const open = members.flatMap((m) => m.plans.filter(isOpen));
  const behind = open.filter((p) => p.status === "behind").length;
  const unseen = members.reduce((n, m) => n + m.unseen.length, 0);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const t = useTerms();

  return (
    <div className="stats">
      <section className="pane stat">
        <span className="lbl">Sessions, last 7 days</span>
        <span className="n">{thisWeek.length}</span>
        <span className="d">
          {lastWeek.length} the week before · {members.filter((m) => m.activity.lastWeek > 0).length} of {members.length}{" "}
          {t.many} practised
        </span>
      </section>
      <section className="pane stat">
        <span className="lbl">Team average, last 7 days</span>
        {avgNow === null ? (
          <>
            <span className="n">–</span>
            <span className="d">No scored sessions this week</span>
          </>
        ) : (
          <>
            <span className="n">{formatScore(round1(avgNow))}</span>
            <span className="d">
              Total Breath Score
              {avgBefore !== null &&
                (round1(avgNow - avgBefore) === 0
                  ? " · the same as the week before"
                  : ` · ${avgNow > avgBefore ? "+" : "−"}${formatScore(Math.abs(round1(avgNow - avgBefore)))} on the week before`)}
            </span>
          </>
        )}
      </section>
      <section className="pane stat">
        <span className="lbl">Practice on track</span>
        <span className="n">
          {open.length - behind}
          <small> of {open.length}</small>
        </span>
        <span className="d">
          {open.length === 0 ? "No practice set" : behind === 0 ? "Everyone is on pace" : `${behind} behind pace`}
        </span>
      </section>
      <section className="pane stat">
        <span className="lbl">To review</span>
        <span className="n">{unseen}</span>
        <span className="d">
          {unseen === 1 ? "session" : "sessions"} from the last {REVIEW_WINDOW_DAYS} days you haven&apos;t opened
        </span>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- needs a look

interface Attention {
  key: string;
  member: TeamMember;
  rank: number;
  text: string;
  href: string;
  action: string;
}

function NeedsALook({ members, practiceBehind }: { members: TeamMember[]; practiceBehind: boolean }) {
  const items: Attention[] = members.flatMap((m) => {
    const uid = m.profile.uid;
    const first = m.profile.displayName.split(" ")[0];
    const out: Attention[] = [];
    for (const c of m.awaiting) {
      out.push({
        key: `reply-${c.id}`,
        member: m,
        rank: 0,
        text: `${first} commented: “${clip(c.text, 70)}”`,
        href: sessionHref(uid, c.sessionId) + "#comments",
        action: "Reply",
      });
    }
    for (const f of m.activity.flags) {
      out.push({
        key: `${f.kind}-${uid}`,
        member: m,
        rank: f.kind === "down" || f.kind === "trend" ? 1 : 3,
        text: f.text,
        href: f.kind === "down" && m.activity.scored[0] ? sessionHref(uid, m.activity.scored[0].id) : athleteHref(uid),
        action: "Open",
      });
    }
    for (const p of m.plans) {
      if (!practiceBehind || (p.status !== "behind" && !(p.status === "missed" && p.daysLeft > -7))) continue;
      out.push({
        key: `plan-${p.assignment.id}`,
        member: m,
        rank: 2,
        text: `${p.status === "missed" ? "Missed" : "Behind on"} ${describeAssignment(p.assignment)}: ${p.done} of ${p.assignment.target} done`,
        href: athleteHref(uid, "plan"),
        action: "Plan",
      });
    }
    return out;
  });
  items.sort((a, b) => a.rank - b.rank);

  return (
    <section className="pane pane-pad" aria-labelledby="attention-h">
      <div className="pane-h">
        <h2 id="attention-h">Needs a look</h2>
        <Link className="link small" href="/cloud/account/#alerts">
          <Icon name="info" size={16} />
          What counts
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="muted dash-empty">
          <Icon name="check" size={18} /> Nothing needs you right now. Everyone is training and on pace.
        </p>
      ) : (
        <ul className="feed">
          {items.map((item) => (
            <li key={item.key}>
              <Avatar name={item.member.profile.displayName} />
              <span className="feed-body">
                <b>{item.member.profile.displayName}</b>
                <span>{item.text}</span>
              </span>
              <Link className="button" data-variant="ghost" data-size="small" href={item.href}>
                {item.action}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- to review

function ToReview({
  members,
  now,
  coachId,
  onChange,
}: {
  members: TeamMember[];
  now: Date;
  coachId: string;
  onChange: () => void;
}) {
  const backend = useBackend();
  const [busy, setBusy] = useState(false);
  const byId = new Map(members.map((m) => [m.profile.uid, m]));
  const unseen = members.flatMap((m) => m.unseen).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  async function markAll() {
    setBusy(true);
    try {
      await Promise.all(unseen.map((s) => backend.data.markSessionSeen(coachId, s.athleteId, s.id)));
    } finally {
      setBusy(false);
      onChange();
    }
  }

  return (
    <section className="pane pane-pad" aria-labelledby="review-h">
      <div className="pane-h">
        <h2 id="review-h">To review</h2>
        {unseen.length > 0 ? (
          <button type="button" className="link small" onClick={markAll} disabled={busy}>
            <Icon name="check" size={16} />
            {busy ? "Marking…" : "Mark all as reviewed"}
          </button>
        ) : (
          <span className="meta">New sessions appear here until you open them</span>
        )}
      </div>
      {unseen.length === 0 ? (
        <p className="muted dash-empty">
          <Icon name="check" size={18} /> You&apos;ve opened every session from the last {REVIEW_WINDOW_DAYS} days.
        </p>
      ) : (
        <ul className="feed review-feed">
          {unseen.map((s) => {
            const m = byId.get(s.athleteId)!;
            const thread = m.comments.filter((c) => c.sessionId === s.id && c.kind === "comment").length;
            const days = Math.max(0, Math.floor((now.getTime() - Date.parse(s.startedAt)) / DAY_MS));
            return (
              <li key={`${s.athleteId}/${s.id}`}>
                <Avatar name={m.profile.displayName} />
                <Link className="feed-body feed-link" href={sessionHref(s.athleteId, s.id)}>
                  <b>
                    {m.profile.displayName}
                    <i className="new-dot">
                      <span className="sr-only">Not opened yet</span>
                    </i>
                  </b>
                  <span>
                    {describeMode(s)} · {formatDuration(s.durationSec)} · {daysAgoText(days)}, {formatTime(s.startedAt)}
                  </span>
                  {s.note && <q>{clip(s.note, 110)}</q>}
                </Link>
                <span className="feed-end">
                  <HeadlineScore headline={headline(s)} />
                  {thread > 0 && (
                    <span className="label">
                      <Icon name="comment" size={14} /> {thread}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- training grid

function TrainingGrid({ members, now }: { members: TeamMember[]; now: Date }) {
  const days = lastDays(now, GRID_DAYS);
  const t = useTerms();
  return (
    <section className="pane pane-pad" aria-labelledby="grid-h">
      <div className="pane-h">
        <h2 id="grid-h">Last {GRID_DAYS} days</h2>
        <span className="meta">Best score of the day</span>
      </div>
      <div className="table-scroll">
        <table className="days">
          <thead>
            <tr>
              <th>
                <span className="sr-only">{t.One}</span>
              </th>
              {days.map((d) => (
                <th key={dayKey(d)} scope="col" data-weekend={d.getDay() === 0 || d.getDay() === 6 || undefined}>
                  <span aria-hidden="true">{d.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
                  <span className="sr-only">{formatDay(d.toISOString())}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const byDay = new Map<string, SessionSummary[]>();
              for (const s of m.sessions) {
                const k = dayKey(s.startedAt);
                byDay.set(k, [...(byDay.get(k) ?? []), s]);
              }
              return (
                <tr key={m.profile.uid}>
                  <th scope="row">
                    <Link href={athleteHref(m.profile.uid)}>{m.profile.displayName.split(" ")[0]}</Link>
                  </th>
                  {days.map((d) => {
                    const list = byDay.get(dayKey(d)) ?? [];
                    const best = Math.max(...list.flatMap((s) => (isTransitionScores(s.scores) ? [s.scores.total] : [])));
                    const band = Number.isFinite(best) ? scoreWord(best).band : list.length ? "open" : "none";
                    const label = list.length
                      ? `${formatDay(d.toISOString())}: ${list.map((s) => `${describeMode(s)} ${headline(s).text}`).join(", ")}`
                      : `${formatDay(d.toISOString())}: no session`;
                    return (
                      <td key={dayKey(d)}>
                        <i className="cell" data-band={band} title={label}>
                          <span className="sr-only">{label}</span>
                          {list.length > 1 && <b aria-hidden="true">{list.length}</b>}
                        </i>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="days-key label" aria-hidden="true">
        <span>
          <i className="cell" data-band="ok" /> 7+
        </span>
        <span>
          <i className="cell" data-band="mid" /> 5–6.9
        </span>
        <span>
          <i className="cell" data-band="low" /> under 5
        </span>
        <span>
          <i className="cell" data-band="open" /> open only
        </span>
        <span>
          <i className="cell" data-band="none" /> none
        </span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- practice due

function PracticeDue({ members }: { members: TeamMember[] }) {
  const open = members
    .flatMap((m) => m.plans.filter(isOpen).map((p) => ({ m, p })))
    .sort((a, b) => a.p.assignment.dueAt.localeCompare(b.p.assignment.dueAt));
  const without = members.filter((m) => !m.plans.some(isOpen));

  return (
    <section className="pane pane-pad" aria-labelledby="due-h">
      <div className="pane-h">
        <h2 id="due-h">Practice due</h2>
        <span className="meta">Soonest first</span>
      </div>
      {open.length === 0 ? (
        <p className="muted dash-empty">No practice set right now.</p>
      ) : (
        <ul className="plans compact">
          {open.map(({ m, p }) => (
            <li key={p.assignment.id}>
              <Link href={athleteHref(m.profile.uid, "plan")} className="plan-who">
                {m.profile.displayName}
              </Link>
              <span className="plan-what">{describeAssignment(p.assignment)}</span>
              <Progress done={p.done} target={p.assignment.target} status={p.status} />
              <span className="plan-due label">
                {dueText(p.daysLeft)} <StatusChip status={p.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {without.length > 0 && (
        <p className="label plan-none">
          Nothing set for{" "}
          {without.map((m, i) => (
            <span key={m.profile.uid}>
              {i > 0 && ", "}
              <Link href={athleteHref(m.profile.uid, "plan", true)}>{m.profile.displayName.split(" ")[0]}</Link>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- from the people they work with

function FromAthletes({ members, now }: { members: TeamMember[]; now: Date }) {
  const t = useTerms();
  const since = now.getTime() - REVIEW_WINDOW_DAYS * DAY_MS;
  const items = members
    .flatMap((m) => [
      ...m.comments
        .filter((c) => c.kind === "comment" && c.authorRole === "athlete")
        .map((c) => ({ m, sessionId: c.sessionId, at: c.createdAt, text: c.text, kind: "Comment" })),
      ...m.sessions
        .filter((s) => s.note && Date.parse(s.startedAt) >= since)
        .map((s) => ({ m, sessionId: s.id, at: s.startedAt, text: s.note, kind: "Session note" })),
    ])
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);

  return (
    <section className="pane pane-pad" aria-labelledby="from-h">
      <div className="pane-h">
        <h2 id="from-h">From your {t.many}</h2>
        <span className="meta">Notes and comments</span>
      </div>
      {items.length === 0 ? (
        <p className="muted dash-empty">No notes or comments in the last {REVIEW_WINDOW_DAYS} days.</p>
      ) : (
        <ul className="quotes">
          {items.map((it) => {
            const s = it.m.sessions.find((x) => x.id === it.sessionId);
            return (
              <li key={`${it.kind}-${it.m.profile.uid}-${it.sessionId}-${it.at}`}>
                <q>{clip(it.text, 140)}</q>
                <span className="label">
                  {it.m.profile.displayName} · {it.kind.toLowerCase()} · {timeAgo(it.at, now)}
                  {s && (
                    <>
                      {" · "}
                      <Link href={sessionHref(it.m.profile.uid, s.id) + (it.kind === "Comment" ? "#comments" : "")}>
                        {describeMode(s)}, {formatDay(s.startedAt, undefined, false)}
                      </Link>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- bits

export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}
