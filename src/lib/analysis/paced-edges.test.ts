import { describe, expect, it } from "vitest";
import { FIXED_CONSTANTS, OPEN_CONSTANTS } from "./config";
import { histogramBin, histogramBinCount, scorePaced, type PacedTransitionType } from "./paced";

const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function scoredAt(halfCycleS: number, durationS: number, pacerT: number, type: PacedTransitionType, t: number, level: number) {
  const result = scorePaced([{ t, type, level }], { halfCycleS, durationS, skillLevel: "beginner" });
  const entry = result.transitions.find((e) => e.pacer.t === pacerT);
  if (!entry) throw new Error(`paced-edges: no pacer transition at ${pacerT} s`);
  return { result, entry };
}

function pacerLevel(type: PacedTransitionType): number {
  const half = FIXED_CONSTANTS.referenceDepthPeakToTroughPctOfMax / 2;
  return type === "peak" ? half : -half;
}

describe("FIXED_CONSTANTS.bandEdgeEpsilon", () => {
  it("is 1e-9 and stays out of the open group", () => {
    expect(FIXED_CONSTANTS.bandEdgeEpsilon).toBe(1e-9);
    expect(Object.hasOwn(OPEN_CONSTANTS, "bandEdgeEpsilon")).toBe(false);
  });
});

describe("timing points at band edges, Beginner", () => {
  const cases: {
    name: string;
    halfCycleS: number;
    durationS: number;
    pacerT: number;
    type: PacedTransitionType;
    step: number;
  }[] = [
    { name: "5-5 peak", halfCycleS: 5, durationS: 21, pacerT: 5, type: "peak", step: 0.5 },
    { name: "5-5 trough", halfCycleS: 5, durationS: 21, pacerT: 10, type: "trough", step: 0.5 },
    { name: "2-2 peak", halfCycleS: 2, durationS: 9, pacerT: 2, type: "peak", step: 0.2 },
    { name: "2-2 trough", halfCycleS: 2, durationS: 9, pacerT: 4, type: "trough", step: 0.2 },
  ];

  for (const c of cases) {
    for (const direction of [1, -1]) {
      it(`${c.name}, ${direction > 0 ? "late" : "early"}: j steps of ${c.step} s give 10 - j points`, () => {
        for (const j of STEPS) {
          const t = c.pacerT + direction * j * c.step;
          const { entry } = scoredAt(c.halfCycleS, c.durationS, c.pacerT, c.type, t, pacerLevel(c.type));
          expect(entry.missed).toBe(false);
          expect(entry.double).toBe(false);
          expect(entry.dTime).not.toBeNull();
          expect(entry.timingPoints, `j = ${j}`).toBe(10 - j);
        }
      });
    }
  }
});

describe("depth points at band edges, Beginner", () => {
  it("peaks at 3 + j x 0.3 % give 10 - j points", () => {
    for (const j of STEPS) {
      const { entry } = scoredAt(5, 21, 5, "peak", 5, 3 + j * 0.3);
      expect(entry.dDepth).not.toBeNull();
      expect(entry.depthPoints, `j = ${j}`).toBe(10 - j);
    }
  });

  it("troughs at -3 - j x 0.3 % give 10 - j points", () => {
    for (const j of STEPS) {
      const { entry } = scoredAt(5, 21, 10, "trough", 10, -3 - j * 0.3);
      expect(entry.dDepth).not.toBeNull();
      expect(entry.depthPoints, `j = ${j}`).toBe(10 - j);
    }
  });

  it("regression: a user peak at 3.3 % scores 9 points", () => {
    const { entry } = scoredAt(5, 21, 5, "peak", 5, 3.3);
    expect(entry.dDepth).toBeCloseTo(0.1, 12);
    expect(entry.depthPoints).toBe(9);
  });

  it("regression: a user peak at 5.1 % scores 3 points", () => {
    const { entry } = scoredAt(5, 21, 5, "peak", 5, 5.1);
    expect(entry.dDepth).toBeCloseTo(0.7, 12);
    expect(entry.depthPoints).toBe(3);
  });
});

describe("histogram bins at bin edges", () => {
  const { minSd, maxSd, stepSd } = FIXED_CONSTANTS.deviationHistogram;
  const edgeCount = Math.round((maxSd - minSd) / stepSd) + 1;
  const edges = Array.from({ length: edgeCount }, (_, i) => ({ i, edge: minSd + i * stepSd }));
  const sdDepth = FIXED_CONSTANTS.depthSdPctOfMax;
  const last = histogramBinCount() - 1;

  it("covers -1 to +1 in 0.25 steps", () => {
    expect(edges.map((e) => e.edge)).toEqual([-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]);
  });

  for (const type of ["peak", "trough"] as const) {
    it(`puts each edge in the bin it opens, and +1 in the last bin, for ${type}s`, () => {
      const pacerT = type === "peak" ? 5 : 10;
      const sign = type === "peak" ? 1 : -1;
      for (const { i, edge } of edges) {
        const expected = Math.min(i, last);
        const level = pacerLevel(type) + sign * edge * sdDepth;
        const d = (sign * (level - pacerLevel(type))) / sdDepth;
        expect(histogramBin(d), `edge ${edge}`).toBe(expected);
        const { result, entry } = scoredAt(5, 21, pacerT, type, pacerT, level);
        expect(histogramBin(entry.dDepth ?? Number.NaN), `edge ${edge}`).toBe(expected);
        expect(result.histogram.depth[expected], `edge ${edge}`).toBe(1);
        expect(result.histogram.depth.reduce((sum, n) => sum + n, 0), `edge ${edge}`).toBe(1);
      }
    });
  }
});
