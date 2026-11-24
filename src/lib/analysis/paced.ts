import { combineTransitionScores } from "../domain/scores";
import type { DeviationHistogram, InhaleExhale } from "../domain/types";
import { FIXED_CONSTANTS, OPEN_CONSTANTS, type BreathPhase, type SkillLevel } from "./config";

export type PacedTransitionType = "peak" | "trough";

export interface PacedUserTransition {
  readonly t: number;
  readonly type: PacedTransitionType;
  readonly level: number;
}

export interface PacerTransition {
  readonly k: number;
  readonly t: number;
  readonly type: PacedTransitionType;
  readonly phase: BreathPhase;
  readonly level: number;
}

export interface PacedOptions {
  readonly halfCycleS: number;
  readonly durationS: number;
  readonly skillLevel: SkillLevel;
}

export interface PacedTransitionScore {
  readonly pacer: PacerTransition;
  readonly type: PacedTransitionType;
  readonly phase: BreathPhase;
  readonly matches: readonly PacedUserTransition[];
  readonly missed: boolean;
  readonly double: boolean;
  readonly deltaTimeS: number | null;
  readonly dTime: number | null;
  readonly eTime: number | null;
  readonly timingPoints: number;
  readonly deltaDepthPct: number | null;
  readonly dDepth: number | null;
  readonly eDepth: number | null;
  readonly depthPoints: number;
}

export interface PacedScores {
  readonly timing: InhaleExhale;
  readonly depth: InhaleExhale;
  readonly total: number;
}

export interface TimingDirection {
  readonly sd: number;
  readonly s: number;
}

export interface DepthDirection {
  readonly sd: number;
  readonly pctOfMax: number;
}

export interface PhaseDirections<T> {
  readonly inhale: T | null;
  readonly exhale: T | null;
}

export interface PacedResult {
  readonly sdTimeS: number;
  readonly sdDepthPct: number;
  readonly k: number;
  readonly transitions: readonly PacedTransitionScore[];
  readonly scores: PacedScores;
  readonly onTargetPct: { readonly timing: number; readonly depth: number };
  readonly direction: {
    readonly timing: PhaseDirections<TimingDirection>;
    readonly depth: PhaseDirections<DepthDirection>;
  };
  readonly histogram: DeviationHistogram;
  readonly counts: { readonly missed: number; readonly double: number; readonly pacer: number };
}

const PERCENT = 100;
const PACER_LEVEL_PCT = FIXED_CONSTANTS.referenceDepthPeakToTroughPctOfMax / 2;

function assertPositive(name: string, value: number): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new RangeError(`paced: ${name} must be a positive finite number, got ${value}`);
  }
}

