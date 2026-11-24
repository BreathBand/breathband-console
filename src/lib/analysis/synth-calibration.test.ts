import { describe, expect, it } from "vitest";
import { CALIBRATION_EXTREMES_COUNT, generateCalibration } from "./synth";

const EPS = 1e-9;
const scale = { a100: 2.2, midline: 2.3 };

function peakSamples(values: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1] && values[i] > values[i + 1]) out.push(values[i]);
  }
  return out;
}

function mean(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

describe("generateCalibration sample grid", () => {
  it("throws a RangeError naming the rate and the first off-grid knot at 12.5 Hz with the default timings", () => {
    const run = () => generateCalibration({ ...scale, sampleRateHz: 12.5 });
    expect(run).toThrow(RangeError);
    expect(run).toThrow(/knot at 5 s/);
    expect(run).toThrow(/12\.5 Hz/);
  });

  it("names the first off-grid knot when only a later knot misses the grid", () => {
    const run = () => generateCalibration({ ...scale, sampleRateHz: 4, inhaleS: 2, exhaleS: 2.1, restS: 1 });
    expect(run).toThrow(RangeError);
    expect(run).toThrow(/knot at 5\.1 s/);
    expect(run).toThrow(/4 Hz/);
  });

  it("accepts timings that land on the grid at a non-integer rate", () => {
    const rec = generateCalibration({ ...scale, sampleRateHz: 12.5, inhaleS: 2, exhaleS: 4, restS: 2 });
    expect(rec.raw).toHaveLength(rec.t.length);
  });

  it("rejects a non-positive sample rate", () => {
    expect(() => generateCalibration({ ...scale, sampleRateHz: 0 })).toThrow(RangeError);
  });

  it("matches expectedA100 and expectedMidline from the rendered raw samples at 20 Hz", () => {
    const rec = generateCalibration({ ...scale, sampleRateHz: 20 });
    const highs = peakSamples(rec.raw)
      .sort((a, b) => b - a)
      .slice(0, CALIBRATION_EXTREMES_COUNT);
    const lows = peakSamples(rec.raw.map((v) => -v))
      .map((v) => -v)
      .sort((a, b) => a - b)
      .slice(0, CALIBRATION_EXTREMES_COUNT);
    expect(highs).toHaveLength(CALIBRATION_EXTREMES_COUNT);
    expect(lows).toHaveLength(CALIBRATION_EXTREMES_COUNT);
    const highest = mean(highs);
    const lowest = mean(lows);
    expect(Math.abs(highest - lowest - rec.expectedA100)).toBeLessThan(EPS);
    expect(Math.abs((highest + lowest) / 2 - rec.expectedMidline)).toBeLessThan(EPS);
    expect(Math.abs(highs[0] - Math.max(...rec.raw))).toBeLessThan(EPS);
    expect(Math.abs(lows[0] - Math.min(...rec.raw))).toBeLessThan(EPS);
  });
});
