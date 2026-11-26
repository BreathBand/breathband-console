import { describe, expect, it } from "vitest";
import { calibrationProgress, CALIBRATION_MIN_BREATHS, CALIBRATION_WINDOW_S } from "./calibrationProgress";
import { generateCalibration } from "./synth";

const RATE = 20;
const scale = { a100: 900, midline: 2050 };

describe("calibrationProgress", () => {
  const rec = generateCalibration({ ...scale, sampleRateHz: RATE });
  const firstSeconds = (s: number) => rec.raw.slice(0, Math.round(s * RATE));

  it("counts full breaths during the 20 seconds and waits for the window to end", () => {
    const p = calibrationProgress(firstSeconds(15), RATE, 15);
    expect(p.breaths).toBeGreaterThan(0);
    expect(p.remainingS).toBeCloseTo(CALIBRATION_WINDOW_S - 15);
    expect(p.result).toBeNull();
    expect(p.failed).toBe(false);
  });

  it("calibrates when the window is over, to the recording's scale", () => {
    const p = calibrationProgress(rec.raw, RATE, CALIBRATION_WINDOW_S + 20);
    expect(p.breaths).toBeGreaterThanOrEqual(CALIBRATION_MIN_BREATHS);
    expect(p.remainingS).toBe(0);
    expect(p.failed).toBe(false);
    expect(p.result?.a100).toBeCloseTo(rec.expectedA100, 0);
    expect(p.result?.midline).toBeCloseTo(rec.expectedMidline, 0);
  });

  it("doesn't calibrate early, even with enough breaths", () => {
    const p = calibrationProgress(rec.raw, RATE, CALIBRATION_WINDOW_S - 1);
    expect(p.breaths).toBeGreaterThanOrEqual(CALIBRATION_MIN_BREATHS);
    expect(p.result).toBeNull();
  });

  it("rejects a window with fewer than three full breaths", () => {
    const short = firstSeconds(10);
    const p = calibrationProgress(short, RATE, CALIBRATION_WINDOW_S);
    expect(p.breaths).toBeLessThan(CALIBRATION_MIN_BREATHS);
    expect(p.result).toBeNull();
    expect(p.failed).toBe(true);
  });

  it("needs a few seconds of signal before it counts anything", () => {
    expect(calibrationProgress(firstSeconds(2), RATE, 2)).toEqual({ breaths: 0, remainingS: CALIBRATION_WINDOW_S - 2, result: null, failed: false });
  });
});
