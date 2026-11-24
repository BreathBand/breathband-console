import { describe, expect, it } from "vitest";
import { OPEN_CONSTANTS, type SkillLevel } from "./config";
import * as analysis from "./index";
import {
  histogramBin,
  histogramBinCount,
  pacedPoints,
  pacerTransitions,
  scorePaced,
  timingSdS,
  type PacedUserTransition,
} from "./paced";

const TOLERANCE = 1e-9;

function peak(t: number, level = 3): PacedUserTransition {
  return { t, type: "peak", level };
}

function trough(t: number, level = -3): PacedUserTransition {
  return { t, type: "trough", level };
}

function score(users: readonly PacedUserTransition[], skillLevel: SkillLevel = "beginner", durationS = 11) {
  return scorePaced(users, { halfCycleS: 5, durationS, skillLevel });
}

describe("pacerTransitions", () => {
  it("has 35 transitions in a 5-5, 180 s session, odd k peaks at +3 and even k troughs at -3", () => {
    const pacer = pacerTransitions(5, 180);
    expect(pacer).toHaveLength(35);
    expect(pacer[0]).toEqual({ k: 1, t: 5, type: "peak", phase: "inhale", level: 3 });
    expect(pacer[1]).toEqual({ k: 2, t: 10, type: "trough", phase: "exhale", level: -3 });
    expect(pacer[34]).toEqual({ k: 35, t: 175, type: "peak", phase: "inhale", level: 3 });
  });

  it("stops before the session end", () => {
    expect(pacerTransitions(2, 8).map((p) => p.t)).toEqual([2, 4, 6]);
  });

  it("rejects a half cycle or duration that is not positive", () => {
    expect(() => pacerTransitions(0, 180)).toThrow(RangeError);
    expect(() => pacerTransitions(5, Number.NaN)).toThrow(RangeError);
  });
});

describe("timing SD", () => {
  it("is half a breath: 2 s for 2-2 and 5 s for 5-5", () => {
    expect(timingSdS(2)).toBe(2);
    expect(timingSdS(5)).toBe(5);
    expect(scorePaced([], { halfCycleS: 2, durationS: 5, skillLevel: "beginner" }).sdTimeS).toBe(2);
    expect(score([]).sdTimeS).toBe(5);
    expect(score([]).sdDepthPct).toBe(3);
  });
});

describe("scorePaced matching", () => {
  it("scores a pacer transition with no match as missed, 1 and 1", () => {
    const [first, second] = score([]).transitions;
    for (const entry of [first, second]) {
      expect(entry.missed).toBe(true);
      expect(entry.double).toBe(false);
      expect(entry.matches).toEqual([]);
      expect(entry.dTime).toBeNull();
      expect(entry.dDepth).toBeNull();
      expect(entry.timingPoints).toBe(1);
      expect(entry.depthPoints).toBe(1);
    }
  });

  it("scores two matches as double, 1 and 1", () => {
    const [entry] = score([peak(4), peak(6), trough(10)]).transitions;
    expect(entry.double).toBe(true);
    expect(entry.missed).toBe(false);
    expect(entry.matches.map((m) => m.t)).toEqual([4, 6]);
    expect(entry.timingPoints).toBe(1);
    expect(entry.depthPoints).toBe(1);
  });

  it("only matches user transitions of the same type", () => {
    const [entry] = score([trough(5)]).transitions;
    expect(entry.missed).toBe(true);
  });

  it("includes a user transition exactly 1 SD away and leaves out one just beyond", () => {
    const [edge] = score([peak(10)]).transitions;
    expect(edge.missed).toBe(false);
    expect(edge.dTime).toBe(1);
    expect(edge.timingPoints).toBe(1);
    const [beyond] = score([peak(10.01)]).transitions;
    expect(beyond.missed).toBe(true);
  });

  it("lets one user transition count for two pacer transitions", () => {
    const result = scorePaced([peak(4)], { halfCycleS: 2, durationS: 9, skillLevel: "beginner" });
    const peaks = result.transitions.filter((e) => e.type === "peak");
    expect(peaks.map((e) => e.pacer.t)).toEqual([2, 6]);
    expect(peaks.map((e) => e.dTime)).toEqual([1, -1]);
    expect(peaks.every((e) => e.matches[0].t === 4 && !e.double && !e.missed)).toBe(true);
  });
});

