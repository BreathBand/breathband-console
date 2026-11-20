"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Sparkline } from "@/components/charts";
import { Icon } from "@/components/Icon";
import { Progress } from "@/components/Progress";
import { Score } from "@/components/Score";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { BackendError } from "@/lib/backend";
import { useBackend } from "@/lib/backend/BackendProvider";
import { daysAgoText } from "@/lib/domain/activity";
import { isOpen } from "@/lib/domain/coaching";
import { describeMode } from "@/lib/domain/format";
import { Avatar } from "./CoachDashboard";
import { InviteAthlete } from "./InviteAthlete";
import { athleteHref } from "./links";
import { SquadManager } from "./SquadManager";
import { inSquad, SquadFilter } from "./SquadFilter";
import { useTeam, type TeamMember } from "./useTeam";

type Filter = "all" | "attention" | "idle";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "attention", label: "Needs a look" },
  { value: "idle", label: "Not this week" },
];

type Sort = "attention" | "name" | "score" | "recent";
const SORTS: { value: Sort; label: string }[] = [
  { value: "attention", label: "Needs a look first" },
  { value: "name", label: "Name" },
  { value: "score", label: "Latest score, low first" },
  { value: "recent", label: "Last session, oldest first" },
];

/** Things the coach should act on for this athlete: activity flags, practice behind, replies owed. */
function issues(m: TeamMember, practiceBehind = true): string[] {
  return [
    ...m.awaiting.map(() => "Comment to answer"),
    ...m.activity.flags.map((f) => f.text),
    ...(practiceBehind ? m.plans.filter((p) => p.status === "behind").map(() => "Practice behind pace") : []),
  ];
}

