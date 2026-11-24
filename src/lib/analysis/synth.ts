import { FIXED_CONSTANTS, OPEN_CONSTANTS } from "./config";

export interface HalfCycles {
  readonly inhaleS: number;
  readonly exhaleS: number;
}

export interface BreathPattern extends HalfCycles {
  readonly peakPct: number;
  readonly troughPct: number;
  readonly shiftS?: number;
  readonly pacer?: HalfCycles;
}

export interface SynthNoise {
  readonly seed: number;
  readonly sampleSdPct?: number;
  readonly amplitudeSdPct?: number;
  readonly timingSdS?: number;
}

export interface SynthOptions {
  readonly durationS: number;
  readonly sampleRateHz: number;
  readonly noise?: SynthNoise;
}

export interface PatternSegment {
  readonly fromS: number;
  readonly pattern: BreathPattern;
}

export interface Transition {
  readonly t: number;
  readonly level: number;
  readonly kind: "peak" | "trough";
}

export interface SynthSignal {
  readonly t: number[];
  readonly user: number[];
  readonly pacer?: number[];
  readonly transitions: Transition[];
}

export interface RawScale {
  readonly a100: number;
  readonly midline: number;
}

export interface LostSpan {
  readonly fromS: number;
  readonly toS: number;
  readonly spikeEveryS?: number;
}

export interface SynthProfile {
  readonly durationS: number;
  readonly segments: readonly PatternSegment[];
  readonly lost?: LostSpan;
}

interface Knot {
  readonly t: number;
  readonly level: number;
}

export const PACER_AMPLITUDE_PCT = FIXED_CONSTANTS.referenceDepthPeakToTroughPctOfMax / 2;

export const [PACER_2_2, PACER_5_5] = FIXED_CONSTANTS.pacersS;

const MAX_TIMING_JITTER_FRACTION_OF_HALF = 0.49;
const SPIKE_SCALES = [1.5, 2.25, 1.2, 3];
const DEFAULT_SPIKE_EVERY_S = 1.5;
const SECONDS_PER_MINUTE = 60;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(random: () => number): () => number {
  return () => {
    const u = 1 - random();
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

function stream(seed: number, salt: number): () => number {
  return gaussian(mulberry32((seed ^ Math.imul(salt, 0x9e3779b9)) >>> 0));
}

function assertPositive(name: string, value: number): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new RangeError(`synth: ${name} must be a positive finite number, got ${value}`);
  }
}

export function cycleS(halves: HalfCycles): number {
  return halves.inhaleS + halves.exhaleS;
}

export function withCycle(pattern: BreathPattern, cycle: number): BreathPattern {
  const total = cycleS(pattern);
  return { ...pattern, inhaleS: (pattern.inhaleS * cycle) / total, exhaleS: (pattern.exhaleS * cycle) / total };
}

export function withDepth(pattern: BreathPattern, factor: number): BreathPattern {
  return { ...pattern, peakPct: pattern.peakPct * factor, troughPct: pattern.troughPct * factor };
}

export function pacerPattern(pacer: HalfCycles): BreathPattern {
  return {
    inhaleS: pacer.inhaleS,
    exhaleS: pacer.exhaleS,
    peakPct: PACER_AMPLITUDE_PCT,
    troughPct: -PACER_AMPLITUDE_PCT,
    pacer,
  };
}

export function sampleTimes(durationS: number, sampleRateHz: number): number[] {
  assertPositive("durationS", durationS);
  assertPositive("sampleRateHz", sampleRateHz);
  const n = Math.round(durationS * sampleRateHz);
  return Array.from({ length: n }, (_, i) => i / sampleRateHz);
}

function patternTransitions(pattern: BreathPattern, fromS: number, toS: number): Transition[] {
  assertPositive("inhaleS", pattern.inhaleS);
  assertPositive("exhaleS", pattern.exhaleS);
  const cycle = cycleS(pattern);
  const shift = pattern.shiftS ?? 0;
  const first = Math.floor((fromS - shift) / cycle) - 1;
  const last = Math.ceil((toS - shift) / cycle) + 1;
  const out: Transition[] = [];
  for (let k = first; k <= last; k++) {
    const start = shift + k * cycle;
    out.push({ t: start, level: pattern.troughPct, kind: "trough" });
    out.push({ t: start + pattern.inhaleS, level: pattern.peakPct, kind: "peak" });
  }
  return out;
}