describe("scorePaced signs", () => {
  it("is late + and deep + at a peak, early - and shallow - at a trough", () => {
    const [p, t] = score([peak(6, 4.5), trough(9, -1.5)]).transitions;
    expect(p.dTime).toBeCloseTo(0.2, 12);
    expect(p.dDepth).toBeCloseTo(0.5, 12);
    expect(t.dTime).toBeCloseTo(-0.2, 12);
    expect(t.dDepth).toBeCloseTo(-0.5, 12);
  });

  it("is early - and shallow - at a peak, late + and deep + at a trough", () => {
    const [p, t] = score([peak(4, 1.5), trough(11, -4.5)]).transitions;
    expect(p.dTime).toBeCloseTo(-0.2, 12);
    expect(p.dDepth).toBeCloseTo(-0.5, 12);
    expect(t.dTime).toBeCloseTo(0.2, 12);
    expect(t.dDepth).toBeCloseTo(0.5, 12);
  });

  it("keeps the phase from the extremum mapping", () => {
    const [p, t] = score([]).transitions;
    expect(p.phase).toBe(OPEN_CONSTANTS.extremumPhase.peak);
    expect(t.phase).toBe(OPEN_CONSTANTS.extremumPhase.trough);
  });
});

describe("points", () => {
  it("gives 10 for e = 0.05, 1 for e = 0.95 and clamps e = 3 to 1", () => {
    expect(pacedPoints(0.05)).toBe(10);
    expect(pacedPoints(0.95)).toBe(1);
    expect(pacedPoints(3)).toBe(1);
    expect(pacedPoints(0)).toBe(10);
  });

  it("scores e = 0.05 and e = 0.95 in timing, and e = 3 in depth", () => {
    const [near] = score([peak(5.25)]).transitions;
    expect(near.eTime).toBeCloseTo(0.05, 12);
    expect(near.timingPoints).toBe(10);
    const [far] = score([peak(9.75)]).transitions;
    expect(far.eTime).toBeCloseTo(0.95, 12);
    expect(far.timingPoints).toBe(1);
    const [deep] = score([peak(5, 12)]).transitions;
    expect(deep.eDepth).toBe(3);
    expect(deep.depthPoints).toBe(1);
  });

  it("divides by k from OPEN_CONSTANTS.skillBandK for each of the four skill bands", () => {
    const expected: Record<SkillLevel, number> = { beginner: 8, intermediate: 7, advanced: 5, expert: 1 };
    for (const level of Object.keys(expected) as SkillLevel[]) {
      const result = score([peak(6.25)], level);
      expect(result.k).toBe(OPEN_CONSTANTS.skillBandK[level]);
      expect(result.transitions[0].eTime).toBeCloseTo(0.25 / OPEN_CONSTANTS.skillBandK[level], 12);
      expect(result.transitions[0].timingPoints).toBe(expected[level]);
    }
  });
});

