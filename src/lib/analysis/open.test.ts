import { describe, expect, it } from "vitest";
import * as analysis from "./index";
import { analyzeOpen, openBreaths, openMetrics, type OpenResult, type OpenTransition } from "./open";
import { generateSignal } from "./synth";

function breaths(cycles: readonly (readonly [number, number])[], start = 0): OpenTransition[] {
  const out: OpenTransition[] = [];
  let t = start;
  for (const [inhaleS, exhaleS] of cycles) {
    out.push({ t, type: "trough", level: -3 });
    out.push({ t: t + inhaleS, type: "peak", level: 3 });
    t += inhaleS + exhaleS;
  }
  out.push({ t, type: "trough", level: -3 });
  return out;
}

const fourBreaths = breaths([
  [1.5, 3],
  [1.5, 3],
  [1.5, 3],
  [1.5, 3],
]);

function shape(result: OpenResult) {
  return result.segments.map((s) => ({ name: s.name, fromS: s.fromS, toS: s.toS, breaths: s.breaths }));
}

describe("openMetrics segments", () => {
  it("has no segments without a marker", () => {
    const result = openMetrics(fourBreaths, { durationS: 18 });
    expect(result.segments).toEqual([]);
    expect(result.markersUsed).toEqual([]);
    expect(result.markersIgnored).toBe(0);
    expect(result.whole).toMatchObject({ fromS: 0, toS: 18, breaths: 4 });
    expect(result.whole.metrics?.rateBpm).toBeCloseTo(60 / 4.5, 9);
  });

  it("splits into before and after with one marker", () => {
    const result = openMetrics(fourBreaths, { durationS: 18, markersS: [9] });
    expect(shape(result)).toEqual([
      { name: "before", fromS: 0, toS: 9, breaths: 2 },
      { name: "after", fromS: 9, toS: 18, breaths: 2 },
    ]);
    expect(result.markersUsed).toEqual([9]);
    expect(result.markersIgnored).toBe(0);
  });

  it("splits into before, between and after with two markers", () => {
    const result = openMetrics(fourBreaths, { durationS: 18, markersS: [13.5, 4.5] });
    expect(shape(result)).toEqual([
      { name: "before", fromS: 0, toS: 4.5, breaths: 1 },
      { name: "between", fromS: 4.5, toS: 13.5, breaths: 2 },
      { name: "after", fromS: 13.5, toS: 18, breaths: 1 },
    ]);
    for (const segment of result.segments) {
      expect(segment.metrics?.ieRatio).toBeCloseTo(2, 9);
      expect(segment.metrics?.depthPct).toBeCloseTo(6, 9);
    }
  });

  it("uses the first two markers by time and counts the third as ignored", () => {
    const result = openMetrics(fourBreaths, { durationS: 18, markersS: [13.5, 9, 4.5] });
    expect(result.markersUsed).toEqual([4.5, 9]);
    expect(result.markersIgnored).toBe(1);
    expect(shape(result)).toEqual([
      { name: "before", fromS: 0, toS: 4.5, breaths: 1 },
      { name: "between", fromS: 4.5, toS: 9, breaths: 1 },
      { name: "after", fromS: 9, toS: 18, breaths: 2 },
    ]);
    expect(result.whole.breaths).toBe(4);
  });

  it("puts a breath in the segment that holds its peak", () => {
    const justBefore = openMetrics(fourBreaths, { durationS: 18, markersS: [1.4] });
    expect(shape(justBefore).map((s) => s.breaths)).toEqual([0, 4]);
    const justAfter = openMetrics(fourBreaths, { durationS: 18, markersS: [1.6] });
    expect(shape(justAfter).map((s) => s.breaths)).toEqual([1, 3]);
    const onPeak = openMetrics(fourBreaths, { durationS: 18, markersS: [1.5] });
    expect(shape(onPeak).map((s) => s.breaths)).toEqual([0, 4]);
  });

  it("gives an empty segment 0 breaths and null metrics", () => {
    const result = openMetrics(fourBreaths, { durationS: 18, markersS: [2, 4] });
    expect(result.segments[1]).toEqual({ name: "between", fromS: 2, toS: 4, breaths: 0, metrics: null });
    expect(result.segments[0].breaths + result.segments[2].breaths).toBe(4);
  });

  it("gives null metrics when the session has no complete breath", () => {
    const result = openMetrics(
      [
        { t: 0, type: "trough", level: -3 },
        { t: 1.5, type: "peak", level: 3 },
      ],
      { durationS: 3 },
    );
    expect(result.whole).toEqual({ fromS: 0, toS: 3, breaths: 0, metrics: null });
  });

  it("rejects a bad duration or a marker outside the session", () => {
    expect(() => openMetrics(fourBreaths, { durationS: 0 })).toThrow(RangeError);
    expect(() => openMetrics(fourBreaths, { durationS: 18, markersS: [19] })).toThrow(/outside the 18 s session/);
    expect(() => openMetrics(fourBreaths, { durationS: 18, markersS: [Number.NaN] })).toThrow(RangeError);
  });
});