function jitterTransitions(
  transitions: Transition[],
  pattern: BreathPattern,
  noise: SynthNoise | undefined,
  timing: () => number,
  amplitude: () => number,
): Transition[] {
  const timingSd = noise?.timingSdS ?? 0;
  const amplitudeSd = noise?.amplitudeSdPct ?? 0;
  if (timingSd <= 0 && amplitudeSd <= 0) return transitions;
  const limit = MAX_TIMING_JITTER_FRACTION_OF_HALF * Math.min(pattern.inhaleS, pattern.exhaleS);
  return transitions.map((tr) => {
    let t = tr.t;
    let level = tr.level;
    if (timingSd > 0) t += Math.min(limit, Math.max(-limit, timingSd * timing()));
    if (amplitudeSd > 0) level += amplitudeSd * amplitude();
    return { t, level, kind: tr.kind };
  });
}

function halfCosine(a: Knot, b: Knot, t: number): number {
  const x = (t - a.t) / (b.t - a.t);
  return a.level + ((b.level - a.level) * (1 - Math.cos(Math.PI * x))) / 2;
}

function render(knots: readonly Knot[], t: readonly number[], from: number, to: number, out: number[]): void {
  let j = 0;
  for (let i = from; i < to; i++) {
    while (j < knots.length - 2 && knots[j + 1].t <= t[i]) j++;
    out[i] = halfCosine(knots[j], knots[j + 1], t[i]);
  }
}

export function generatePiecewise(segments: readonly PatternSegment[], options: SynthOptions): SynthSignal {
  if (segments.length === 0) throw new RangeError("synth: generatePiecewise needs at least one segment");
  const t = sampleTimes(options.durationS, options.sampleRateHz);
  const ordered = [...segments].sort((a, b) => a.fromS - b.fromS);
  const paced = ordered.every((s) => s.pattern.pacer !== undefined);
  const noise = options.noise;
  const timing = stream(noise?.seed ?? 0, 1);
  const amplitude = stream(noise?.seed ?? 0, 2);
  const user = new Array<number>(t.length).fill(0);
  const pacer = paced ? new Array<number>(t.length).fill(0) : undefined;
  const transitions: Transition[] = [];
  let i = 0;
  ordered.forEach((segment, s) => {
    const startS = s === 0 ? 0 : segment.fromS;
    const endS = s + 1 < ordered.length ? ordered[s + 1].fromS : options.durationS;
    const from = i;
    while (i < t.length && t[i] < endS) i++;
    const knots = jitterTransitions(
      patternTransitions(segment.pattern, startS, endS),
      segment.pattern,
      noise,
      timing,
      amplitude,
    );
    render(knots, t, from, i, user);
    for (const k of knots) if (k.t >= startS && k.t < endS) transitions.push(k);
    if (pacer && segment.pattern.pacer) {
      render(patternTransitions(pacerPattern(segment.pattern.pacer), startS, endS), t, from, i, pacer);
    }
  });
  const sampleSd = noise?.sampleSdPct ?? 0;
  if (noise && sampleSd > 0) {
    const sample = stream(noise.seed, 3);
    for (let n = 0; n < user.length; n++) user[n] += sampleSd * sample();
  }
  return pacer ? { t, user, pacer, transitions } : { t, user, transitions };
}

export function generateSignal(pattern: BreathPattern, options: SynthOptions): SynthSignal {
  return generatePiecewise([{ fromS: 0, pattern }], options);
}

export function rawValue(pct: number, scale: RawScale): number {
  return scale.midline + (pct / 100) * scale.a100;
}

export function toRaw(pct: readonly number[], scale: RawScale): number[] {
  return pct.map((v) => rawValue(v, scale));
}

export function withLostSpan(signal: SynthSignal, span: LostSpan, sampleRateHz: number): SynthSignal {
  assertPositive("sampleRateHz", sampleRateHz);
  if (!(span.toS > span.fromS)) throw new RangeError("synth: a lost span must end after it starts");
  const user = [...signal.user];
  const first = Math.max(0, Math.ceil(span.fromS * sampleRateHz));
  const end = Math.min(user.length, Math.ceil(span.toS * sampleRateHz));
  for (let i = first; i < end; i++) user[i] = 0;
  const step = Math.max(2, Math.round((span.spikeEveryS ?? DEFAULT_SPIKE_EVERY_S) * sampleRateHz));
  for (let k = 0, i = first + Math.floor(step / 2); i < end - 1; k++, i += step) {
    const sign = k % 2 === 0 ? 1 : -1;
    user[i] = sign * FIXED_CONSTANTS.artifactLimitPctOfMax * SPIKE_SCALES[k % SPIKE_SCALES.length];
  }
  const transitions = signal.transitions.filter((tr) => tr.t < span.fromS || tr.t >= span.toS);
  return { ...signal, user, transitions };
}

