import type { SkillLevel } from "./config";
import { analyzeOpen, type OpenResult } from "./open";
import { scorePaced, type PacedResult } from "./paced";
import { detectTransitions } from "./transitions";

export interface PacedRecordingOptions {
  readonly halfCycleS: number;
  readonly skillLevel: SkillLevel;
}

/**
 * Scores a paced recording end to end: transitions detected on the low-passed
 * signal (Appendix l.15–16), then method C against a pacer whose first inhale
 * starts at the first sample.
 */
export function analyzePacedRecording(
  pctSamples: readonly number[],
  sampleRateHz: number,
  options: PacedRecordingOptions,
): PacedResult {
  const transitions = detectTransitions(pctSamples, sampleRateHz).map((t) => ({ t: t.t, type: t.type, level: t.level }));
  return scorePaced(transitions, {
    halfCycleS: options.halfCycleS,
    durationS: pctSamples.length / sampleRateHz,
    skillLevel: options.skillLevel,
  });
}

/** Open-session metrics for a recording, with up to two event markers given as sample indices. */
export function analyzeOpenRecording(
  pctSamples: readonly number[],
  sampleRateHz: number,
  markerIndices: readonly number[] = [],
): OpenResult {
  return analyzeOpen(pctSamples, sampleRateHz, markerIndices);
}
