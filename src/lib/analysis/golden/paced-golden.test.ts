import { describe, expect, it } from "vitest";
import { scorePaced, type PacedResult } from "../paced";
import { PACED_GOLDEN, generateProfile, type PacedGoldenName } from "../synth";
import { detectTransitions } from "../transitions";
import {
  PACED_TIER_A,
  PACED_TIER_A_END_TO_END_SAMPLE_RATE_HZ,
  PACED_TIER_A_TOLERANCE,
  type PacedTierAName,
  type TierACase,
} from "./paced-tier-a";
import { PACED_TIER_B, type TierBRange } from "./paced-tier-b";

const TOL = PACED_TIER_A_TOLERANCE;

function near(actual: number | null | undefined, expected: number | null): void {
  if (expected === null) {
    expect(actual).toBeNull();
    return;
  }
  expect(actual).not.toBeNull();
  expect(actual).not.toBeUndefined();
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(TOL);
}

function within(actual: number | undefined, range: TierBRange): void {
  expect(actual).not.toBeUndefined();
  expect(actual).toBeGreaterThanOrEqual(range.min);
  expect(actual).toBeLessThanOrEqual(range.max);
}

function scoreCase(c: TierACase): PacedResult {
  return scorePaced(c.inputs, { halfCycleS: c.halfCycleS, durationS: c.durationS, skillLevel: c.skillLevel });
}

function expectSummary(result: PacedResult, c: TierACase): void {
  const e = c.expected;
  near(result.scores.timing.inhale, e.scores.timing.inhale);
  near(result.scores.timing.exhale, e.scores.timing.exhale);
  near(result.scores.depth.inhale, e.scores.depth.inhale);
  near(result.scores.depth.exhale, e.scores.depth.exhale);
  near(result.scores.total, e.scores.total);
  near(result.onTargetPct.timing, e.onTargetPct.timing);
  near(result.onTargetPct.depth, e.onTargetPct.depth);
  near(result.direction.timing.inhale?.sd, e.direction.timing.inhale.sd);
  near(result.direction.timing.inhale?.s, e.direction.timing.inhale.s);
  near(result.direction.timing.exhale?.sd, e.direction.timing.exhale.sd);
  near(result.direction.timing.exhale?.s, e.direction.timing.exhale.s);
  near(result.direction.depth.inhale?.sd, e.direction.depth.inhale.sd);
  near(result.direction.depth.inhale?.pctOfMax, e.direction.depth.inhale.pctOfMax);
  near(result.direction.depth.exhale?.sd, e.direction.depth.exhale.sd);
  near(result.direction.depth.exhale?.pctOfMax, e.direction.depth.exhale.pctOfMax);
  expect(result.counts).toEqual(e.counts);
  expect(result.histogram.missedOrDouble).toBe(e.histogram.missedOrDouble);
}

const tierANames = Object.keys(PACED_TIER_A) as PacedTierAName[];

describe("Tier A, scorer level, 5-5 180 s", () => {
  for (const name of tierANames) {
    const c: TierACase = PACED_TIER_A[name];

    describe(name, () => {
      const result = scoreCase(c);

      it("matches the per-transition derivation", () => {
        expect(result.transitions).toHaveLength(c.derivation.length);
        result.transitions.forEach((entry, i) => {
          const row = c.derivation[i];
          expect(entry.pacer.t).toBe(row.pacerT);
          expect(entry.type).toBe(row.type);
          expect(entry.missed).toBe(row.status === "missed");
          expect(entry.double).toBe(row.status === "double");
          expect(entry.matches.map((m) => m.t)).toEqual(row.matchT);
          near(entry.deltaTimeS, row.deltaTimeS);
          near(entry.dTime, row.dTime);
          near(entry.eTime, row.eTime);
          near(entry.timingPoints, row.timingPoints);
          near(entry.deltaDepthPct, row.deltaDepthPct);
          near(entry.dDepth, row.dDepth);
          near(entry.eDepth, row.eDepth);
          near(entry.depthPoints, row.depthPoints);
        });
      });

      it("matches the timing points per phase", () => {
        const points = (phase: string) =>
          result.transitions.filter((e) => e.phase === phase).map((e) => e.timingPoints);
        expect(points("inhale")).toEqual(c.expected.timingPoints.inhale);
        expect(points("exhale")).toEqual(c.expected.timingPoints.exhale);
      });

      it("matches the scores, on target %, direction and counts", () => {
        expectSummary(result, c);
      });

      it("matches the histograms", () => {
        expect(result.histogram.timing).toEqual(c.expected.histogram.timing);
        expect(result.histogram.depth).toEqual(c.expected.histogram.depth);
      });
    });
  }

  it("puts all 35 early timing values in the [-0.5, -0.25) bin", () => {
    expect(scoreCase(PACED_TIER_A.earlyBeginner).histogram.timing).toEqual([0, 0, 35, 0, 0, 0, 0, 0]);
  });

  it("finds 6 doubles and no misses on the 9 s cycle, with timing on target 29/35", () => {
    const result = scoreCase(PACED_TIER_A.shortCycle);
    expect(result.counts.double).toBe(6);
    expect(result.counts.missed).toBe(0);
    near(result.onTargetPct.timing, PACED_TIER_A.shortCycle.expected.onTargetPct.timing);
  });
});