export function generateProfile(profile: SynthProfile, options: Omit<SynthOptions, "durationS">): SynthSignal {
  const signal = generatePiecewise(profile.segments, { ...options, durationS: profile.durationS });
  return profile.lost ? withLostSpan(signal, profile.lost, options.sampleRateHz) : signal;
}

export function lostThenRecovered(pattern: BreathPattern, durationS: number, lost: LostSpan): SynthProfile {
  return { durationS, segments: [{ fromS: 0, pattern }], lost };
}

function single(pattern: BreathPattern, durationS: number): SynthProfile {
  return { durationS, segments: [{ fromS: 0, pattern }] };
}

export const GOLDEN_DURATION_S = 180;

export const GOLDEN_FACTORS = {
  earlyTimingSd: 0.35,
  halfDepth: 0.5,
  deep: 1.8,
  offsetFractionOfAmplitude: 0.5,
  shortCycleS: 9,
} as const;

const goldenPacer = pacerPattern(PACER_5_5);
const goldenOffsetPct = PACER_AMPLITUDE_PCT * GOLDEN_FACTORS.offsetFractionOfAmplitude;

export function earlyShiftS(timingSds: number, pacer: HalfCycles): number {
  return -timingSds * (FIXED_CONSTANTS.timingSdBreathFraction * cycleS(pacer));
}

export const PACED_GOLDEN = {
  onTime: single(goldenPacer, GOLDEN_DURATION_S),
  early: single({ ...goldenPacer, shiftS: earlyShiftS(GOLDEN_FACTORS.earlyTimingSd, PACER_5_5) }, GOLDEN_DURATION_S),
  halfDepth: single(withDepth(goldenPacer, GOLDEN_FACTORS.halfDepth), GOLDEN_DURATION_S),
  deep: single(withDepth(goldenPacer, GOLDEN_FACTORS.deep), GOLDEN_DURATION_S),
  offset: single(
    { ...goldenPacer, peakPct: goldenPacer.peakPct + goldenOffsetPct, troughPct: goldenPacer.troughPct + goldenOffsetPct },
    GOLDEN_DURATION_S,
  ),
  shortCycle: single(withCycle(goldenPacer, GOLDEN_FACTORS.shortCycleS), GOLDEN_DURATION_S),
} as const satisfies Record<string, SynthProfile>;

export type PacedGoldenName = keyof typeof PACED_GOLDEN;

export type DemoFaultName = "early" | "shallow" | "tooDeep" | "tooFast" | "lostThenRecovered";

export const DEMO_DURATION_S = 180;

export const DEMO_FAULT_FACTORS = {
  pacedEarlyTimingSd: 0.5,
  openEarlyInhaleFractionOfMin: 0.75,
  shallowDepth: 0.5,
  tooDeepDepth: 2,
  tooFastRate: 1.25,
  lost: { fromS: 60, toS: 80 },
} as const;

const openRate = FIXED_CONSTANTS.normalRateBpm;
const openIe = FIXED_CONSTANTS.normalIeRatio;
const openCycleS = SECONDS_PER_MINUTE / ((openRate.min + openRate.max) / 2);
const openHalfDepthPct = OPEN_CONSTANTS.normalDepthBand.centrePctOfMax / 2;

export const OPEN_NORMAL_PATTERN: BreathPattern = {
  inhaleS: (openCycleS * openIe.inhale) / (openIe.inhale + openIe.exhale),
  exhaleS: (openCycleS * openIe.exhale) / (openIe.inhale + openIe.exhale),
  peakPct: openHalfDepthPct,
  troughPct: -openHalfDepthPct,
};

export const PACED_NORMAL_PATTERN: BreathPattern = goldenPacer;

