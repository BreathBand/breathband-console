import type { SessionScores, SessionSummary, TransitionScores } from "./types";
import { OPEN_CONSTANTS } from "../analysis/config";

export type Scores = NonNullable<SessionSummary["scores"]>;

export function isTransitionScores(scores: SessionSummary["scores"]): scores is TransitionScores {
  return scores !== null && "total" in scores;
}

export function isLegacyScores(scores: SessionSummary["scores"]): scores is SessionScores {
  return scores !== null && "overall" in scores;
}

/** Status colour behind a score: good, middling or needs work. */
export type ScoreBand = "ok" | "mid" | "low";

// Proposed words for the 1–10 scale (the client hasn't confirmed them yet).
const WORDS: { min: number; word: string; band: ScoreBand }[] = [
  { min: 9, word: "Excellent", band: "ok" },
  { min: 7, word: "Good", band: "ok" },
  { min: 5, word: "Fair", band: "mid" },
  { min: 3, word: "Building", band: "low" },
  { min: -Infinity, word: "Starting out", band: "low" },
];

/** Word and colour band for a 1–10 score. */
export function scoreWord(score: number): { word: string; band: ScoreBand } {
  const { word, band } = WORDS.find((w) => score >= w.min)!;
  return { word, band };
}

/** Whole numbers by default; one decimal only when averaging produced one (7.5 stays 7.5, 6.0 shows 6). */
export function formatScore(score: number): string {
  const tenths = Math.round(score * 10);
  return tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1);
}

/** Colour band for a legacy 0–100% score. */
export function legacyBand(percent: number): ScoreBand {
  return percent >= 70 ? "ok" : percent >= 50 ? "mid" : "low";
}

/** The one number that represents a session in lists and trends. */
export type Headline =
  | { kind: "transition"; value: number; text: string; word: string; band: ScoreBand }
  | { kind: "legacy"; value: number; text: string; band: ScoreBand }
  | { kind: "rate"; value: number | null; text: string };

export function headline(session: Pick<SessionSummary, "scores" | "respirationRateBpm">): Headline {
  const { scores } = session;
  if (isTransitionScores(scores)) {
    return { kind: "transition", value: scores.total, text: formatScore(scores.total), ...scoreWord(scores.total) };
  }
  if (isLegacyScores(scores)) {
    return { kind: "legacy", value: scores.overall, text: `${Math.round(scores.overall)}%`, band: legacyBand(scores.overall) };
  }
  const rate = session.respirationRateBpm;
  return { kind: "rate", value: rate, text: rate === null ? "–" : `${Math.round(rate)}` };
}

export function combineTransitionScores(
  timing: TransitionScores["timing"],
  depth: TransitionScores["depth"],
): number {
  const w = OPEN_CONSTANTS.totalBreathScoreWeights;
  const total =
    w.timingIn * timing.inhale + w.timingEx * timing.exhale + w.depthIn * depth.inhale + w.depthEx * depth.exhale;
  return Math.round(total * 10) / 10;
}
