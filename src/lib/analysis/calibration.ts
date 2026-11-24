import { FIXED_CONSTANTS, OPEN_CONSTANTS, type Range } from "./config";
import { filtfilt } from "./filter";
import { findExtrema, type DetectedTransition } from "./transitions";

export interface Calibration {
  readonly a100: number;
  readonly midline: number;
  readonly peaks: readonly DetectedTransition[];
  readonly troughs: readonly DetectedTransition[];
  readonly approximate: boolean;
}

export type CalibrationScale = Pick<Calibration, "a100" | "midline">;

const PERCENT = 100;

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function span(values: readonly number[]): number {
  let low = Infinity;
  let high = -Infinity;
  for (const v of values) {
    if (v < low) low = v;
    if (v > high) high = v;
  }
  return high - low;
}

function byIndex(found: readonly DetectedTransition[]): DetectedTransition[] {
  return [...found].sort((a, b) => a.index - b.index);
}

export function calibrate(rawSamples: readonly number[], sampleRateHz: number): Calibration | null {
  const filtered = filtfilt(rawSamples, sampleRateHz);
  const minProminence = (span(filtered) * OPEN_CONSTANTS.transitionMinProminencePctOfMax) / PERCENT;
  const extrema = findExtrema(filtered, sampleRateHz, { minProminence });
  const peaks = extrema
    .filter((e) => e.type === "peak")
    .sort((a, b) => b.level - a.level)
    .slice(0, FIXED_CONSTANTS.calibrationPeakCount);
  const troughs = extrema
    .filter((e) => e.type === "trough")
    .sort((a, b) => a.level - b.level)
    .slice(0, FIXED_CONSTANTS.calibrationTroughCount);
  if (peaks.length < FIXED_CONSTANTS.calibrationPeakCount || troughs.length < FIXED_CONSTANTS.calibrationTroughCount) {
    return null;
  }
  const high = mean(peaks.map((p) => p.level));
  const low = mean(troughs.map((t) => t.level));
  return {
    a100: high - low,
    midline: (high + low) / 2,
    peaks: byIndex(peaks),
    troughs: byIndex(troughs),
    approximate: false,
  };
}

export function toPctOfMax(samples: readonly number[], calibration: CalibrationScale): number[] {
  const { a100, midline } = calibration;
  if (!(a100 > 0) || !Number.isFinite(a100) || !Number.isFinite(midline)) {
    throw new RangeError(
      `calibration: a100 must be a positive finite number and midline finite, got a100 ${a100} and midline ${midline}`,
    );
  }
  return samples.map((v) => ((v - midline) / a100) * PERCENT);
}

export function calibrationFromLegacy(legacy: Range): Calibration {
  return {
    a100: legacy.max - legacy.min,
    midline: (legacy.max + legacy.min) / 2,
    peaks: [],
    troughs: [],
    approximate: true,
  };
}
