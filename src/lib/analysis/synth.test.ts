import { describe, expect, it } from "vitest";
import { FIXED_CONSTANTS } from "./config";
import * as analysis from "./index";
import {
  DEMO_FAULTS,
  PACED_GOLDEN,
  PACED_NORMAL_PATTERN,
  OPEN_NORMAL_PATTERN,
  PACER_5_5,
  generateCalibration,
  generatePiecewise,
  generateProfile,
  generateSignal,
  mulberry32,
  pacerPattern,
  toRaw,
  type BreathPattern,
  type SynthNoise,
} from "./synth";

const RATE = 20;
const EPS = 1e-9;

function localMaxima(values: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1] && values[i] > values[i + 1]) out.push(i);
  }
  return out;
}

function localMinima(values: readonly number[]): number[] {
  return localMaxima(values.map((v) => -v));
}

function sd(values: readonly number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

const pattern15: BreathPattern = { inhaleS: 1.5, exhaleS: 3, peakPct: 3, troughPct: -3 };

describe("generateSignal", () => {
  it("writes durationS × sampleRateHz samples at i / sampleRateHz", () => {
    const signal = generateSignal(pattern15, { durationS: 180, sampleRateHz: RATE });
    expect(signal.user).toHaveLength(3600);
    expect(signal.t).toHaveLength(3600);
    expect(signal.t[37]).toBe(37 / RATE);
    expect(signal.pacer).toBeUndefined();
    expect(generateSignal(pattern15, { durationS: 7.5, sampleRateHz: 50 }).user).toHaveLength(375);
  });

  it("peaks at +3 and troughs at -3 for a 1.5 s inhale / 3.0 s exhale", () => {
    const { user, t, transitions } = generateSignal(pattern15, { durationS: 30, sampleRateHz: RATE });
    expect(Math.abs(Math.max(...user) - 3)).toBeLessThan(EPS);
    expect(Math.abs(Math.min(...user) + 3)).toBeLessThan(EPS);
    expect(user[0]).toBe(-3);
    expect(user[t.indexOf(1.5)]).toBe(3);
    expect(user[t.indexOf(4.5)]).toBe(-3);
    const peaks = transitions.filter((tr) => tr.kind === "peak").map((tr) => tr.t);
    expect(peaks.slice(0, 3)).toEqual([1.5, 6, 10.5]);
  });

  it("starts the pacer at a trough at t = 0 and rises first, ±3% of max", () => {
    const { pacer } = generateSignal(pacerPattern(PACER_5_5), { durationS: 20, sampleRateHz: RATE });
    expect(pacer).toBeDefined();
    const p = pacer ?? [];
    expect(p[0]).toBe(-FIXED_CONSTANTS.referenceDepthPeakToTroughPctOfMax / 2);
    expect(p[1]).toBeGreaterThan(p[0]);
    expect(p[100]).toBe(3);
    expect(p[200]).toBe(-3);
  });

  it("maps % of max to raw units as midline + pct / 100 × a100", () => {
    const scale = { a100: 2.2, midline: 2.3 };
    expect(toRaw([0, 100, -100, 3, -50], scale)).toEqual([2.3, 2.3 + 2.2, 2.3 - 2.2, 2.3 + 0.03 * 2.2, 2.3 - 1.1]);
    const { user } = generateSignal(pattern15, { durationS: 10, sampleRateHz: RATE });
    const raw = toRaw(user, scale);
    raw.forEach((v, i) => expect(Math.abs(v - (2.3 + (user[i] / 100) * 2.2))).toBeLessThan(EPS));
  });
});

describe("generatePiecewise", () => {
  it("switches pattern at a marker", () => {
    const later: BreathPattern = { inhaleS: 2, exhaleS: 2, peakPct: 6, troughPct: -6 };
    const options = { durationS: 60, sampleRateHz: RATE };
    const joined = generatePiecewise(
      [
        { fromS: 30, pattern: later },
        { fromS: 0, pattern: pattern15 },
      ],
      options,
    );
    const first = generateSignal(pattern15, options);
    const second = generateSignal(later, options);
    for (let i = 0; i < 600; i++) expect(joined.user[i]).toBe(first.user[i]);
    for (let i = 600; i < 1200; i++) expect(joined.user[i]).toBe(second.user[i]);
    for (const tr of joined.transitions) expect(Math.abs(tr.level)).toBe(tr.t < 30 ? 3 : 6);
  });

  it("returns a pacer only when every segment is paced", () => {
    const options = { durationS: 20, sampleRateHz: RATE };
    const paced = generatePiecewise([{ fromS: 0, pattern: PACED_NORMAL_PATTERN }], options);
    expect(paced.pacer).toHaveLength(400);
    const mixed = generatePiecewise(
      [
        { fromS: 0, pattern: PACED_NORMAL_PATTERN },
        { fromS: 10, pattern: pattern15 },
      ],
      options,
    );
    expect(mixed.pacer).toBeUndefined();
  });

  it("rejects an empty segment list and bad rates", () => {
    expect(() => generatePiecewise([], { durationS: 10, sampleRateHz: RATE })).toThrow(RangeError);
    expect(() => generateSignal(pattern15, { durationS: 10, sampleRateHz: 0 })).toThrow(RangeError);
    expect(() => generateSignal({ ...pattern15, inhaleS: 0 }, { durationS: 10, sampleRateHz: RATE })).toThrow(
      RangeError,
    );
  });
});

describe("PACED_GOLDEN", () => {
  const run = (name: keyof typeof PACED_GOLDEN) => generateProfile(PACED_GOLDEN[name], { sampleRateHz: RATE });

  it("runs every profile for 180 s against the 5-5 pacer", () => {
    for (const profile of Object.values(PACED_GOLDEN)) {
      expect(profile.durationS).toBe(180);
      expect(profile.segments[0].pattern.pacer).toEqual(PACER_5_5);
    }
    expect(PACER_5_5).toEqual({ inhaleS: 5, exhaleS: 5 });
  });

  it("onTime equals the pacer sample by sample", () => {
    const { user, pacer } = run("onTime");
    expect(pacer).toHaveLength(3600);
    user.forEach((v, i) => expect(Math.abs(v - (pacer ?? [])[i])).toBeLessThan(EPS));
  });

  it("early is 0.35 timing SD (1.75 s) early, first peak at 3.25 s", () => {
    expect(PACED_GOLDEN.early.segments[0].pattern.shiftS).toBeCloseTo(-1.75, 12);
    const { user, t, transitions } = run("early");
    expect(t[localMaxima(user)[0]]).toBe(3.25);
    expect(transitions.find((tr) => tr.kind === "peak")?.t).toBeCloseTo(3.25, 12);
  });

  it.each([
    ["halfDepth", 1.5, -1.5],
    ["deep", 5.4, -5.4],
    ["offset", 4.5, -1.5],
  ] as const)("%s reaches its peak and trough levels", (name, peak, trough) => {
    const { user } = run(name);
    expect(Math.abs(Math.max(...user) - peak)).toBeLessThan(EPS);
    expect(Math.abs(Math.min(...user) - trough)).toBeLessThan(EPS);
  });

  it("shortCycle peaks 9 s apart against the 10 s pacer", () => {
    const { user, t, pacer } = run("shortCycle");
    const peaks = localMaxima(user).map((i) => t[i]);
    expect(peaks.length).toBeGreaterThan(15);
    for (let k = 1; k < peaks.length; k++) expect(Math.abs(peaks[k] - peaks[k - 1] - 9)).toBeLessThan(EPS);
    const pacerPeaks = localMaxima(pacer ?? []).map((i) => t[i]);
    expect(pacerPeaks[1] - pacerPeaks[0]).toBe(10);
  });
});

describe("DEMO_FAULTS", () => {
  it("has early, shallow, too deep, too fast and lost-then-recovered for paced and open sessions", () => {
    for (const kind of ["paced", "open"] as const) {
      expect(Object.keys(DEMO_FAULTS[kind]).sort()).toEqual(
        ["early", "lostThenRecovered", "shallow", "tooDeep", "tooFast"].sort(),
      );
    }
  });

  it("makes each fault differ from its normal pattern in the named way", () => {
    for (const [kind, normal] of [
      ["paced", PACED_NORMAL_PATTERN],
      ["open", OPEN_NORMAL_PATTERN],
    ] as const) {
      const faults = DEMO_FAULTS[kind];
      const depth = (p: BreathPattern) => p.peakPct - p.troughPct;
      const cycle = (p: BreathPattern) => p.inhaleS + p.exhaleS;
      expect(depth(faults.shallow.segments[0].pattern)).toBeLessThan(depth(normal));
      expect(depth(faults.tooDeep.segments[0].pattern)).toBeGreaterThan(depth(normal));
      expect(cycle(faults.tooFast.segments[0].pattern)).toBeLessThan(cycle(normal));
      const early = faults.early.segments[0].pattern;
      expect((early.shiftS ?? 0) < 0 || early.inhaleS < normal.inhaleS).toBe(true);
    }
    const rate = 60 / (OPEN_NORMAL_PATTERN.inhaleS + OPEN_NORMAL_PATTERN.exhaleS);
    expect(rate).toBeGreaterThanOrEqual(FIXED_CONSTANTS.normalRateBpm.min);
    expect(rate).toBeLessThanOrEqual(FIXED_CONSTANTS.normalRateBpm.max);
  });

  it.each(["paced", "open"] as const)("%s lost-then-recovered is flat with spikes beyond ±100%%", (kind) => {
    const profile = DEMO_FAULTS[kind].lostThenRecovered;
    const lost = profile.lost;
    expect(lost).toBeDefined();
    const span = lost ?? { fromS: 0, toS: 0 };
    const { user, t } = generateProfile(profile, { sampleRateHz: RATE });
    const normal = generateSignal(profile.segments[0].pattern, { durationS: profile.durationS, sampleRateHz: RATE });
    const inSpan = (i: number) => t[i] >= span.fromS && t[i] < span.toS;
    let spikes = 0;
    user.forEach((v, i) => {
      if (!inSpan(i)) {
        expect(v).toBe(normal.user[i]);
        return;
      }
      if (v === 0) return;
      spikes++;
      expect(Math.abs(v)).toBeGreaterThan(FIXED_CONSTANTS.artifactLimitPctOfMax);
      expect(user[i - 1]).toBe(0);
      expect(user[i + 1]).toBe(0);
      expect(inSpan(i - 1) && inSpan(i + 1)).toBe(true);
    });
    expect(spikes).toBeGreaterThan(5);
    expect(user.some((v, i) => inSpan(i) && v > 100)).toBe(true);
    expect(user.some((v, i) => inSpan(i) && v < -100)).toBe(true);
  });
});

describe("noise", () => {
  const options = (noise: SynthNoise) => ({ durationS: 180, sampleRateHz: RATE, noise });
  const full: Omit<SynthNoise, "seed"> = { sampleSdPct: 0.4, amplitudeSdPct: 0.5, timingSdS: 0.2 };

  it("gives identical arrays for the same seed and different arrays for another", () => {
    const a = generateSignal(PACED_NORMAL_PATTERN, options({ seed: 7, ...full }));
    const b = generateSignal(PACED_NORMAL_PATTERN, options({ seed: 7, ...full }));
    const c = generateSignal(PACED_NORMAL_PATTERN, options({ seed: 8, ...full }));
    expect(a.user).toEqual(b.user);
    expect(a.transitions).toEqual(b.transitions);
    expect(a.user).not.toEqual(c.user);
    expect(a.transitions).not.toEqual(c.transitions);
    expect(a.pacer).toEqual(c.pacer);
  });

  it.each([
    ["per-sample", { sampleSdPct: 0.4 }],
    ["amplitude", { amplitudeSdPct: 0.5 }],
    ["timing", { timingSdS: 0.2 }],
  ] as const)("%s noise changes the signal and a 0 SD leaves it exact", (_, kind) => {
    const clean = generateSignal(PACED_NORMAL_PATTERN, { durationS: 180, sampleRateHz: RATE });
    const noisy = generateSignal(PACED_NORMAL_PATTERN, options({ seed: 3, ...kind }));
    expect(noisy.user).not.toEqual(clean.user);
    const zero = Object.fromEntries(Object.keys(kind).map((k) => [k, 0]));
    expect(generateSignal(PACED_NORMAL_PATTERN, options({ seed: 3, ...zero })).user).toEqual(clean.user);
  });

  it("gives the clean signal exactly when every SD is 0", () => {
    const clean = generateSignal(pattern15, { durationS: 180, sampleRateHz: RATE });
    const zero = generateSignal(pattern15, options({ seed: 99, sampleSdPct: 0, amplitudeSdPct: 0, timingSdS: 0 }));
    expect(zero.user).toEqual(clean.user);
    expect(zero.transitions).toEqual(clean.transitions);
  });

  it.each([1, 42, 2026])("measures the per-sample SD within 10%% over 180 s at 20 Hz (seed %i)", (seed) => {
    const sampleSdPct = 0.8;
    const clean = generateSignal(PACED_NORMAL_PATTERN, { durationS: 180, sampleRateHz: RATE });
    const noisy = generateSignal(PACED_NORMAL_PATTERN, options({ seed, sampleSdPct }));
    const measured = sd(noisy.user.map((v, i) => v - clean.user[i]));
    expect(Math.abs(measured - sampleSdPct) / sampleSdPct).toBeLessThan(0.1);
  });

  it("jitters transition levels and times by about their SDs", () => {
    const noisy = generateSignal(PACED_NORMAL_PATTERN, options({ seed: 5, amplitudeSdPct: 0.5, timingSdS: 0.2 }));
    const transitions = noisy.transitions;
    expect(transitions.length).toBeGreaterThan(30);
    for (let i = 1; i < transitions.length; i++) {
      expect(transitions[i].t).toBeGreaterThan(transitions[i - 1].t);
      expect(transitions[i].kind).not.toBe(transitions[i - 1].kind);
    }
    const levelErrors = transitions.map((tr) => tr.level - (tr.kind === "peak" ? 3 : -3));
    const timeErrors = transitions.map((tr) => tr.t - Math.round(tr.t / 5) * 5);
    expect(Math.abs(sd(levelErrors) - 0.5) / 0.5).toBeLessThan(0.35);
    expect(Math.abs(sd(timeErrors) - 0.2) / 0.2).toBeLessThan(0.35);
  });

  it("uses a PRNG in [0, 1) that repeats for a seed", () => {
    const a = mulberry32(11);
    const b = mulberry32(11);
    const values = Array.from({ length: 1000 }, () => a());
    expect(values).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe("generateCalibration", () => {
  it("knows A100 and the midline from the recording's highest peaks and lowest troughs", () => {
    const scale = { a100: 2.2, midline: 2.3 };
    const rec = generateCalibration({ ...scale, sampleRateHz: RATE });
    expect(rec.raw).toHaveLength(rec.t.length);
    const peaks = localMaxima(rec.raw).map((i) => rec.raw[i]);
    const troughs = localMinima(rec.raw).map((i) => rec.raw[i]);
    expect(peaks).toHaveLength(rec.peaks.length);
    expect(troughs).toHaveLength(rec.troughs.length);
    const top = [...peaks].sort((a, b) => b - a).slice(0, 3);
    const bottom = [...troughs].sort((a, b) => a - b).slice(0, 3);
    const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
    expect(Math.abs(mean(top) - mean(bottom) - rec.expectedA100)).toBeLessThan(EPS);
    expect(Math.abs((mean(top) + mean(bottom)) / 2 - rec.expectedMidline)).toBeLessThan(EPS);
    expect(Math.abs(rec.expectedA100 - scale.a100)).toBeLessThan(EPS);
    expect(Math.abs(rec.expectedMidline - scale.midline)).toBeLessThan(EPS);
    expect(Math.abs(Math.max(...rec.raw) - Math.max(...rec.peaks))).toBeLessThan(EPS);
    expect(Math.abs(Math.min(...rec.raw) - Math.min(...rec.troughs))).toBeLessThan(EPS);
  });

  it("rejects fewer than three breaths", () => {
    expect(() =>
      generateCalibration({ a100: 1, midline: 0, sampleRateHz: RATE, peaksPct: [50, 50], troughsPct: [-50, -50] }),
    ).toThrow(RangeError);
  });
});

describe("analysis index", () => {
  it("re-exports synth", () => {
    expect(analysis.generateSignal).toBe(generateSignal);
    expect(analysis.PACED_GOLDEN).toBe(PACED_GOLDEN);
    expect(analysis.toRaw).toBe(toRaw);
  });
});
