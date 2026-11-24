import { describe, expect, it } from "vitest";
import { calibrate, calibrationFromLegacy, toPctOfMax } from "./calibration";
import { FIXED_CONSTANTS } from "./config";
import * as analysis from "./index";
import { generateCalibration, toRaw } from "./synth";
import { detectTransitions } from "./transitions";

const FS = 20;
const SCALE = { a100: 2000, midline: 512 };
const TOLERANCE_FRACTION = 0.005;
const PCT_TOLERANCE = 0.5;

function mean(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function twoBreaths(restS: number, cycleS: number, depthPct: number): number[] {
  const rest = new Array<number>(Math.round(restS * FS)).fill(0);
  const breaths = Array.from({ length: Math.round(2 * cycleS * FS) }, (_, i) =>
    depthPct * Math.sin((2 * Math.PI * i) / (cycleS * FS)),
  );
  return [...rest, ...breaths, ...rest];
}

describe("calibrate", () => {
  const recording = generateCalibration({ ...SCALE, sampleRateHz: FS });
  const result = calibrate(recording.raw, FS);

  it("recovers the known A100 and midline within 0.5% of A100", () => {
    expect(result).not.toBeNull();
    if (!result) return;
    const tolerance = TOLERANCE_FRACTION * recording.expectedA100;
    expect(Math.abs(result.a100 - recording.expectedA100)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(result.midline - recording.expectedMidline)).toBeLessThanOrEqual(tolerance);
    expect(result.approximate).toBe(false);
  });

  it("returns exactly 3 peaks and 3 troughs, the most extreme ones, in time order", () => {
    if (!result) throw new Error("calibration failed");
    expect(result.peaks).toHaveLength(FIXED_CONSTANTS.calibrationPeakCount);
    expect(result.troughs).toHaveLength(FIXED_CONSTANTS.calibrationTroughCount);
    expect(FIXED_CONSTANTS.calibrationPeakCount).toBe(3);
    const topPeaks = [...recording.peaks].sort((a, b) => b - a).slice(0, 3);
    const lowTroughs = [...recording.troughs].sort((a, b) => a - b).slice(0, 3);
    const tolerance = TOLERANCE_FRACTION * recording.expectedA100;
    expect(result.peaks.every((p) => p.type === "peak")).toBe(true);
    expect(result.troughs.every((p) => p.type === "trough")).toBe(true);
    for (const p of result.peaks) expect(topPeaks.some((v) => Math.abs(v - p.level) <= tolerance)).toBe(true);
    for (const p of result.troughs) expect(lowTroughs.some((v) => Math.abs(v - p.level) <= tolerance)).toBe(true);
    for (let k = 1; k < 3; k++) {
      expect(result.peaks[k].index).toBeGreaterThan(result.peaks[k - 1].index);
      expect(result.troughs[k].index).toBeGreaterThan(result.troughs[k - 1].index);
    }
  });

  it("puts the calibrated recording's top-3 peaks 100% of max above its bottom-3 troughs", () => {
    if (!result) throw new Error("calibration failed");
    const found = detectTransitions(toPctOfMax(recording.raw, result), FS);
    const peaks = found.filter((tr) => tr.type === "peak").map((tr) => tr.level).sort((a, b) => b - a);
    const troughs = found.filter((tr) => tr.type === "trough").map((tr) => tr.level).sort((a, b) => a - b);
    expect(Math.abs(mean(peaks.slice(0, 3)) - mean(troughs.slice(0, 3)) - 100)).toBeLessThanOrEqual(PCT_TOLERANCE);
  });

  it("works at 10 Hz too", () => {
    const slow = generateCalibration({ ...SCALE, sampleRateHz: 10 });
    const r = calibrate(slow.raw, 10);
    expect(r).not.toBeNull();
    expect(Math.abs((r?.a100 ?? 0) - slow.expectedA100)).toBeLessThanOrEqual(TOLERANCE_FRACTION * slow.expectedA100);
  });

  it("returns null for a two-breath recording", () => {
    const raw = toRaw(twoBreaths(2, 7, 50), SCALE);
    expect(calibrate(raw, FS)).toBeNull();
  });

  it("returns null for an empty or flat recording", () => {
    expect(calibrate([], FS)).toBeNull();
    expect(calibrate(new Array<number>(400).fill(SCALE.midline), FS)).toBeNull();
  });
});

describe("toPctOfMax", () => {
  it("maps (signal - M) / A100 x 100", () => {
    expect(toPctOfMax([512, 1512, -488, 612], SCALE)).toEqual([0, 50, -50, 5]);
  });

  it("rejects a non-positive or non-finite scale", () => {
    expect(() => toPctOfMax([1], { a100: 0, midline: 0 })).toThrow(RangeError);
    expect(() => toPctOfMax([1], { a100: Number.NaN, midline: 0 })).toThrow(/a100/);
    expect(() => toPctOfMax([1], { a100: 1, midline: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });
});

describe("calibrationFromLegacy", () => {
  it("gives A100 = max - min and M = (max + min) / 2, marked approximate", () => {
    expect(calibrationFromLegacy({ min: 200, max: 1000 })).toEqual({
      a100: 800,
      midline: 600,
      peaks: [],
      troughs: [],
      approximate: true,
    });
  });

  it("maps the legacy extremes to +/-50% of max", () => {
    expect(toPctOfMax([200, 1000], calibrationFromLegacy({ min: 200, max: 1000 }))).toEqual([-50, 50]);
  });

  it("is re-exported from the analysis index", () => {
    expect(analysis.calibrate).toBe(calibrate);
    expect(analysis.toPctOfMax).toBe(toPctOfMax);
    expect(analysis.calibrationFromLegacy).toBe(calibrationFromLegacy);
  });
});
