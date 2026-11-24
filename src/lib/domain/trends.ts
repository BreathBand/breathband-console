import { formatDay } from "./format";
import { formatScore, isTransitionScores } from "./scores";
import type { AthleteTargets, SessionSummary, TransitionScores } from "./types";

// Trends over a chosen period: the numbers behind the Trends tab, the
// comparison page and the progress report, plus the plain-words summary.

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export const RANGES = [
  { days: 7, label: "7 days", short: "week" },
  { days: 30, label: "30 days", short: "month" },
  { days: 90, label: "90 days", short: "3 months" },
  { days: 182, label: "6 months", short: "6 months" },
] as const;
export type RangeDays = (typeof RANGES)[number]["days"];

export const rangeLabel = (days: number) => RANGES.find((r) => r.days === days)?.label ?? `${days} days`;

/** Sessions in the `days` before `now`, or in the period before that with `offset` 1. */
export function inPeriod(sessions: SessionSummary[], now: Date, days: number, offset = 0): SessionSummary[] {
  const end = now.getTime() - offset * days * DAY_MS;
  const start = end - days * DAY_MS;
  return sessions.filter((s) => {
    const t = Date.parse(s.startedAt);
    return t >= start && t < end;
  });
}

type Scored = SessionSummary & { scores: TransitionScores };
const isScored = (s: SessionSummary): s is Scored => isTransitionScores(s.scores);
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Least-squares slope of values over time, in units per week. Null for fewer than 3 points. */
export function slopePerWeek(points: { t: number; v: number }[]): number | null {
  if (points.length < 3) return null;
  const mt = mean(points.map((p) => p.t))!;
  const mv = mean(points.map((p) => p.v))!;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - mt) * (p.v - mv);
    den += (p.t - mt) ** 2;
  }
  return den === 0 ? null : round1((num / den) * WEEK_MS);
}

export interface PeriodStats {
  count: number;
  minutes: number;
  scoredCount: number;
  /** Mean Total Breath Score of scored sessions. */
  average: number | null;
  best: Scored | null;
  /** Scored sessions at or above the score target. */
  onTarget: number;
  /** The sub-score with the lowest mean, e.g. "exhale timing". */
  weakest: { label: string; value: number } | null;
  openCount: number;
  rateAverage: number | null;
  /** Open sessions with a rate outside the target range. */
  rateOutside: number;
  perWeek: number;
}

