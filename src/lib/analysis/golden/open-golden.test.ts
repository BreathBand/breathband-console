import { describe, expect, it } from "vitest";
import { analyzeOpen, openMetrics, type OpenMetrics } from "../open";
import { generatePiecewise, generateSignal } from "../synth";
import {
  OPEN_TIER_A,
  OPEN_TIER_A_END_TO_END,
  OPEN_TIER_A_SEGMENTED,
  OPEN_TIER_A_TOLERANCE,
  type OpenTierACase,
  type OpenTierAName,
} from "./open-tier-a";
import { OPEN_TIER_B } from "./open-tier-b";

const METRIC_KEYS: readonly (keyof OpenMetrics)[] = [
  "rateBpm",
  "ieRatio",
  "inhaleS",
  "exhaleS",
  "depthPct",
  "inhaleDepthPct",
  "exhaleDepthPct",
  "depthIndex",
  "normalRatePct",
  "normalDepthPct",
];

function expectMetrics(actual: OpenMetrics | null, expected: OpenMetrics): void {
  expect(actual).not.toBeNull();
  for (const key of METRIC_KEYS) {
    expect(Math.abs((actual as OpenMetrics)[key] - expected[key]), key).toBeLessThanOrEqual(OPEN_TIER_A_TOLERANCE);
  }
}

const tierANames = Object.keys(OPEN_TIER_A) as OpenTierAName[];

describe("Tier A, metrics level", () => {
  for (const name of tierANames) {
    it(`matches every ${name} metric within 0.05`, () => {
      const c: OpenTierACase = OPEN_TIER_A[name];
      const result = openMetrics(c.transitions, { durationS: c.durationS });
      expect(result.whole.breaths).toBe(c.breaths);
      expect(result.segments).toEqual([]);
      expectMetrics(result.whole.metrics, c.expected);
    });
  }
});

describe("Tier A, segments", () => {
  const s = OPEN_TIER_A_SEGMENTED;
  const result = openMetrics(s.transitions, { durationS: s.durationS, markersS: s.markersS });

  it("splits 12 / 12 / 20 breaths at 54 s and 90 s", () => {
    expect(result.markersUsed).toEqual(s.markersS);
    expect(result.markersIgnored).toBe(0);
    expect(result.segments.map((g) => [g.name, g.fromS, g.toS, g.breaths])).toEqual(
      s.segments.map((g) => [g.name, g.fromS, g.toS, g.breaths]),
    );
  });

  it("gives each segment the metrics of its pattern", () => {
    s.segments.forEach((g, i) => {
      expect(g.expected).toEqual(OPEN_TIER_A[g.sameAs].expected);
      expectMetrics(result.segments[i].metrics, g.expected);
    });
  });

  it("gives the whole session 44 breaths, rate 14.667, depth 6.818 and 72.7% normal", () => {
    expect(result.whole.breaths).toBe(s.whole.breaths);
    expectMetrics(result.whole.metrics, s.whole.expected);
  });
});

describe("Tier A, end to end, noise-free", () => {
  it("reproduces the normal values from synth through analyzeOpen", () => {
    const e = OPEN_TIER_A_END_TO_END;
    const user = generateSignal(e.pattern, { durationS: e.durationS, sampleRateHz: e.sampleRateHz }).user;
    const result = analyzeOpen(user, e.sampleRateHz, []);
    expect(result.whole.breaths).toBeGreaterThan(0);
    expectMetrics(result.whole.metrics, OPEN_TIER_A[e.sameAs].expected);
  });
});

describe("Tier B, end to end with one shared noise setting", () => {
  const b = OPEN_TIER_B;
  const tol = b.tolerance;

  function expectClose(actual: OpenMetrics | null, expected: OpenMetrics): void {
    expect(actual).not.toBeNull();
    const a = actual as OpenMetrics;
    const off = (key: keyof OpenMetrics) => Math.abs(a[key] - expected[key]);
    expect(off("rateBpm"), "rateBpm").toBeLessThanOrEqual(tol.rateBpm);
    expect(off("ieRatio"), "ieRatio").toBeLessThanOrEqual(tol.ieRatio);
    expect(off("depthPct"), "depthPct").toBeLessThanOrEqual(tol.depthPct);
    expect(off("inhaleDepthPct"), "inhaleDepthPct").toBeLessThanOrEqual(tol.depthPct);
    expect(off("exhaleDepthPct"), "exhaleDepthPct").toBeLessThanOrEqual(tol.depthPct);
    expect(off("inhaleS"), "inhaleS").toBeLessThanOrEqual(tol.durationS);
    expect(off("exhaleS"), "exhaleS").toBeLessThanOrEqual(tol.durationS);
  }

  it("normal pattern lands near the normal values, 100% at normal rate and depth", () => {
    const user = generateSignal(b.normal, { durationS: b.durationS, sampleRateHz: b.sampleRateHz, noise: b.noise }).user;
    const result = analyzeOpen(user, b.sampleRateHz, []);
    const expected = OPEN_TIER_A.normal.expected;
    expectClose(result.whole.metrics, expected);
    expect(result.whole.metrics?.normalRatePct).toBe(expected.normalRatePct);
    expect(result.whole.metrics?.normalDepthPct).toBe(expected.normalDepthPct);
  });

  describe("2-marker segmented session", () => {
    const s = OPEN_TIER_A_SEGMENTED;
    const user = generatePiecewise(b.segmented.segments, {
      durationS: b.durationS,
      sampleRateHz: b.sampleRateHz,
      noise: b.noise,
    }).user;
    const markerIndices = b.segmented.markersS.map((m) => m * b.sampleRateHz);
    const result = analyzeOpen(user, b.sampleRateHz, markerIndices);

    it("uses both markers and keeps the three segment bounds", () => {
      expect(result.markersUsed).toEqual(b.segmented.markersS);
      expect(result.segments.map((g) => [g.name, g.fromS, g.toS])).toEqual(
        s.segments.map((g) => [g.name, g.fromS, g.toS]),
      );
    });

    it("lands each segment near its Tier A values, with exact % at normal rate and depth", () => {
      s.segments.forEach((g, i) => {
        const metrics = result.segments[i].metrics;
        expectClose(metrics, g.expected);
        expect(metrics?.normalRatePct, g.name).toBe(g.expected.normalRatePct);
        expect(metrics?.normalDepthPct, g.name).toBe(g.expected.normalDepthPct);
      });
    });

    it("lands the whole session near its Tier A values", () => {
      expectClose(result.whole.metrics, s.whole.expected);
    });
  });
});