describe("Tier A, end to end, noise-free", () => {
  const cases: [PacedGoldenName, PacedTierAName][] = [
    ["onTime", "onTime"],
    ["early", "earlyBeginner"],
  ];
  for (const [profile, name] of cases) {
    it(`reproduces ${name} from synth through detectTransitions`, () => {
      const c: TierACase = PACED_TIER_A[name];
      const fs = PACED_TIER_A_END_TO_END_SAMPLE_RATE_HZ;
      const user = generateProfile(PACED_GOLDEN[profile], { sampleRateHz: fs }).user;
      const result = scorePaced(detectTransitions(user, fs), {
        halfCycleS: c.halfCycleS,
        durationS: c.durationS,
        skillLevel: c.skillLevel,
      });
      expectSummary(result, c);
      expect(result.transitions.map((e) => e.timingPoints)).toEqual(c.derivation.map((row) => row.timingPoints));
      expect(result.transitions.map((e) => e.depthPoints)).toEqual(c.derivation.map((row) => row.depthPoints));
    });
  }
});

describe("Tier B, end to end with one shared noise setting", () => {
  const b = PACED_TIER_B;

  function run(profile: PacedGoldenName): PacedResult {
    const user = generateProfile(PACED_GOLDEN[profile], { sampleRateHz: b.sampleRateHz, noise: b.noise }).user;
    return scorePaced(detectTransitions(user, b.sampleRateHz), {
      halfCycleS: b.halfCycleS,
      durationS: b.durationS,
      skillLevel: b.skillLevel,
    });
  }

  const timing = (r: PacedResult) => (r.scores.timing.inhale + r.scores.timing.exhale) / 2;
  const depth = (r: PacedResult) => (r.scores.depth.inhale + r.scores.depth.exhale) / 2;

  it("on time: Total 9.6-10.0", () => {
    within(run("onTime").scores.total, b.expected.onTime.total);
  });

  it("0.35 SD early: Timing 6.7-7.3 and Depth 9.4-10.0", () => {
    const r = run("early");
    within(timing(r), b.expected.early.timing);
    within(depth(r), b.expected.early.depth);
  });

  it("half depth: Depth 5.2-6.1", () => {
    within(depth(run("halfDepth")), b.expected.halfDepth.depth);
  });

  it("1.8x depth: Depth 2.1-2.7", () => {
    within(depth(run("deep")), b.expected.deep.depth);
  });

  it("+4.5 / -1.5: Depth In 5.3-5.9, Depth Ex 4.9-5.5, direction +0.5 and -0.5 SD", () => {
    const r = run("offset");
    within(r.scores.depth.inhale, b.expected.offset.depthInhale);
    within(r.scores.depth.exhale, b.expected.offset.depthExhale);
    within(r.direction.depth.inhale?.sd, b.expected.offset.depthDirectionInhaleSd);
    within(r.direction.depth.exhale?.sd, b.expected.offset.depthDirectionExhaleSd);
  });

  it("9 s cycle: Timing 5.4-6.0 with at least one double", () => {
    const r = run("shortCycle");
    within(timing(r), b.expected.shortCycle.timing);
    expect(r.counts.double).toBeGreaterThanOrEqual(b.expected.shortCycle.minDouble);
  });
});
