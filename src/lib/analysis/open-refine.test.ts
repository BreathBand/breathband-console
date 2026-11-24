import { describe, expect, it } from "vitest";
import { FIXED_CONSTANTS } from "./config";
import { analyzeOpen, openMetrics, refineTransitions } from "./open";
import { generateSignal } from "./synth";
import { detectTransitions, type DetectedTransition } from "./transitions";

const fs = 20;
const durationS = 180;
const user = generateSignal({ inhaleS: 1.5, exhaleS: 3, peakPct: 3, troughPct: -3 }, { durationS, sampleRateHz: fs })
  .user;

describe("refined transitions on the noise-free normal pattern", () => {
  it("gives I:E 2.0 +/- 0.05 through analyzeOpen", () => {
    const ie = analyzeOpen(user, fs).whole.metrics?.ieRatio;
    expect(ie).toBeDefined();
    expect(Math.abs((ie as number) - 2)).toBeLessThanOrEqual(0.05);
  });

  it("gives I:E below 1.9 from the same detected transitions without refinement", () => {
    const ie = openMetrics(detectTransitions(user, fs), { durationS }).whole.metrics?.ieRatio;
    expect(ie).toBeDefined();
    expect(ie as number).toBeLessThan(1.9);
  });

  it("moves every transition onto the raw extremum of its type", () => {
    const detected = detectTransitions(user, fs);
    const refined = refineTransitions(user, fs, detected);
    expect(refined).toHaveLength(detected.length);
    for (const r of refined) {
      expect(r.t * 2).toBeCloseTo(Math.round(r.t * 2), 9);
      expect(r.level).toBe(r.type === "peak" ? 3 : -3);
    }
  });
});

describe("refineTransitions", () => {
  const reach = Math.round(FIXED_CONSTANTS.transitionRefineWindowS * fs);

  function peakAt(index: number): DetectedTransition {
    return { index, t: index / fs, type: "peak", level: 0 };
  }

  it("moves a peak to the raw maximum inside the window", () => {
    const raw = new Array<number>(40).fill(0);
    raw[20 + reach] = 5;
    expect(refineTransitions(raw, fs, [peakAt(20)])).toEqual([
      { index: 20 + reach, t: (20 + reach) / fs, type: "peak", level: 5 },
    ]);
  });

  it("never looks outside the window", () => {
    const raw = new Array<number>(40).fill(0);
    raw[20] = 1;
    raw[20 + reach + 1] = 9;
    raw[20 - reach - 1] = 9;
    expect(refineTransitions(raw, fs, [peakAt(20)])[0].index).toBe(20);
  });

  it("moves a trough to the raw minimum and clamps the window to the recording", () => {
    const raw = [0, -4, -1, 0, 0, 0, 0, 0];
    const trough: DetectedTransition = { index: 2, t: 2 / fs, type: "trough", level: -1 };
    expect(refineTransitions(raw, fs, [trough])[0]).toEqual({ index: 1, t: 1 / fs, type: "trough", level: -4 });
  });

  it("skips artifact samples and keeps the detected point when nothing usable is near", () => {
    const raw = new Array<number>(40).fill(Number.NaN);
    raw[20] = 2;
    raw[21] = FIXED_CONSTANTS.artifactLimitPctOfMax * 2;
    expect(refineTransitions(raw, fs, [peakAt(20)])[0].index).toBe(20);
    const lost = new Array<number>(40).fill(Number.NaN);
    const detected = peakAt(20);
    expect(refineTransitions(lost, fs, [detected])[0]).toBe(detected);
  });
});