describe("histogram bins", () => {
  it("has 8 bins of 0.25 SD from -1 to +1", () => {
    expect(histogramBinCount()).toBe(8);
  });

  it("includes the lower edge of each bin and puts +1 in the last bin", () => {
    expect(histogramBin(-1)).toBe(0);
    expect(histogramBin(-0.5)).toBe(2);
    expect(histogramBin(-0.25)).toBe(3);
    expect(histogramBin(0)).toBe(4);
    expect(histogramBin(0.75)).toBe(7);
    expect(histogramBin(1)).toBe(7);
  });

  it("puts depth values beyond 1 SD in the outermost bins", () => {
    const result = score([peak(5, 9), trough(10, -9)]);
    expect(result.transitions.map((e) => e.dDepth)).toEqual([2, 2]);
    expect(result.histogram.depth).toEqual([0, 0, 0, 0, 0, 0, 0, 2]);
    const shallow = score([peak(5, -3), trough(10, 3)]);
    expect(shallow.histogram.depth).toEqual([2, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("scorePaced input checks", () => {
  it("needs at least one pacer peak and one trough", () => {
    expect(() => scorePaced([], { halfCycleS: 5, durationS: 8, skillLevel: "beginner" })).toThrow(RangeError);
  });
});

describe("scorePaced hand-worked four-transition example", () => {
  const users = [peak(6.25, 6.75), trough(8.25, -2.25), peak(13), peak(17)];
  const result = scorePaced(users, { halfCycleS: 5, durationS: 21, skillLevel: "beginner" });

  it("scores each pacer transition", () => {
    expect(result.transitions.map((e) => [e.pacer.t, e.type, e.missed, e.double])).toEqual([
      [5, "peak", false, false],
      [10, "trough", false, false],
      [15, "peak", false, true],
      [20, "trough", true, false],
    ]);
    const [a, b] = result.transitions;
    expect(a.deltaTimeS).toBeCloseTo(1.25, 12);
    expect(a.dTime).toBeCloseTo(0.25, 12);
    expect(a.timingPoints).toBe(8);
    expect(a.deltaDepthPct).toBeCloseTo(3.75, 12);
    expect(a.dDepth).toBeCloseTo(1.25, 12);
    expect(a.depthPoints).toBe(1);
    expect(b.deltaTimeS).toBeCloseTo(-1.75, 12);
    expect(b.dTime).toBeCloseTo(-0.35, 12);
    expect(b.timingPoints).toBe(7);
    expect(b.deltaDepthPct).toBeCloseTo(-0.75, 12);
    expect(b.dDepth).toBeCloseTo(-0.25, 12);
    expect(b.depthPoints).toBe(8);
  });

  it("returns the scores, with the total from combineTransitionScores", () => {
    expect(result.scores.timing.inhale).toBeCloseTo(4.5, 12);
    expect(result.scores.timing.exhale).toBeCloseTo(4, 12);
    expect(result.scores.depth.inhale).toBeCloseTo(1, 12);
    expect(result.scores.depth.exhale).toBeCloseTo(4.5, 12);
    expect(result.scores.total).toBe(3.5);
  });

  it("counts missed and double as off target", () => {
    expect(result.onTargetPct.timing).toBeCloseTo(50, 12);
    expect(result.onTargetPct.depth).toBeCloseTo(25, 12);
  });

  it("gives the direction per phase in SD, seconds and % of max", () => {
    const { timing, depth } = result.direction;
    expect(timing.inhale?.sd).toBeCloseTo(0.25, 12);
    expect(timing.inhale?.s).toBeCloseTo(1.25, 12);
    expect(timing.exhale?.sd).toBeCloseTo(-0.35, 12);
    expect(timing.exhale?.s).toBeCloseTo(-1.75, 12);
    expect(depth.inhale?.sd).toBeCloseTo(1.25, 12);
    expect(depth.inhale?.pctOfMax).toBeCloseTo(3.75, 12);
    expect(depth.exhale?.sd).toBeCloseTo(-0.25, 12);
    expect(depth.exhale?.pctOfMax).toBeCloseTo(-0.75, 12);
  });

  it("fills the histograms and the missed/double count", () => {
    expect(result.histogram).toEqual({
      timing: [0, 0, 1, 0, 0, 1, 0, 0],
      depth: [0, 0, 0, 1, 0, 0, 0, 1],
      missedOrDouble: 2,
    });
  });

  it("counts missed, double and pacer transitions", () => {
    expect(result.counts).toEqual({ missed: 1, double: 1, pacer: 4 });
  });

  it("has no direction for a phase without a single match", () => {
    const none = score([]);
    expect(none.direction.timing.inhale).toBeNull();
    expect(none.direction.depth.exhale).toBeNull();
    expect(Math.abs(none.scores.total - 1)).toBeLessThan(TOLERANCE);
  });
});

describe("analysis index", () => {
  it("re-exports paced scoring", () => {
    expect(analysis.scorePaced).toBe(scorePaced);
    expect(analysis.pacerTransitions).toBe(pacerTransitions);
  });
});
