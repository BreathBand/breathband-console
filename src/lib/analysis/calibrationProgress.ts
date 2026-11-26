import { calibrate, type Calibration } from "./calibration";
import { filtfilt } from "./filter";
import { findExtrema } from "./transitions";

/** Five deep breaths are asked for; three are enough once enough time has passed. */
export const CALIBRATION_BREATHS = 5;
export const CALIBRATION_MIN_BREATHS = 3;
const MIN_BREATHS_AFTER_S = 50;
/** A deep breath is at least this share of the biggest swing seen so far. */
const DEEP_SHARE = 0.35;

export interface CalibrationProgress {
  /** Deep breaths seen so far, capped at CALIBRATION_BREATHS. */
  breaths: number;
  /** Set once there are enough deep breaths and the Appendix calibration succeeds. */
  result: Calibration | null;
}

/**
 * Where a live calibration stands: how many deep breaths have been taken, and
 * the calibration once there are five (or three after 50 s). The recorder
 * calls this about once a second with every raw sample since it asked the band
 * to calibrate.
 */
export function calibrationProgress(raw: readonly number[], sampleRateHz: number, elapsedS: number): CalibrationProgress {
  if (raw.length < 4 * sampleRateHz) return { breaths: 0, result: null };
  const filtered = filtfilt(raw, sampleRateHz);
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of filtered) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const peaks = findExtrema(filtered, sampleRateHz, { minProminence: (hi - lo) * DEEP_SHARE }).filter((e) => e.type === "peak").length;
  const breaths = Math.min(peaks, CALIBRATION_BREATHS);
  const enough = peaks >= CALIBRATION_BREATHS || (peaks >= CALIBRATION_MIN_BREATHS && elapsedS > MIN_BREATHS_AFTER_S);
  if (!enough) return { breaths, result: null };
  const result = calibrate(raw, sampleRateHz);
  return { breaths, result: result && result.a100 > 0 ? result : null };
}
