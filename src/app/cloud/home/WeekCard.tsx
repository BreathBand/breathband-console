import type { ReactNode } from "react";
import type { Activity } from "@/lib/domain/activity";
import type { Ring, Streak } from "@/lib/domain/habit";
import { formatScore, isTransitionScores } from "@/lib/domain/scores";
import type { SessionSummary } from "@/lib/domain/types";
import type { Workspace } from "../AthleteWorkspace";
import { weekStart } from "../SessionsTab";
import { pausedLine, trainWeek, type HomeLayout } from "./tailor";
import { HomeSlot } from "./Slots";

const DAY = 86_400_000;

/**
 * The week at a glance, in the goal's emphasis: Train's numbers (sessions
 * against the plan, average rate, which way depth is going), the standard
 * facts, or Calm's habit view (the days and the streak, nothing to compare).
 */
export function WeekCard({
  ws,
  layout,
  activity,
  streak,
  ring,
  dailyMinutes,
}: {
  ws: Workspace;
  layout: HomeLayout;
  activity: Activity;
  /** The streak, from lib/domain/habit.ts. */
  streak: Streak;
  /** Calm's daily ring; null where the layout or the person's switches leave it out. */
  ring: Ring | null;
  dailyMinutes: number;
}) {
  const { sessions, now, targets } = ws;
  const thisWeek = sessions.filter((s) => Date.parse(s.startedAt) >= weekStart(now).getTime()).length;
  const paused = layout.streak && streak.state === "paused";
  // A paused streak is a word, not a zero: no red, no count of what was lost (01 §2.5).
  const streakFact = layout.streak && (
    <Fact label="Streak">
      {paused ? (
        <span className="home-paused">Paused</span>
      ) : (
        <>
          <b className="display">{streak.days}</b> {streak.days === 1 ? "day" : "days"}
        </>
      )}
    </Fact>
  );

  let facts: ReactNode;
  let meta = `${thisWeek} of ${targets.sessionsPerWeek} done`;
  if (layout.week === "train") {
    const w = trainWeek(sessions, now, targets.sessionsPerWeek);
    meta = `${w.done} of ${w.planned} planned`;
    facts = (
      <>
        <Fact label="Average rate">
          <b className="display">{w.avgRate === null ? "–" : formatScore(w.avgRate)}</b> br/min
        </Fact>
        <Fact label="Depth">
          <b className="display">{w.depth === null ? "–" : formatScore(w.depth)}</b>
          {w.depthChange !== null && (
            <span className="home-change">
              {w.depthChange > 0 ? "up" : w.depthChange < 0 ? "down" : "level"}
              {w.depthChange !== 0 && ` ${formatScore(Math.abs(w.depthChange))}`}
            </span>
          )}
        </Fact>
        {streakFact}
      </>
    );
  } else if (layout.week === "habit") {
    facts = (
      <>
        {streakFact}
        <Fact label="This week">
          <b className="display">{thisWeek}</b> of {targets.sessionsPerWeek}
        </Fact>
      </>
    );
  } else {
    const recent5 = activity.scored.slice(0, 5);
    const average = recent5.length ? recent5.reduce((s, x) => s + x.scores.total, 0) / recent5.length : null;
    const lastOpen = sessions.find((s) => s.mode === "open" && s.respirationRateBpm !== null);
    facts = (
      <>
        {streakFact}
        <Fact label="Last 5 paced">
          <b className="display">{average === null ? "–" : formatScore(Math.round(average * 10) / 10)}</b> avg
        </Fact>
        <Fact label="At rest">
          <b className="display">{lastOpen ? formatScore(lastOpen.respirationRateBpm!) : "–"}</b> br/min
        </Fact>
      </>
    );
  }

  return (
    <section className="pane home-week" aria-labelledby="week-h" data-week={layout.week}>
      <div className="pane-h">
        <h2 id="week-h">This week</h2>
        <span className="meta">{meta}</span>
      </div>
      <WeekStrip sessions={sessions} now={now} />
      {/* Parts of this goal's Home: Calm's ring here; Focus's mood and exams when their cards land. */}
      {layout.slots.map((id) => (
        <HomeSlot key={id} id={id} ring={ring} />
      ))}
      <dl className="home-facts">{facts}</dl>
      {layout.week === "train" && <p className="home-small">Last 7 days; depth against the 7 before.</p>}
      {paused && <p className="home-small home-paused-line">{pausedLine(layout.goal, dailyMinutes)}</p>}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Monday to Sunday: a filled dot for each day with a session, today ringed, its best score beneath. */
function WeekStrip({ sessions, now }: { sessions: SessionSummary[]; now: Date }) {
  const monday = weekStart(now);
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY));
  return (
    <ol className="week-strip" aria-label="Sessions this week">
      {days.map((d) => {
        const same = sessions.filter((s) => new Date(s.startedAt).toDateString() === d.toDateString());
        const best = same.reduce<number | null>((m, s) => (isTransitionScores(s.scores) ? Math.max(m ?? 0, s.scores.total) : m), null);
        const today = d.toDateString() === now.toDateString();
        const future = d > now && !today;
        return (
          <li key={d.toISOString()} data-done={same.length > 0 || undefined} data-today={today || undefined} data-future={future || undefined}>
            <span className="ws-day" aria-hidden="true">
              {d.toLocaleDateString(undefined, { weekday: "narrow" })}
            </span>
            <i aria-hidden="true">{same.length > 1 ? same.length : ""}</i>
            <span className="ws-score" aria-hidden="true">
              {best !== null ? formatScore(best) : same.length ? "open" : ""}
            </span>
            <span className="sr-only">
              {d.toLocaleDateString(undefined, { weekday: "long" })}: {same.length ? `${same.length} session${same.length > 1 ? "s" : ""}` : "no session"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
