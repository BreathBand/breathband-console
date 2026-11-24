import { describe, expect, it } from "vitest";
import { FIXED_CONSTANTS, OPEN_CONSTANTS } from "./config";
import * as analysis from "./index";
import {
  DEMO_FAULTS,
  GOLDEN_DURATION_S,
  PACED_GOLDEN,
  PACER_5_5,
  PACER_AMPLITUDE_PCT,
  cycleS,
  generateProfile,
  type SynthProfile,
} from "./synth";
import { detectTransitions, findExtrema, type DetectedTransition } from "./transitions";

const FS = 20;
const HALF_CYCLE_S = cycleS(PACER_5_5) / 2;
const LEVEL_TOLERANCE = 0.01;
const PROMINENCE = OPEN_CONSTANTS.transitionMinProminencePctOfMax;
const SPACING_S = OPEN_CONSTANTS.transitionMinSpacingS;
const LIMIT = FIXED_CONSTANTS.artifactLimitPctOfMax;
const SPIKE_PCT = 2.5 * LIMIT;

function profile(p: SynthProfile): number[] {
  return generateProfile(p, { sampleRateHz: FS }).user;
}

function expectAlternating(found: readonly DetectedTransition[]): void {
  for (let k = 1; k < found.length; k++) {
    expect(found[k].type).not.toBe(found[k - 1].type);
    expect(found[k].index).toBeGreaterThan(found[k - 1].index);
  }
}

function knotSignal(knots: readonly (readonly [number, number])[], durationS: number): number[] {
  const n = Math.round(durationS * FS);
  return Array.from({ length: n }, (_, i) => {
    const t = i / FS;
    let k = 0;
    while (k < knots.length - 2 && knots[k + 1][0] <= t) k++;
    const [t0, v0] = knots[k];
    const [t1, v1] = knots[k + 1];
    if (t >= t1) return v1;
    return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  });
}

function bump(height: number, centreS: number, widthS: number, durationS: number): number[] {
  const n = Math.round(durationS * FS);
  return Array.from({ length: n }, (_, i) => {
    const x = (i / FS - centreS) / widthS;
    return Math.abs(x) < 0.5 ? (height * (1 + Math.cos(2 * Math.PI * x))) / 2 : 0;
  });
}

describe("detectTransitions on the on-time 5-5 golden", () => {
  const signal = profile(PACED_GOLDEN.onTime);
  const found = detectTransitions(signal, FS);

  it("finds 35 alternating transitions starting with a peak", () => {
    expect(signal).toHaveLength(GOLDEN_DURATION_S * FS);
    expect(found).toHaveLength(35);
    expect(found[0].type).toBe("peak");
    expectAlternating(found);
  });

  it("places each within one sample of 5 k seconds with levels of +/-3", () => {
    found.forEach((tr, k) => {
      const expectedS = (k + 1) * HALF_CYCLE_S;
      expect(Math.abs(tr.index - expectedS * FS)).toBeLessThanOrEqual(1);
      expect(tr.t).toBe(tr.index / FS);
      const expectedLevel = tr.type === "peak" ? PACER_AMPLITUDE_PCT : -PACER_AMPLITUDE_PCT;
      expect(Math.abs(tr.level - expectedLevel)).toBeLessThanOrEqual(LEVEL_TOLERANCE);
    });
  });
});

describe("prominence", () => {
  for (const sign of [1, -1]) {
    const type = sign > 0 ? "peak" : "trough";

    it(`ignores a ${type} ripple just under the configured prominence`, () => {
      expect(detectTransitions(bump(sign * 0.9 * PROMINENCE, 5, 4, 10), FS)).toEqual([]);
    });

    it(`detects a ${type} ripple just over the configured prominence`, () => {
      const found = detectTransitions(bump(sign * 1.1 * PROMINENCE, 5, 4, 10), FS);
      expect(found).toHaveLength(1);
      expect(found[0].type).toBe(type);
      expect(Math.abs(found[0].index - 5 * FS)).toBeLessThanOrEqual(1);
    });
  }

  it("takes a custom prominence from the options", () => {
    const ripple = bump(0.9 * PROMINENCE, 5, 4, 10);
    expect(detectTransitions(ripple, FS, { minProminence: 0.5 * PROMINENCE })).toHaveLength(1);
  });
});

describe("spacing", () => {
  const close = SPACING_S * 0.6;
  const twoPeaks = knotSignal(
    [
      [0, 0],
      [1, 3],
      [1 + close / 2, 1],
      [1 + close, 2.5],
      [2.5, 0],
    ],
    3,
  );

  it("keeps only the higher of two peaks closer than transitionMinSpacingS", () => {
    const peaks = findExtrema(twoPeaks, FS).filter((tr) => tr.type === "peak");
    expect(peaks).toHaveLength(1);
    expect(peaks[0].index).toBe(FS);
    expect(peaks[0].level).toBe(3);
  });

  it("keeps both when the spacing allows it", () => {
    const peaks = findExtrema(twoPeaks, FS, { minSpacingS: 0 }).filter((tr) => tr.type === "peak");
    expect(peaks).toHaveLength(2);
  });

  it("keeps only the lower of two troughs closer than transitionMinSpacingS", () => {
    const troughs = findExtrema(
      twoPeaks.map((v) => -v),
      FS,
    ).filter((tr) => tr.type === "trough");
    expect(troughs).toHaveLength(1);
    expect(troughs[0].level).toBe(-3);
  });

  it("leaves one peak after filtering two close peaks", () => {
    expect(detectTransitions(twoPeaks, FS).filter((tr) => tr.type === "peak")).toHaveLength(1);
  });
});