export function periodStats(sessions: SessionSummary[], days: number, targets: AthleteTargets): PeriodStats {
  const scored = sessions.filter(isScored);
  const open = sessions.filter((s) => s.mode === "open" && s.respirationRateBpm !== null);
  const parts: [string, (s: Scored) => number][] = [
    ["inhale timing", (s) => s.scores.timing.inhale],
    ["exhale timing", (s) => s.scores.timing.exhale],
    ["inhale depth", (s) => s.scores.depth.inhale],
    ["exhale depth", (s) => s.scores.depth.exhale],
  ];
  const weakest = scored.length
    ? parts
        .map(([label, get]) => ({ label, value: round1(mean(scored.map(get))!) }))
        .sort((a, b) => a.value - b.value)[0]
    : null;
  const avg = mean(scored.map((s) => s.scores.total));
  const rates = open.map((s) => s.respirationRateBpm!);
  return {
    count: sessions.length,
    minutes: Math.round(sessions.reduce((n, s) => n + s.durationSec, 0) / 60),
    scoredCount: scored.length,
    average: avg === null ? null : round1(avg),
    best: scored.reduce<Scored | null>((b, s) => (!b || s.scores.total > b.scores.total ? s : b), null),
    onTarget: scored.filter((s) => s.scores.total >= targets.score).length,
    weakest,
    openCount: open.length,
    rateAverage: rates.length ? round1(mean(rates)!) : null,
    rateOutside: rates.filter((r) => r < targets.rateLow || r > targets.rateHigh).length,
    perWeek: round1((sessions.length / days) * 7),
  };
}

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${formatScore(Math.abs(n))}`;

/**
 * The period in a few plain sentences, compared with the period before:
 * what a coach would write at the top of a monthly review.
 */
export function summarize(
  sessions: SessionSummary[],
  now: Date,
  days: number,
  targets: AthleteTargets,
): { current: PeriodStats; previous: PeriodStats; sentences: string[] } {
  const current = periodStats(inPeriod(sessions, now, days), days, targets);
  const previous = periodStats(inPeriod(sessions, now, days, 1), days, targets);
  const span = rangeLabel(days);
  const out: string[] = [];

  if (current.count === 0) {
    out.push(`No sessions in the last ${span}${previous.count ? `, after ${previous.count} in the ${span} before` : ""}.`);
    return { current, previous, sentences: out };
  }

  const diff = current.count - previous.count;
  out.push(
    `${current.count} ${current.count === 1 ? "session" : "sessions"} in the last ${span} (${diff === 0 ? "same as" : `${diff > 0 ? diff + " more than" : -diff + " fewer than"}`} the ${span} before), ${current.minutes} minutes in all: about ${formatScore(current.perWeek)} a week against a target of ${targets.sessionsPerWeek}.`,
  );
  if (current.average !== null) {
    const change = previous.average === null ? "" : ` (${signed(round1(current.average - previous.average))} on the ${span} before)`;
    out.push(
      `Total Breath Score averaged ${formatScore(current.average)}${change}; best ${formatScore(current.best!.scores.total)} on ${formatDay(current.best!.startedAt)}.`,
    );
    out.push(
      `${current.onTarget} of ${current.scoredCount} scored ${current.scoredCount === 1 ? "session" : "sessions"} reached the target of ${formatScore(targets.score)}.`,
    );
    if (current.weakest) {
      out.push(`Weakest part: ${current.weakest.label}, averaging ${formatScore(current.weakest.value)}.`);
    }
  }
  if (current.rateAverage !== null) {
    out.push(
      `Open sessions: breathing rate averaged ${formatScore(current.rateAverage)}/min${current.rateOutside ? `, ${current.rateOutside} outside the ${targets.rateLow}–${targets.rateHigh} range` : `, all inside ${targets.rateLow}–${targets.rateHigh}`}.`,
    );
  }
  return { current, previous, sentences: out };
}

export interface Bucket {
  /** Start of the day or week, epoch ms. */
  start: number;
  end: number;
  sessions: SessionSummary[];
}

/** Days for ranges up to a month, weeks beyond (or as asked), oldest first, ending at `now`. */
export function buckets(
  sessions: SessionSummary[],
  now: Date,
  days: number,
  unit: "day" | "week" = days <= 31 ? "day" : "week",
): Bucket[] {
  const size = unit === "day" ? DAY_MS : WEEK_MS;
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const count = Math.ceil((days * DAY_MS) / size);
  const out: Bucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const b = { start: end.getTime() - (i + 1) * size, end: end.getTime() - i * size, sessions: [] as SessionSummary[] };
    out.push(b);
  }
  for (const s of sessions) {
    const t = Date.parse(s.startedAt);
    const b = out.find((x) => t >= x.start && t < x.end);
    if (b) b.sessions.push(s);
  }
  return out;
}

/** Mean Total Breath Score in a bucket, or null if nothing was scored. */
export const bucketAverage = (b: Bucket) => {
  const v = mean(b.sessions.filter(isScored).map((s) => s.scores.total));
  return v === null ? null : round1(v);
};

/** Mean open-session breathing rate in a bucket. */
export const bucketRate = (b: Bucket) => {
  const v = mean(b.sessions.flatMap((s) => (s.mode === "open" && s.respirationRateBpm !== null ? [s.respirationRateBpm] : [])));
  return v === null ? null : round1(v);
};
