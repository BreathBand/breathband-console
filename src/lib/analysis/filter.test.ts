import { describe, expect, it } from "vitest";
import { FIXED_CONSTANTS } from "./config";
import { butterworthLowPass, filtfilt, type LowPassSpec } from "./filter";
import * as analysis from "./index";

const DURATION_S = 60;
const MIDDLE = { fromS: 15, toS: 45 };
const RELATIVE_TOLERANCE = 0.01;
const ABSOLUTE_TOLERANCE = 1e-4;
const SMALL_GAIN = 0.01;

function sine(frequencyHz: number, sampleRateHz: number): number[] {
  const n = Math.round(DURATION_S * sampleRateHz);
  return Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * frequencyHz * i) / sampleRateHz));
}

function amplitudeOverMiddle(y: readonly number[], frequencyHz: number, sampleRateHz: number): number {
  const from = Math.round(MIDDLE.fromS * sampleRateHz);
  const to = Math.round(MIDDLE.toS * sampleRateHz);
  let s = 0;
  let c = 0;
  for (let i = from; i < to; i++) {
    const phase = (2 * Math.PI * frequencyHz * i) / sampleRateHz;
    s += y[i] * Math.sin(phase);
    c += y[i] * Math.cos(phase);
  }
  return (2 / (to - from)) * Math.hypot(s, c);
}

function analyticZeroPhaseGain(frequencyHz: number, sampleRateHz: number, spec: LowPassSpec): number {
  const ratio = Math.tan((Math.PI * frequencyHz) / sampleRateHz) / Math.tan((Math.PI * spec.cutoffHz) / sampleRateHz);
  return 1 / (1 + ratio ** (2 * spec.order));
}

function expectGain(measured: number, analytic: number): void {
  if (analytic < SMALL_GAIN) expect(Math.abs(measured - analytic)).toBeLessThanOrEqual(ABSOLUTE_TOLERANCE);
  else expect(Math.abs(measured - analytic) / analytic).toBeLessThanOrEqual(RELATIVE_TOLERANCE);
}

function peakIndices(x: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < x.length - 1; i++) if (x[i] > x[i - 1] && x[i] >= x[i + 1]) out.push(i);
  return out;
}

describe("butterworthLowPass", () => {
  it("reads the cutoff and order from FIXED_CONSTANTS.lowPassFilter", () => {
    expect(butterworthLowPass(20)).toHaveLength(FIXED_CONSTANTS.lowPassFilter.order / 2);
  });

  it("has unity gain at DC in every section", () => {
    for (const s of butterworthLowPass(10)) {
      expect((s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2)).toBeCloseTo(1, 12);
    }
  });

  it("rejects a cutoff at or above Nyquist and a bad sample rate or order", () => {
    expect(() => butterworthLowPass(2 * FIXED_CONSTANTS.lowPassFilter.cutoffHz)).toThrow(RangeError);
    expect(() => butterworthLowPass(0)).toThrow(RangeError);
    expect(() => butterworthLowPass(Number.NaN)).toThrow(RangeError);
    expect(() => butterworthLowPass(20, { cutoffHz: 1, order: 0 })).toThrow(RangeError);
    expect(() => butterworthLowPass(20, { cutoffHz: 1, order: 2.5 })).toThrow(/order/);
  });
});

describe("filtfilt", () => {
  for (const sampleRateHz of [20, 10]) {
    for (const frequencyHz of [0.1, 0.5, 1, 3]) {
      it(`matches the analytic zero-phase gain for ${frequencyHz} Hz at ${sampleRateHz} Hz`, () => {
        const y = filtfilt(sine(frequencyHz, sampleRateHz), sampleRateHz);
        const measured = amplitudeOverMiddle(y, frequencyHz, sampleRateHz);
        expectGain(measured, analyticZeroPhaseGain(frequencyHz, sampleRateHz, FIXED_CONSTANTS.lowPassFilter));
      });
    }
  }

  it("matches the analytic gain for an odd order too", () => {
    const spec = { cutoffHz: FIXED_CONSTANTS.lowPassFilter.cutoffHz, order: 3 };
    expect(butterworthLowPass(20, spec)).toHaveLength(2);
    for (const frequencyHz of [0.5, 1, 3]) {
      const y = filtfilt(sine(frequencyHz, 20), 20, spec);
      expectGain(amplitudeOverMiddle(y, frequencyHz, 20), analyticZeroPhaseGain(frequencyHz, 20, spec));
    }
  });

  for (const sampleRateHz of [20, 10]) {
    it(`does not move the peaks of a 0.1 Hz sine by more than one sample at ${sampleRateHz} Hz`, () => {
      const x = sine(0.1, sampleRateHz);
      const before = peakIndices(x);
      const after = peakIndices(filtfilt(x, sampleRateHz));
      expect(before.length).toBeGreaterThan(0);
      expect(after).toHaveLength(before.length);
      after.forEach((index, k) => expect(Math.abs(index - before[k])).toBeLessThanOrEqual(1));
    });
  }

  it("returns a new array of the input's length and leaves the input alone", () => {
    const x = sine(0.5, 20);
    const copy = [...x];
    const y = filtfilt(x, 20);
    expect(y).toHaveLength(x.length);
    expect(y).not.toBe(x);
    expect(x).toEqual(copy);
  });

  it("passes a constant through unchanged, edges included", () => {
    const y = filtfilt(new Array<number>(200).fill(7), 20);
    for (const v of y) expect(v).toBeCloseTo(7, 9);
  });

  it("handles empty, one-sample and short inputs", () => {
    expect(filtfilt([], 20)).toEqual([]);
    expect(filtfilt([4], 20)[0]).toBeCloseTo(4, 12);
    expect(filtfilt([1, 2, 3], 20)).toHaveLength(3);
  });

  it("is re-exported from the analysis index", () => {
    expect(analysis.filtfilt).toBe(filtfilt);
    expect(analysis.butterworthLowPass).toBe(butterworthLowPass);
  });
});