function sign(type: PacedTransitionType): number {
  return type === "peak" ? 1 : -1;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function pacerTransitions(halfCycleS: number, durationS: number): PacerTransition[] {
  assertPositive("halfCycleS", halfCycleS);
  assertPositive("durationS", durationS);
  const out: PacerTransition[] = [];
  for (let k = 1; k * halfCycleS < durationS; k++) {
    const type: PacedTransitionType = k % 2 === 1 ? "peak" : "trough";
    out.push({
      k,
      t: k * halfCycleS,
      type,
      phase: OPEN_CONSTANTS.extremumPhase[type],
      level: sign(type) * PACER_LEVEL_PCT,
    });
  }
  return out;
}

export function timingSdS(halfCycleS: number): number {
  assertPositive("halfCycleS", halfCycleS);
  return FIXED_CONSTANTS.timingSdBreathFraction * 2 * halfCycleS;
}

export function pacedPoints(e: number): number {
  const { maxDeviationPct, points } = OPEN_CONSTANTS.topDeviationBand;
  const { min, max } = FIXED_CONSTANTS.pacedPointRange;
  const raw = points - Math.floor((e * PERCENT) / maxDeviationPct);
  return Math.min(max, Math.max(min, raw));
}

export function histogramBinCount(): number {
  const { minSd, maxSd, stepSd } = FIXED_CONSTANTS.deviationHistogram;
  return Math.round((maxSd - minSd) / stepSd);
}

export function histogramBin(d: number): number {
  const { minSd, stepSd } = FIXED_CONSTANTS.deviationHistogram;
  const last = histogramBinCount() - 1;
  return Math.min(last, Math.max(0, Math.floor((d - minSd) / stepSd)));
}

function scoreOne(
  pacer: PacerTransition,
  users: readonly PacedUserTransition[],
  sdTime: number,
  sdDepth: number,
  k: number,
): PacedTransitionScore {
  const window = FIXED_CONSTANTS.pacedMatchWindowSd * sdTime;
  const matches = users.filter((u) => u.type === pacer.type && Math.abs(u.t - pacer.t) <= window);
  const base = { pacer, type: pacer.type, phase: pacer.phase, matches };
  if (matches.length !== 1) {
    const points = FIXED_CONSTANTS.missedOrDoublePoints;
    return {
      ...base,
      missed: matches.length === 0,
      double: matches.length > 1,
      deltaTimeS: null,
      dTime: null,
      eTime: null,
      timingPoints: points,
      deltaDepthPct: null,
      dDepth: null,
      eDepth: null,
      depthPoints: points,
    };
  }
  const [user] = matches;
  const deltaTimeS = user.t - pacer.t;
  const dTime = deltaTimeS / sdTime;
  const eTime = Math.abs(dTime) / k;
  const deltaDepthPct = sign(pacer.type) * (user.level - pacer.level);
  const dDepth = deltaDepthPct / sdDepth;
  const eDepth = Math.abs(dDepth) / k;
  return {
    ...base,
    missed: false,
    double: false,
    deltaTimeS,
    dTime,
    eTime,
    timingPoints: pacedPoints(eTime),
    deltaDepthPct,
    dDepth,
    eDepth,
    depthPoints: pacedPoints(eDepth),
  };
}

function byPhase(entries: readonly PacedTransitionScore[], pick: (e: PacedTransitionScore) => number): InhaleExhale {
  return {
    inhale: mean(entries.filter((e) => e.phase === "inhale").map(pick)),
    exhale: mean(entries.filter((e) => e.phase === "exhale").map(pick)),
  };
}

function signedMean(entries: readonly PacedTransitionScore[], phase: BreathPhase, pick: (e: PacedTransitionScore) => number | null): number | null {
  const values = entries
    .filter((e) => e.phase === phase)
    .map(pick)
    .filter((d): d is number => d !== null);
  return values.length === 0 ? null : mean(values);
}

function histogram(entries: readonly PacedTransitionScore[], pick: (e: PacedTransitionScore) => number | null): number[] {
  const bins = new Array<number>(histogramBinCount()).fill(0);
  for (const entry of entries) {
    const d = pick(entry);
    if (d !== null) bins[histogramBin(d)]++;
  }
  return bins;
}

function onTarget(entries: readonly PacedTransitionScore[], pick: (e: PacedTransitionScore) => number | null, k: number): number {
  const hits = entries.filter((e) => {
    const d = pick(e);
    return d !== null && Math.abs(d) <= k;
  }).length;
  return (hits / entries.length) * PERCENT;
}

export function scorePaced(userTransitions: readonly PacedUserTransition[], options: PacedOptions): PacedResult {
  const { halfCycleS, durationS, skillLevel } = options;
  const pacer = pacerTransitions(halfCycleS, durationS);
  if (!pacer.some((p) => p.type === "peak") || !pacer.some((p) => p.type === "trough")) {
    throw new RangeError(
      `paced: a ${durationS} s session with ${halfCycleS} s half cycles needs at least one pacer peak and one trough`,
    );
  }
  const k = OPEN_CONSTANTS.skillBandK[skillLevel];
  const sdTime = timingSdS(halfCycleS);
  const sdDepth = FIXED_CONSTANTS.depthSdPctOfMax;
  const transitions = pacer.map((p) => scoreOne(p, userTransitions, sdTime, sdDepth, k));
  const timing = byPhase(transitions, (e) => e.timingPoints);
  const depth = byPhase(transitions, (e) => e.depthPoints);
  const timingDirection = (phase: BreathPhase): TimingDirection | null => {
    const sd = signedMean(transitions, phase, (e) => e.dTime);
    return sd === null ? null : { sd, s: sd * sdTime };
  };
  const depthDirection = (phase: BreathPhase): DepthDirection | null => {
    const sd = signedMean(transitions, phase, (e) => e.dDepth);
    return sd === null ? null : { sd, pctOfMax: sd * sdDepth };
  };
  const missed = transitions.filter((e) => e.missed).length;
  const double = transitions.filter((e) => e.double).length;
  return {
    sdTimeS: sdTime,
    sdDepthPct: sdDepth,
    k,
    transitions,
    scores: { timing, depth, total: combineTransitionScores(timing, depth) },
    onTargetPct: {
      timing: onTarget(transitions, (e) => e.dTime, k),
      depth: onTarget(transitions, (e) => e.dDepth, k),
    },
    direction: {
      timing: { inhale: timingDirection("inhale"), exhale: timingDirection("exhale") },
      depth: { inhale: depthDirection("inhale"), exhale: depthDirection("exhale") },
    },
    histogram: {
      timing: histogram(transitions, (e) => e.dTime),
      depth: histogram(transitions, (e) => e.dDepth),
      missedOrDouble: missed + double,
    },
    counts: { missed, double, pacer: transitions.length },
  };
}
