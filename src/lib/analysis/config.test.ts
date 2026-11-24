import { describe, expect, it } from "vitest";
import { ANALYSIS_CONFIG, FIXED_CONSTANTS, OPEN_CONSTANTS, isOpenConstant } from "./config";
import * as analysis from "./index";

describe("OPEN_CONSTANTS", () => {
  it("keeps transitions at least 1% of max in prominence and 0.5 s apart", () => {
    expect(OPEN_CONSTANTS.transitionMinProminencePctOfMax).toBe(1);
    expect(OPEN_CONSTANTS.transitionMinSpacingS).toBe(0.5);
  });

  it("uses k = 1.0, 0.75, 0.5 and 0.25 for the skill bands", () => {
    expect(OPEN_CONSTANTS.skillBandK).toEqual({
      beginner: 1.0,
      intermediate: 0.75,
      advanced: 0.5,
      expert: 0.25,
    });
  });

  it("gives 10 points for a 0-10% deviation", () => {
    expect(OPEN_CONSTANTS.topDeviationBand).toEqual({ maxDeviationPct: 10, points: 10 });
  });

  it("treats peaks as inhale and troughs as exhale", () => {
    expect(OPEN_CONSTANTS.extremumPhase.peak).toBe("inhale");
    expect(OPEN_CONSTANTS.extremumPhase.trough).toBe("exhale");
  });

  it("weights the four Total Breath Score parts equally, summing to 1", () => {
    const weights = Object.values(OPEN_CONSTANTS.totalBreathScoreWeights);
    expect(Object.keys(OPEN_CONSTANTS.totalBreathScoreWeights).sort()).toEqual([
      "depthEx",
      "depthIn",
      "timingEx",
      "timingIn",
    ]);
    expect(new Set(weights).size).toBe(1);
    expect(weights.reduce((sum, w) => sum + w, 0)).toBeCloseTo(1, 12);
  });

  it("sets the normal inhale to 1.25-1.67 s and exhale to 2.5-3.33 s", () => {
    expect(OPEN_CONSTANTS.normalInhaleDurationS).toEqual({ min: 1.25, max: 1.67 });
    expect(OPEN_CONSTANTS.normalExhaleDurationS).toEqual({ min: 2.5, max: 3.33 });
  });

  it("sets the normal depth band to 6% +/- 25%", () => {
    expect(OPEN_CONSTANTS.normalDepthBand).toEqual({ centrePctOfMax: 6, tolerancePct: 25 });
  });
});

describe("FIXED_CONSTANTS", () => {
  it("holds the fixed Appendix values", () => {
    expect(FIXED_CONSTANTS.referenceDepthPeakToTroughPctOfMax).toBe(6);
    expect(FIXED_CONSTANTS.depthSdPctOfMax).toBe(3);
    expect(FIXED_CONSTANTS.timingSdBreathFraction).toBe(0.5);
    expect(FIXED_CONSTANTS.pacersS).toEqual([
      { inhaleS: 2, exhaleS: 2 },
      { inhaleS: 5, exhaleS: 5 },
    ]);
    expect(FIXED_CONSTANTS.lowPassFilter).toEqual({
      cutoffHz: 1,
      order: 4,
      kind: "butterworth",
      zeroPhase: true,
    });
    expect(FIXED_CONSTANTS.artifactLimitPctOfMax).toBe(100);
    expect(FIXED_CONSTANTS.normalRateBpm).toEqual({ min: 12, max: 16 });
    expect(FIXED_CONSTANTS.normalIeRatio).toEqual({ inhale: 1, exhale: 2 });
    expect(FIXED_CONSTANTS.maxEventMarkersPerOpenSession).toBe(2);
    expect(FIXED_CONSTANTS.deviationHistogram).toEqual({
      minSd: -1,
      maxSd: 1,
      stepSd: 0.25,
      missedOrDoubleBin: true,
    });
  });
});

describe("open and fixed groups", () => {
  it("never share a name", () => {
    const fixed = new Set(Object.keys(FIXED_CONSTANTS));
    expect(Object.keys(OPEN_CONSTANTS).filter((name) => fixed.has(name))).toEqual([]);
  });

  it("tells open constants apart from fixed ones", () => {
    expect(isOpenConstant("transitionMinSpacingS")).toBe(true);
    expect(isOpenConstant("normalRateBpm")).toBe(false);
    expect(isOpenConstant("toString")).toBe(false);
  });

  it("groups both under ANALYSIS_CONFIG", () => {
    expect(ANALYSIS_CONFIG.open).toBe(OPEN_CONSTANTS);
    expect(ANALYSIS_CONFIG.fixed).toBe(FIXED_CONSTANTS);
  });
});

describe("analysis index", () => {
  it("re-exports the config", () => {
    expect(analysis.OPEN_CONSTANTS).toBe(OPEN_CONSTANTS);
    expect(analysis.FIXED_CONSTANTS).toBe(FIXED_CONSTANTS);
    expect(analysis.ANALYSIS_CONFIG).toBe(ANALYSIS_CONFIG);
    expect(analysis.isOpenConstant).toBe(isOpenConstant);
  });
});