/** Every athlete who shares with the coach, with their latest score, trend, practice and flags. */
export function Roster({ coachId }: { coachId: string }) {
  const [now] = useState(() => new Date());
  const team = useTeam(coachId, now);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("attention");
  const [squad, setSquad] = useState("");

  const members = team.status === "ready" ? team.data.members : [];
  const squads = team.status === "ready" ? team.data.squads : [];
  const behindRule = team.status !== "ready" || team.data.rules.practiceBehind;
  const issuesOf = (m: TeamMember) => issues(m, behindRule);
  const shown = inSquad(members, squads, squad)
    .filter((m) => m.profile.displayName.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((m) => (filter === "attention" ? issuesOf(m).length > 0 : filter === "idle" ? m.activity.lastWeek === 0 : true))
    .sort((a, b) => {
      if (sort === "attention") return issuesOf(b).length - issuesOf(a).length || byName(a, b);
      if (sort === "score") return (a.activity.scored[0]?.scores.total ?? 99) - (b.activity.scored[0]?.scores.total ?? 99);
      if (sort === "recent") return (b.activity.daysSince ?? 9999) - (a.activity.daysSince ?? 9999);
      return byName(a, b);
    });

  return (
    <div className="container review">
      <div className="title-row">
        <h1>Athletes</h1>
        {team.status === "ready" && (
          <span>
            {members.length} {members.length === 1 ? "athlete shares" : "athletes share"} their sessions with you
          </span>
        )}
      </div>

      <section className="pane roster-pane" aria-label="Athletes">
        {team.status === "loading" ? (
          <Skeleton lines={4} label="Loading athletes…" />
        ) : team.status === "error" ? (
          <ErrorState error={team.error} what="your athletes" onRetry={team.retry} />
        ) : members.length === 0 ? (
          <EmptyState title="No athletes yet">
            <p className="muted">
              Send an athlete an invite link by text or email below, or enter a code they created under <b>Sharing</b>.
            </p>
          </EmptyState>
        ) : (
          <>
            <div className="toolbar">
              <label className="search">
                <Icon name="search" size={18} />
                <span className="sr-only">Find an athlete</span>
                <input type="search" placeholder="Find an athlete" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <div className="seg" role="group" aria-label="Show">
                {FILTERS.map((f) => (
                  <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                    {f.label}
                  </button>
                ))}
              </div>
              <SquadFilter squads={squads} value={squad} onChange={setSquad} />
              <label className="sort">
                <span className="label">Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {shown.length === 0 ? (
              <p className="muted dash-empty">No athletes match.</p>
            ) : (
              <div className="table-scroll">
                <table className="table roster">
                  <thead>
                    <tr>
                      <th>Athlete</th>
                      <th>Last session</th>
                      <th className="num">Latest score</th>
                      <th>Last 8 scored</th>
                      <th className="num">Last 7 days</th>
                      <th>Practice</th>
                      <th>Needs a look</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((m) => (
                      <RosterRow
                        key={m.profile.uid}
                        member={m}
                        issues={issuesOf(m)}
                        squads={squads.filter((q) => q.athleteIds.includes(m.profile.uid)).map((q) => q.name)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {team.status === "ready" && (
        <SquadManager coachId={coachId} squads={squads} athletes={members.map((m) => m.profile)} onChange={team.retry} />
      )}
      <InviteAthlete coachId={coachId} onChange={team.retry} />
      <AddAthlete coachId={coachId} onAdded={team.retry} />
    </div>
  );
}

const byName = (a: TeamMember, b: TeamMember) => a.profile.displayName.localeCompare(b.profile.displayName);

function RosterRow({ member: m, issues: list, squads }: { member: TeamMember; issues: string[]; squads: string[] }) {
  const a = m.activity;
  const latest = a.scored[0];
  const trend = a.scored.slice(0, 8).map((s) => s.scores.total).reverse();
  const plan = m.plans.find(isOpen);
  return (
    <tr>
      <td>
        <Link className="who-cell" href={athleteHref(m.profile.uid)}>
          <Avatar name={m.profile.displayName} />
          {m.profile.displayName}
          {m.unseen.length > 0 && (
            <span className="count" title={`${m.unseen.length} new sessions you haven't opened`}>
              {m.unseen.length}
              <span className="sr-only"> new sessions</span>
            </span>
          )}
        </Link>
        {squads.length > 0 && <span className="squad-tags">{squads.join(" · ")}</span>}
      </td>
      <td className="sub">{a.newest ? `${daysAgoText(a.daysSince!)} · ${describeMode(a.newest)}` : "No sessions yet"}</td>
      <td className="num">{latest ? <Score value={latest.scores.total} /> : <span className="muted">–</span>}</td>
      <td>
        <Sparkline values={trend} label={`Last ${trend.length} Total Breath Scores: ${trend.join(", ")}`} />
      </td>
      <td className="num">{a.lastWeek}</td>
      <td>
        {plan ? (
          <Link href={athleteHref(m.profile.uid, "plan")} className="plain">
            <Progress done={plan.done} target={plan.assignment.target} status={plan.status} />
          </Link>
        ) : (
          <Link href={athleteHref(m.profile.uid, "plan", true)} className="link small">
            Assign
          </Link>
        )}
      </td>
      <td>
        {list.length === 0 ? (
          <span className="muted">–</span>
        ) : (
          <span className="flag-list">
            {list.map((text, i) => (
              <span key={i} className="flag">
                {text}
              </span>
            ))}
          </span>
        )}
      </td>
    </tr>
  );
}

/** Redeem an athlete's one-time invite code. */
function AddAthlete({ coachId, onAdded }: { coachId: string; onAdded: () => void }) {
  const backend = useBackend();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "done" | "error"; text?: string }>({ kind: "idle" });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus({ kind: "busy" });
    try {
      const link = await backend.data.redeemInvite(coachId, code);
      const profile = await backend.data.getProfile(link.athleteId).catch(() => null);
      setCode("");
      setStatus({
        kind: "done",
        text: `Added ${profile?.displayName ?? "the athlete"}. They share ${link.scope === "curves" ? "scores and breathing curves" : "scores only"}.`,
      });
      onAdded();
    } catch (e) {
      setStatus({
        kind: "error",
        text:
          e instanceof BackendError && e.code === "invite-invalid"
            ? "That code isn't valid or has expired. Ask the athlete for a new one."
            : "Couldn't add the athlete. Try again.",
      });
    }
  }

  return (
    <section className="pane pane-pad" aria-labelledby="add-athlete-h" id="add-athlete">
      <div className="pane-h">
        <h2 id="add-athlete-h">Have a code from the athlete?</h2>
        <span className="meta">Codes work once and expire after 7 days</span>
      </div>
      <p className="muted small-text">
        The athlete creates a code under <b>Sharing</b> in BreathCloud and chooses whether you see their breathing
        curves or scores only.
      </p>
      <form className="invite-form" onSubmit={onSubmit}>
        <label className="field">
          Invite code from the athlete
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={8}
            placeholder="K7QX2MPA"
            className="code-input"
          />
        </label>
        <button className="button" type="submit" disabled={status.kind === "busy"}>
          <Icon name="plus" size={18} />
          {status.kind === "busy" ? "Adding…" : "Add athlete"}
        </button>
      </form>
      {status.kind === "done" && (
        <p role="status" className="ok-text">
          <Icon name="check" size={18} />
          {status.text}
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="error">
          {status.text}
        </p>
      )}
    </section>
  );
}
