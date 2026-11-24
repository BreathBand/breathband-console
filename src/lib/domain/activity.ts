import { formatScore, isTransitionScores } from "./scores";
import { slopePerWeek } from "./trends";
import {
  DEFAULT_ALERTS,
  DEFAULT_TARGETS,
  type AlertRules,
  type AthleteTargets,
  type SessionSummary,
  type TransitionScores,
} from "./types";

const DAY_MS = 86_400_000;

/** What a coach should look at first. Which ones fire is set by the coach's AlertRules. */
export type Flag = { kind: "missed" | "down" | "target" | "trend" | "rate"; text: string };

export interface Activity {
  newest: SessionSummary | null;
  /** Whole days since the newest session, or null if there are none. */
  daysSince: number | null;
  /** Sessions in the 7 days before `now`. */
  lastWeek: number;
  /** Newest first: sessions scored on the 1–10 scale. */
  scored: (SessionSummary & { scores: TransitionScores })[];
  flags: Flag[];
}

/** Summarises an athlete's sessions (newest first, as `listSessions` returns them). */
export function activity(
  sessions: SessionSummary[],
  now: Date,
  rules: AlertRules = DEFAULT_ALERTS,
  targets: AthleteTargets = DEFAULT_TARGETS,
): Activity {
  const newest = sessions[0] ?? null;
  const age = (s: SessionSummary) => now.getTime() - Date.parse(s.startedAt);
  const daysSince = newest ? Math.max(0, Math.floor(age(newest) / DAY_MS)) : null;
  const lastWeek = sessions.filter((s) => age(s) < 7 * DAY_MS).length;
  const scored = sessions.filter((s): s is SessionSummary & { scores: TransitionScores } =>
    isTransitionScores(s.scores),
  );

  const flags: Flag[] = [];
  if (rules.missedDays !== null && daysSince !== null && daysSince >= rules.missedDays) {
    flags.push({ kind: "missed", text: `${daysSince} days since the last session` });
  }

  const [latest, ...older] = scored.map((s) => s.scores.total);
  const before = older.slice(0, 5);
  if (rules.scoreDrop !== null && latest !== undefined && before.length >= 3) {
    const drop = before.reduce((a, b) => a + b, 0) / before.length - latest;
    if (drop >= rules.scoreDrop) flags.push({ kind: "down", text: `Score down ${formatScore(drop)} on their average` });
  }

  const lastFive = scored.slice(0, 5);
  if (rules.belowTarget !== null && lastFive.length >= 3) {
    const under = lastFive.filter((s) => s.scores.total < targets.score).length;
    if (under >= rules.belowTarget) {
      flags.push({
        kind: "target",
        text: `${under} of the last ${lastFive.length} under their target of ${formatScore(targets.score)}`,
      });
    }
  }

  if (rules.trendingDown) {
    const recent = scored.filter((s) => age(s) < 21 * DAY_MS);
    const slope = slopePerWeek(recent.map((s) => ({ t: Date.parse(s.startedAt), v: s.scores.total })));
    if (recent.length >= 4 && slope !== null && slope <= -0.5) {
      flags.push({ kind: "trend", text: `Scores falling for 3 weeks (${formatScore(slope)} a week)` });
    }
  }

  if (rules.rateOutOfRange) {
    const open = sessions.find((s) => s.mode === "open" && s.respirationRateBpm !== null && age(s) < 14 * DAY_MS);
    const rate = open?.respirationRateBpm;
    if (rate != null && (rate < targets.rateLow || rate > targets.rateHigh)) {
      flags.push({
        kind: "rate",
        text: `Breathing rate ${rate}/min, ${rate > targets.rateHigh ? "above" : "below"} their ${targets.rateLow}–${targets.rateHigh} range`,
      });
    }
  }

  return { newest, daysSince, lastWeek, scored, flags };
}

/** "Today", "Yesterday", "4 days ago". */
export function daysAgoText(days: number): string {
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}
