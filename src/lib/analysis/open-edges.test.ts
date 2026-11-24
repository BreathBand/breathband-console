import { describe, expect, it } from "vitest";
import { depthIndex, isNormalDepth, isNormalRate, openBreaths, openMetrics, type OpenTransition } from "./open";

function oneBreath(troughS: number, nextTroughS: number, peakLevel = 3, troughLevel = -3): OpenTransition[] {
  return [
    { t: troughS, type: "trough", level: troughLevel },
    { t: (troughS + nextTroughS) / 2, type: "peak", level: peakLevel },
    { t: nextTroughS, type: "trough", level: troughLevel },
  ];
}

function normalRatePct(transitions: readonly OpenTransition[]): number | undefined {
  return openMetrics(transitions, { durationS: 20 }).whole.metrics?.normalRatePct;
}

function normalDepthPct(half: number): number | undefined {
  return openMetrics(oneBreath(0, 4.5, half, -half), { durationS: 20 }).whole.metrics?.normalDepthPct;
}

describe("% at normal rate edges", () => {
  it("counts periods of exactly 5.0 s and 3.75 s as normal", () => {
    expect(normalRatePct(oneBreath(0, 5))).toBe(100);
    expect(normalRatePct(oneBreath(0, 3.75))).toBe(100);
  });

  it("counts periods built from non-representable times as normal", () => {
    const slow = openBreaths(oneBreath(3.3, 8.3))[0];
    expect(slow.periodS).toBe(5.000000000000001);
    expect(slow.rateBpm).toBe(11.999999999999998);
    expect(isNormalRate(slow.rateBpm)).toBe(true);
    expect(normalRatePct(oneBreath(3.3, 8.3))).toBe(100);
    const fast = openBreaths(oneBreath(0.6, 4.35))[0];
    expect(fast.periodS).toBe(3.7499999999999996);
    expect(fast.rateBpm).toBe(16.000000000000004);
    expect(isNormalRate(fast.rateBpm)).toBe(true);
    expect(normalRatePct(oneBreath(0.6, 4.35))).toBe(100);
  });

  it("does not count periods of 5.05 s or 3.70 s", () => {
    expect(normalRatePct(oneBreath(0, 5.05))).toBe(0);
    expect(normalRatePct(oneBreath(0, 3.7))).toBe(0);
  });
});

describe("% at normal depth edges", () => {
  it("counts depths of exactly 4.5% and 7.5% as normal", () => {
    expect(normalDepthPct(2.25)).toBe(100);
    expect(normalDepthPct(3.75)).toBe(100);
    expect(isNormalDepth(4.5)).toBe(true);
    expect(isNormalDepth(7.5)).toBe(true);
  });

  it("does not count depths of 4.45% or 7.55%", () => {
    expect(normalDepthPct(2.225)).toBe(0);
    expect(normalDepthPct(3.775)).toBe(0);
    expect(isNormalDepth(4.45)).toBe(false);
    expect(isNormalDepth(7.55)).toBe(false);
  });
});

describe("depth index cap", () => {
  it("keeps exactly +100 and -100", () => {
    expect(depthIndex(12)).toBe(100);
    expect(depthIndex(0)).toBe(-100);
    expect(openMetrics(oneBreath(0, 4.5, 6, -6), { durationS: 20 }).whole.metrics?.depthIndex).toBe(100);
  });

  it("caps values beyond +/-100", () => {
    expect(depthIndex(15)).toBe(100);
    expect(depthIndex(-3)).toBe(-100);
    expect(openMetrics(oneBreath(0, 4.5, 7.5, -7.5), { durationS: 20 }).whole.metrics?.depthIndex).toBe(100);
  });

  it("leaves values inside the cap alone", () => {
    expect(depthIndex(9)).toBe(50);
    expect(depthIndex(3)).toBe(-50);
  });
});
