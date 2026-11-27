import type { SkillLevel } from "./config";
import { analyzeOpen, refineTransitions, type OpenResult } from "./open";
import { scorePaced, type PacedResult } from "./paced";
import { detectTransitions } from "./transitions";

export interface PacedRecordingOptions {
  readonly halfCycleS: number;
  readonly skillLevel: SkillLevel;
}

/**
 * Scores a paced recording end to end: transitions detected on the low-passed
 * signal (Appendix l.15–16) and located on the raw signal, as open sessions are
 * (decision 8, reading (b), confirmed 2026-11-27), then method C against a pacer
 * whose first inhale starts at the first sample.
 */
export function analyzePacedRecording(
  pctSamples: readonly number[],
  sampleRateHz: number,
  options: PacedRecordingOptions,
): PacedResult {
  const detected = detectTransitions(pctSamples, sampleRateHz);
  const transitions = refineTransitions(pctSamples, sampleRateHz, detected).map((t) => ({ t: t.t, type: t.type, level: t.level }));
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