export const DEMO_FAULTS = {
  paced: {
    early: single(
      { ...PACED_NORMAL_PATTERN, shiftS: earlyShiftS(DEMO_FAULT_FACTORS.pacedEarlyTimingSd, PACER_5_5) },
      DEMO_DURATION_S,
    ),
    shallow: single(withDepth(PACED_NORMAL_PATTERN, DEMO_FAULT_FACTORS.shallowDepth), DEMO_DURATION_S),
    tooDeep: single(withDepth(PACED_NORMAL_PATTERN, DEMO_FAULT_FACTORS.tooDeepDepth), DEMO_DURATION_S),
    tooFast: single(
      withCycle(PACED_NORMAL_PATTERN, cycleS(PACER_5_5) / DEMO_FAULT_FACTORS.tooFastRate),
      DEMO_DURATION_S,
    ),
    lostThenRecovered: lostThenRecovered(PACED_NORMAL_PATTERN, DEMO_DURATION_S, DEMO_FAULT_FACTORS.lost),
  },
  open: {
    early: single(
      {
        ...OPEN_NORMAL_PATTERN,
        inhaleS: OPEN_CONSTANTS.normalInhaleDurationS.min * DEMO_FAULT_FACTORS.openEarlyInhaleFractionOfMin,
      },
      DEMO_DURATION_S,
    ),
    shallow: single(withDepth(OPEN_NORMAL_PATTERN, DEMO_FAULT_FACTORS.shallowDepth), DEMO_DURATION_S),
    tooDeep: single(withDepth(OPEN_NORMAL_PATTERN, DEMO_FAULT_FACTORS.tooDeepDepth), DEMO_DURATION_S),
    tooFast: single(
      withCycle(OPEN_NORMAL_PATTERN, SECONDS_PER_MINUTE / (openRate.max * DEMO_FAULT_FACTORS.tooFastRate)),
      DEMO_DURATION_S,
    ),
    lostThenRecovered: lostThenRecovered(OPEN_NORMAL_PATTERN, DEMO_DURATION_S, DEMO_FAULT_FACTORS.lost),
  },
} as const satisfies Record<"paced" | "open", Record<DemoFaultName, SynthProfile>>;

export interface CalibrationOptions extends RawScale {
  readonly sampleRateHz: number;
  readonly inhaleS?: number;
  readonly exhaleS?: number;
  readonly restS?: number;
  readonly peaksPct?: readonly number[];
  readonly troughsPct?: readonly number[];
}

export interface CalibrationRecording {
  readonly t: number[];
  readonly raw: number[];
  readonly peaks: number[];
  readonly troughs: number[];
  readonly expectedA100: number;
  readonly expectedMidline: number;
}

export const CALIBRATION_EXTREMES_COUNT = 3;

export const CALIBRATION_DEFAULTS = {
  inhaleS: 3,
  exhaleS: 4,
  restS: 2,
  peaksPct: [46, 52, 48, 50, 44],
  troughsPct: [-47, -50, -52, -44, -48],
} as const;

function meanOf(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function generateCalibration(options: CalibrationOptions): CalibrationRecording {
  const inhaleS = options.inhaleS ?? CALIBRATION_DEFAULTS.inhaleS;
  const exhaleS = options.exhaleS ?? CALIBRATION_DEFAULTS.exhaleS;
  const restS = options.restS ?? CALIBRATION_DEFAULTS.restS;
  const peaksPct = options.peaksPct ?? CALIBRATION_DEFAULTS.peaksPct;
  const troughsPct = options.troughsPct ?? CALIBRATION_DEFAULTS.troughsPct;
  assertPositive("inhaleS", inhaleS);
  assertPositive("exhaleS", exhaleS);
  assertPositive("restS", restS);
  if (peaksPct.length !== troughsPct.length || peaksPct.length < CALIBRATION_EXTREMES_COUNT) {
    throw new RangeError(
      `synth: calibration needs matching peak and trough lists of at least ${CALIBRATION_EXTREMES_COUNT} breaths`,
    );
  }
  const knots: Knot[] = [
    { t: 0, level: 0 },
    { t: restS, level: 0 },
  ];
  let at = restS;
  peaksPct.forEach((peak, k) => {
    at += inhaleS;
    knots.push({ t: at, level: peak });
    at += exhaleS;
    knots.push({ t: at, level: troughsPct[k] });
  });
  at += inhaleS;
  knots.push({ t: at, level: 0 });
  at += restS;
  knots.push({ t: at, level: 0 });
  const t = sampleTimes(at, options.sampleRateHz);
  const pct = new Array<number>(t.length).fill(0);
  render(knots, t, 0, t.length, pct);
  const peaks = peaksPct.map((v) => rawValue(v, options));
  const troughs = troughsPct.map((v) => rawValue(v, options));
  const highest = meanOf([...peaks].sort((a, b) => b - a).slice(0, CALIBRATION_EXTREMES_COUNT));
  const lowest = meanOf([...troughs].sort((a, b) => a - b).slice(0, CALIBRATION_EXTREMES_COUNT));
  return {
    t,
    raw: toRaw(pct, options),
    peaks,
    troughs,
    expectedA100: highest - lowest,
    expectedMidline: (highest + lowest) / 2,
  };
}
