// What a person's results emphasise for their goal, and the one coaching line
// written in that goal's tone (planning/v1/02 §5.1, the "Results emphasis" and
// "Coaching line" rows; 01 §3.6 "one coaching line from the weakest
// sub-score"). Pure, so every line is tested against the score it sits beside.
// The scores themselves are never touched here: only what is shown first and
// the words.

import { FIXED_CONSTANTS } from "@/lib/analysis/config";
import { analyzeOpenRecording } from "@/lib/analysis/session";
import { formatScore, isTransitionScores, scoreWord, type ScoreBand } from "@/lib/domain/scores";
import type { BreathGoal, SessionSummary } from "@/lib/domain/types";
import { calmLine, capital, word, type Professional } from "../home/tailor";

/** The parts of a session the results read: a saved summary or one just built from a recording. */
export type ResultsSession = Pick<SessionSummary, "mode" | "durationSec" | "scores" | "pacerHalfCycleSec" | "paced" | "open">;

/** One pacer turn, as much of it as the line needs to say which breaths were off. */
export interface TurnPoints {
  readonly phase: "inhale" | "exhale";
  readonly missed: boolean;
  readonly double: boolean;
  readonly timingPoints: number;
  readonly depthPoints: number;
}

export interface ResultsEmphasis {
  goal: BreathGoal | null;
  /** Train (and no goal yet): every number. Focus: the headline and the share on target. Calm: the headline, its word and one tip. */
  density: "full" | "focused" | "minimal";
  /** The breakdown (sub-scores, which way the breathing leaned, the histogram, the open metrics) shown open, or folded away. */
  detailsOpen: boolean;
  /** Focus: how much of the session was on target (paced) or at a resting rate (open). */
  share: boolean;
  /** Focus, open sessions: the rate in the first part against the last. */
  rateChange: boolean;
  /** Calm: one tip in plain words. */
  tip: boolean;
}

export function resultsEmphasis(goal: BreathGoal | null): ResultsEmphasis {
  switch (goal) {
    case "focus":
      return {
        goal,
        density: "focused",
        detailsOpen: false,
        share: true,
        rateChange: true,
        tip: false,
      };
    case "calm":
      return {
        goal,
        density: "minimal",
        detailsOpen: false,
        share: false,
        rateChange: false,
        tip: true,
      };
    default:
      return {
        goal,
        density: "full",
        detailsOpen: true,
        share: false,
        rateChange: false,
        tip: false,
      };
  }
}

const RATE = FIXED_CONSTANTS.normalRateBpm;

/** The word beside an open session's rate, the same words the review uses. */
export function rateWord(rateBpm: number): string {
  if (rateBpm > RATE.max) return "Faster than normal";
  if (rateBpm < RATE.min) return "Slower than normal";
  return "In the normal range";
}

/**
 * How the session went, in the score's own bands: a paced session by its
 * Total's band; an open one by its rate (at or under the normal range is
 * calm, a little over is middling, well over is not). Null when there is
 * nothing to grade.
 */
export function grade(session: ResultsSession): ScoreBand | null {
  if (isTransitionScores(session.scores)) return scoreWord(session.scores.total).band;
  const rate = session.open?.whole?.rateBpm;
  if (session.mode !== "open" || rate === undefined) return null;
  return rate <= RATE.max ? "ok" : rate <= RATE.max + 4 ? "mid" : "low";
}

export interface WeakestPart {
  measure: "timing" | "depth";
  phase: "inhale" | "exhale";
  score: number;
  /** Mean lean in SD: below zero is early or shallower, above is late or deeper. Null when not measured. */
  lean: number | null;
}

/** The lowest of the four sub-scores (01 §3.6); on a tie, timing before depth and the inhale before the exhale. */
export function weakestPart(session: ResultsSession): WeakestPart | null {
  const s = session.scores;
  if (!isTransitionScores(s)) return null;
  let weakest: WeakestPart | null = null;
  for (const measure of ["timing", "depth"] as const) {
    for (const phase of ["inhale", "exhale"] as const) {
      const score = s[measure][phase];
      if (weakest === null || score < weakest.score) {
        weakest = {
          measure,
          phase,
          score,
          lean: session.paced?.direction[measure][phase] ?? null,
        };
      }
    }
  }
  return weakest;
}

const PARTS = { inhale: "breaths in", exhale: "breaths out" } as const;
const LABEL = { timing: "timing", depth: "depth" } as const;

