import { describe, expect, it } from "vitest";
import { calibrationProgress, CALIBRATION_BREATHS } from "./calibrationProgress";
import { generateCalibration } from "./synth";

const RATE = 20;
const scale = { a100: 900, midline: 2050 };

describe("calibrationProgress", () => {
  const rec = generateCalibration({ ...scale, sampleRateHz: RATE });

  it("counts deep breaths as they come and waits for five", () => {
    const partial = rec.raw.slice(0, Math.round(rec.raw.length * 0.45));
    const p = calibrationProgress(partial, RATE, 15);
    expect(p.breaths).toBeGreaterThan(0);
    expect(p.breaths).toBeLessThan(CALIBRATION_BREATHS);
    expect(p.result).toBeNull();
  });

  it("calibrates once all five are in, to the recording's scale", () => {
    const p = calibrationProgress(rec.raw, RATE, 40);
    expect(p.breaths).toBe(CALIBRATION_BREATHS);
    expect(p.result?.a100).toBeCloseTo(rec.expectedA100, 0);
    expect(p.result?.midline).toBeCloseTo(rec.expectedMidline, 0);
  });

  it("accepts three deep breaths after 50 seconds", () => {
    const three = rec.raw.slice(0, Math.round(rec.raw.length * 0.66));
    expect(calibrationProgress(three, RATE, 20).result).toBeNull();
    expect(calibrationProgress(three, RATE, 55).result).not.toBeNull();
  });

  it("needs a few seconds of signal before it counts anything", () => {
    expect(calibrationProgress(rec.raw.slice(0, RATE * 2), RATE, 2)).toEqual({ breaths: 0, result: null });
  });
});
