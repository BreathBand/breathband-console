import { calibrate, type Calibration } from "./calibration";
import { filtfilt } from "./filter";
import { findExtrema } from "./transitions";

/** Harry's rule: full breaths for 20 seconds, each time the band goes on. */
export const CALIBRATION_WINDOW_S = 20;
/** Fewer full breaths than this in the window, and the run is rejected. */
export const CALIBRATION_MIN_BREATHS = 3;
/** A full breath is at least this share of the biggest swing seen so far. */
const DEEP_SHARE = 0.35;

export interface CalibrationProgress {
  /** Full breaths seen so far. */
  breaths: number;
  /** Seconds left in the window, never below 0. */
  remainingS: number;
  /** Set once the window is over and the Appendix calibration succeeds. */
  result: Calibration | null;
  /** The window is over without enough full breaths: ask for another run. */
  failed: boolean;
}

/**
 * Where a live calibration stands: how many full breaths have been taken, how
 * long is left, and the calibration once the 20 seconds are up (with at least
 * three full breaths). The recorder calls this about once a second with every
 * raw sample since it asked the band to calibrate.
 */
export function calibrationProgress(raw: readonly number[], sampleRateHz: number, elapsedS: number): CalibrationProgress {
  const remainingS = Math.max(0, CALIBRATION_WINDOW_S - elapsedS);
  const done = remainingS === 0;
  const breaths = raw.length < 4 * sampleRateHz ? 0 : countFullBreaths(raw, sampleRateHz);
  if (!done) return { breaths, remainingS, result: null, failed: false };
  if (breaths < CALIBRATION_MIN_BREATHS) return { breaths, remainingS, result: null, failed: true };
  const result = calibrate(raw, sampleRateHz);
  const ok = result && result.a100 > 0;
  return { breaths, remainingS, result: ok ? result : null, failed: !ok };
}

function countFullBreaths(raw: readonly number[], sampleRateHz: number): number {
  const filtered = filtfilt(raw, sampleRateHz);
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of filtered) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return findExtrema(filtered, sampleRateHz, { minProminence: (hi - lo) * DEEP_SHARE }).filter((e) => e.type === "peak").length;
}