describe("alternation", () => {
  const knots: [number, number][] = [
    [0, 0],
    [1, 5],
    [2, -5],
    [2 + SPACING_S * 0.4, 3],
    [2 + SPACING_S * 0.8, -4],
    [3.5, 4],
    [4.5, -5],
    [5.5, 0],
  ];
  const signal = knotSignal(knots, 6);

  it("keeps only the higher of two peaks left next to each other", () => {
    const found = findExtrema(signal, FS);
    expectAlternating(found);
    expect(found.map((tr) => tr.type)).toEqual(["peak", "trough", "peak", "trough"]);
    expect(found.map((tr) => tr.level)).toEqual([5, -5, 4, -5]);
    expect(found[2].index).toBe(3.5 * FS);
  });

  it("keeps only the lower of two troughs left next to each other", () => {
    const found = findExtrema(
      signal.map((v) => -v),
      FS,
    );
    expectAlternating(found);
    expect(found.map((tr) => tr.type)).toEqual(["trough", "peak", "trough", "peak"]);
    expect(found.map((tr) => tr.level)).toEqual([-5, 5, -4, 5]);
    expect(found[2].index).toBe(3.5 * FS);
  });

  for (const [name, p] of Object.entries(PACED_GOLDEN)) {
    it(`alternates strictly on the ${name} golden`, () => {
      const found = detectTransitions(profile(p), FS);
      expect(found.length).toBeGreaterThan(0);
      expectAlternating(found);
    });
  }

  for (const [group, faults] of Object.entries(DEMO_FAULTS)) {
    for (const [name, p] of Object.entries(faults)) {
      it(`alternates strictly on the ${group} ${name} demo`, () => {
        const found = detectTransitions(profile(p), FS);
        expect(found.length).toBeGreaterThan(0);
        expectAlternating(found);
      });
    }
  }
});

describe("artifacts and holds", () => {
  const clean = profile(PACED_GOLDEN.onTime);
  const reference = detectTransitions(clean, FS);

  for (const [group, faults] of Object.entries(DEMO_FAULTS)) {
    it(`keeps every level within the artifact limit on the ${group} lost-then-recovered demo`, () => {
      const signal = profile(faults.lostThenRecovered);
      expect(signal.some((v) => Math.abs(v) > LIMIT)).toBe(true);
      for (const tr of detectTransitions(signal, FS)) expect(Math.abs(tr.level)).toBeLessThanOrEqual(LIMIT);
    });
  }

  it("gives the same transitions with single-sample +/-250% spikes added", () => {
    const spiked = [...clean];
    const spikeAt = [37, 100, 333, 700, 1203, 1999, 2400, 3001, 3555];
    spikeAt.forEach((index, k) => {
      spiked[index] = k % 2 === 0 ? SPIKE_PCT : -SPIKE_PCT;
    });
    const found = detectTransitions(spiked, FS);
    expect(found).toHaveLength(reference.length);
    found.forEach((tr, k) => {
      expect(tr.type).toBe(reference[k].type);
      expect(Math.abs(tr.index - reference[k].index)).toBeLessThanOrEqual(1);
      expect(Math.abs(tr.level)).toBeLessThanOrEqual(LIMIT);
    });
  });

  it("skips non-finite samples and returns nothing when every sample is an artifact", () => {
    const gappy = [...clean];
    gappy[500] = Number.NaN;
    gappy[0] = Number.POSITIVE_INFINITY;
    gappy[gappy.length - 1] = SPIKE_PCT;
    expect(detectTransitions(gappy, FS)).toHaveLength(reference.length);
    expect(detectTransitions(new Array<number>(50).fill(SPIKE_PCT), FS)).toEqual([]);
    expect(detectTransitions([], FS)).toEqual([]);
  });

  it("finds nothing inside a 10 s flat hold and leaves the transitions around it unchanged", () => {
    const holdS = 10;
    const start = Math.round(9.5 * HALF_CYCLE_S * FS);
    const length = holdS * FS;
    const held = [...clean.slice(0, start), ...new Array<number>(length).fill(clean[start]), ...clean.slice(start)];
    const copy = [...held];
    const found = detectTransitions(held, FS);
    expect(held).toEqual(copy);
    expect(found.filter((tr) => tr.index > start && tr.index < start + length)).toEqual([]);
    expect(found).toHaveLength(reference.length);
    found.forEach((tr, k) => {
      const ref = reference[k];
      const shift = ref.index < start ? 0 : length;
      expect(tr.type).toBe(ref.type);
      expect(Math.abs(tr.index - (ref.index + shift))).toBeLessThanOrEqual(1);
      expect(Math.abs(tr.level - ref.level)).toBeLessThanOrEqual(LEVEL_TOLERANCE);
      expect(tr.index).toBeLessThan(held.length);
      expect(tr.t).toBe(tr.index / FS);
    });
  });

  it("is re-exported from the analysis index", () => {
    expect(analysis.detectTransitions).toBe(detectTransitions);
    expect(analysis.findExtrema).toBe(findExtrema);
  });
});