describe("openBreaths", () => {
  it("forms trough, peak, trough breaths from unsorted transitions", () => {
    const formed = openBreaths([...fourBreaths].reverse());
    expect(formed).toHaveLength(4);
    expect(formed[0]).toEqual({
      troughS: 0,
      peakS: 1.5,
      nextTroughS: 4.5,
      periodS: 4.5,
      rateBpm: 60 / 4.5,
      inhaleS: 1.5,
      exhaleS: 3,
      depthPct: 6,
      inhaleDepthPct: 3,
      exhaleDepthPct: 3,
    });
  });

  it("skips runs that do not alternate", () => {
    const formed = openBreaths([
      { t: 0, type: "trough", level: -3 },
      { t: 1, type: "peak", level: 3 },
      { t: 2, type: "peak", level: 3 },
      { t: 3, type: "trough", level: -3 },
      { t: 4, type: "peak", level: 3 },
      { t: 5, type: "trough", level: -3 },
    ]);
    expect(formed.map((b) => b.peakS)).toEqual([4]);
  });
});

describe("analyzeOpen", () => {
  const fs = 20;
  const user = generateSignal({ inhaleS: 1.5, exhaleS: 3, peakPct: 3, troughPct: -3 }, { durationS: 45, sampleRateHz: fs })
    .user;

  it("returns whole and no segments without markers", () => {
    const result = analyzeOpen(user, fs);
    expect(result.segments).toEqual([]);
    expect(result.whole.fromS).toBe(0);
    expect(result.whole.toS).toBe(45);
    expect(result.whole.breaths).toBeGreaterThan(0);
  });

  it("turns marker sample indices into seconds and ignores a third marker", () => {
    const result = analyzeOpen(user, fs, [30 * fs, 9 * fs, 18 * fs]);
    expect(result.markersUsed).toEqual([9, 18]);
    expect(result.markersIgnored).toBe(1);
    expect(shape(result).map((s) => [s.name, s.fromS, s.toS])).toEqual([
      ["before", 0, 9],
      ["between", 9, 18],
      ["after", 18, 45],
    ]);
    expect(result.segments[1].breaths).toBe(2);
  });

  it("splits into before and after with one marker", () => {
    const result = analyzeOpen(user, fs, [22.5 * fs]);
    expect(shape(result).map((s) => s.name)).toEqual(["before", "after"]);
    expect(result.segments.reduce((sum, s) => sum + s.breaths, 0)).toBe(result.whole.breaths);
  });

  it("is re-exported from the analysis index", () => {
    expect(analysis.analyzeOpen).toBe(analyzeOpen);
    expect(analysis.openMetrics).toBe(openMetrics);
  });
});