/** The lean in the units a person reads: seconds for timing, % of max for depth. */
function leanAmount(part: WeakestPart, halfCycleS: number): number | null {
  if (part.lean === null) return null;
  const amount =
    part.measure === "timing"
      ? part.lean * FIXED_CONSTANTS.timingSdBreathFraction * 2 * halfCycleS
      : part.lean * FIXED_CONSTANTS.depthSdPctOfMax;
  return Math.abs(amount) < (part.measure === "timing" ? 0.05 : 0.1) ? null : amount;
}

/** Train's numbers sentence about the weakest part, e.g. "You cut breaths out short by 0.4 s". */
function leanSentence(part: WeakestPart, halfCycleS: number): string {
  const amount = leanAmount(part, halfCycleS);
  const who = PARTS[part.phase];
  if (amount === null) {
    return part.measure === "timing"
      ? `Your ${who} were early and late about equally; turn with the pacer`
      : `Your ${who} were shallower and deeper about equally; match the pacer's size`;
  }
  const n = Math.abs(amount).toFixed(1);
  if (part.measure === "timing") return amount < 0 ? `You cut ${who} short by ${n} s` : `You held ${who} ${n} s past the turn`;
  return `${capital(who)} were ${n}% of max ${amount < 0 ? "shallower" : "deeper"} than the pacer`;
}

/**
 * The longest run of three or more breaths in a row whose points for the weak
 * part were under 7 (or were missed), as "breaths 4 to 9". Breaths are
 * counted per phase: the fourth breath out is the fourth exhale turn.
 */
export function weakRun(turns: readonly TurnPoints[], part: Pick<WeakestPart, "measure" | "phase">): { from: number; to: number } | null {
  const weak = turns
    .filter((t) => t.phase === part.phase)
    .map((t) => t.missed || t.double || (part.measure === "timing" ? t.timingPoints : t.depthPoints) < 7);
  let best: { from: number; to: number } | null = null;
  let start = -1;
  for (let i = 0; i <= weak.length; i++) {
    if (i < weak.length && weak[i]) {
      if (start < 0) start = i;
      continue;
    }
    if (start >= 0 && i - start >= 3 && (best === null || i - start > best.to - best.from + 1)) best = { from: start + 1, to: i };
    start = -1;
  }
  return best;
}

/**
 * One tip in plain words, from the weakest part (Calm's "one tip", and Focus
 * when the session wasn't a good one). No numbers.
 */
export function tipFor(session: ResultsSession): string {
  if (session.mode === "open") {
    const rate = session.open?.whole?.rateBpm;
    if (rate === undefined) return "Next time, keep the band snug and breathe as you normally would.";
    return rate > RATE.max ? "Next time, try a slower, longer breath out." : "Same again next time.";
  }
  const part = weakestPart(session);
  if (!part) return "Next time, follow the pacer as closely as feels easy.";
  if (part.score >= 9) return "Same again next time.";
  const amount = leanAmount(part, session.pacerHalfCycleSec ?? 5);
  if (part.measure === "timing") {
    if (amount === null) return "Next time, follow the pacer's turns a little more closely.";
    if (amount > 0) return "Next time, turn with the pacer a little sooner.";
    return part.phase === "exhale"
      ? "Next time, let each breath out run until the pacer turns."
      : "Next time, keep breathing in until the pacer turns.";
  }
  if (amount === null) return "Next time, match the pacer's size a little more closely.";
  if (amount > 0) return "Next time, keep each breath a little softer.";
  return part.phase === "inhale"
    ? "Next time, breathe in a little fuller, into your belly."
    : "Next time, let a little more air out on each breath.";
}

/** "Three minutes", "One minute", "32 seconds". */
function lengthOf(durationSec: number): { count: string; unit: string } {
  if (durationSec < 60) return { count: String(Math.round(durationSec)), unit: "seconds" };
  const m = Math.round(durationSec / 60);
  return { count: capital(word(m)), unit: m === 1 ? "minute" : "minutes" };
}

/** Focus's share of the session on target: the mean of the timing and depth on-target shares, as a whole percent. */
export function onTargetShare(session: ResultsSession): number | null {
  const p = session.paced;
  return p ? Math.round((p.onTargetPct.timing + p.onTargetPct.depth) / 2) : null;
}

/**
 * The breathing rate in the first third of an open recording against the last
 * third (01 §1 Focus: "seeing their rate drop during one session, 17 → 12").
 * Null when the session is too short for each third to hold 20 seconds, or a
 * third has too few breaths to measure.
 */
export function rateChange(pct: readonly number[], hz: number): { from: number; to: number } | null {
  const third = Math.floor(pct.length / 3);
  if (third < 20 * hz) return null;
  try {
    const first = analyzeOpenRecording(pct.slice(0, third), hz).whole.metrics;
    const last = analyzeOpenRecording(pct.slice(pct.length - third), hz).whole.metrics;
    return first && last ? { from: Math.round(first.rateBpm), to: Math.round(last.rateBpm) } : null;
  } catch {
    return null;
  }
}

export interface CoachingInput {
  goal: BreathGoal | null;
  session: ResultsSession;
  /** Days in a row with a session, this one included. */
  streakDays: number;
  /** The person's professional, when they came through one; a clinician's client never hears about streaks. */
  professional?: Professional | null;
  /** Per-turn points of a paced session, to name the breaths that were off (Train). */
  turns?: readonly TurnPoints[] | null;
  /** Open sessions: the rate at the start and the end (Focus). */
  rates?: { from: number; to: number } | null;
}

export interface Coaching {
  /** The one coaching line, or null when the session has nothing to speak from (an old-style score). */
  line: string | null;
  /** Calm's one tip, null for the other goals. */
  tip: string | null;
}

/** Train (and no goal): numbers first, the weakest part's own number, the breaths it went wrong on. */
function trainLine(session: ResultsSession, turns: readonly TurnPoints[] | null | undefined): string | null {
  if (session.mode === "open") {
    const m = session.open?.whole;
    if (!m) return "Fewer than three breaths found, so there is nothing to measure yet.";
    const rate = Math.round(m.rateBpm);
    const where = m.rateBpm > RATE.max ? "above" : m.rateBpm < RATE.min ? "below" : "inside";
    return `Rate ${rate} br/min, ${where} the normal ${RATE.min}–${RATE.max}. In to out 1 : ${m.ieRatio.toFixed(1)}; 1 : 2 is typical.`;
  }
  const s = session.scores;
  const part = weakestPart(session);
  if (!isTransitionScores(s) || !part) return null;
  if (part.score >= 9) return `Total ${formatScore(s.total)}. Every part at 9 or above.`;
  const run = turns ? weakRun(turns, part) : null;
  const where = run ? `, most of all on ${part.phase === "inhale" ? "breaths in" : "breaths out"} ${run.from} to ${run.to}` : "";
  const label = `${capital(part.phase)} ${LABEL[part.measure]}`;
  return `${label} ${formatScore(part.score)}. ${leanSentence(part, session.pacerHalfCycleSec ?? 5)}${where}.`;
}

/** Focus: how long, how calm, and the number that shows it (on target, or the rate falling). */
function focusLine(session: ResultsSession, band: ScoreBand | null, rates: CoachingInput["rates"]): string | null {
  const { count, unit } = lengthOf(session.durationSec);
  const calm = `${count} calm ${unit}`;
  const done = `${count} ${unit} done`;
  if (session.mode === "open") {
    const m = session.open?.whole;
    if (!m) return `${done}. Too few breaths to measure this time.`;
    if (rates && rates.to < rates.from) {
      return `${rates.to <= RATE.max ? calm : done}. Rate dropped from ${rates.from} to ${rates.to}.`;
    }
    const rate = Math.round(m.rateBpm);
    if (rates && rates.to > rates.from) return `${done}. Rate rose from ${rates.from} to ${rates.to}. ${tipFor(session)}`;
    return m.rateBpm <= RATE.max ? `${calm}, at ${rate} breaths a minute.` : `${done}, at ${rate} breaths a minute. ${tipFor(session)}`;
  }
  if (band === null) return null;
  const share = onTargetShare(session);
  const on = share === null ? "" : `on target ${share}% of the time`;
  if (band === "ok") return share === null ? `${calm}.` : `${calm}. ${capital(on)}.`;
  return `${done}${on ? `, ${on}` : ""}. ${tipFor(session)}`;
}

/** Calm: showing up is the point. Praise only a good session; never a streak for a clinician's client. */
function calmToneLine(band: ScoreBand | null, streakDays: number, professional: Professional | null | undefined): string {
  if (professional?.kind === "clinician") return `Done for today. ${professional.name.split(" ")[0]} will see this before your next visit.`;
  if (band === "ok") return calmLine({ streakDays, doneToday: true, minutes: 0, streak: true });
  return streakDays >= 2 ? `Done. ${capital(word(streakDays))} days in a row.` : "Done for today.";
}

/** The coaching line in the goal's tone (02 §5.1), and Calm's one tip. */
export function coaching({ goal, session, streakDays, professional, turns, rates }: CoachingInput): Coaching {
  const band = grade(session);
  switch (goal) {
    case "calm":
      return {
        line: calmToneLine(band, streakDays, professional),
        tip: tipFor(session),
      };
    case "focus":
      return { line: focusLine(session, band, rates), tip: null };
    default:
      return { line: trainLine(session, turns), tip: null };
  }
}
