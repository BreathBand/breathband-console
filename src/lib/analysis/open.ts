import { FIXED_CONSTANTS, OPEN_CONSTANTS } from "./config";
import { assertSampleRateHz } from "./filter";
import { detectTransitions, type DetectedTransition, type TransitionType } from "./transitions";

export interface OpenTransition {
  readonly t: number;
  readonly type: TransitionType;
  readonly level: number;
}

export interface OpenBreath {
  readonly troughS: number;
  readonly peakS: number;
  readonly nextTroughS: number;
  readonly periodS: number;
  readonly rateBpm: number;
  readonly inhaleS: number;
  readonly exhaleS: number;
  readonly depthPct: number;
  readonly inhaleDepthPct: number;
  readonly exhaleDepthPct: number;
}

export interface OpenMetrics {
  readonly rateBpm: number;
  readonly ieRatio: number;
  readonly inhaleS: number;
  readonly exhaleS: number;
  readonly depthPct: number;
  readonly inhaleDepthPct: number;
  readonly exhaleDepthPct: number;
  readonly depthIndex: number;
  readonly normalRatePct: number;
  readonly normalDepthPct: number;
}

export type OpenSegmentName = "before" | "between" | "after";

export interface OpenSpan {
  readonly fromS: number;
  readonly toS: number;
  readonly breaths: number;
  readonly metrics: OpenMetrics | null;
}

export interface OpenSegment extends OpenSpan {
  readonly name: OpenSegmentName;
}

export interface OpenResult {
  readonly whole: OpenSpan;
  readonly segments: readonly OpenSegment[];
  readonly markersUsed: readonly number[];
  readonly markersIgnored: number;
}

export interface OpenOptions {
  readonly durationS: number;
  readonly markersS?: readonly number[];
}

const PERCENT = 100;
const SECONDS_PER_MINUTE = 60;
const SEGMENT_NAMES: readonly (readonly OpenSegmentName[])[] = [[], ["before", "after"], ["before", "between", "after"]];

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function share(breaths: readonly OpenBreath[], accept: (b: OpenBreath) => boolean): number {
  return (breaths.filter(accept).length / breaths.length) * PERCENT;
}

function insideBand(value: number, min: number, max: number): boolean {
  const eps = FIXED_CONSTANTS.bandEdgeEpsilon;
  return value >= min - eps && value <= max + eps;
}

export function normalDepthRangePct(): { readonly min: number; readonly max: number } {
  const { centrePctOfMax, tolerancePct } = OPEN_CONSTANTS.normalDepthBand;
  const spread = (centrePctOfMax * tolerancePct) / PERCENT;
  return { min: centrePctOfMax - spread, max: centrePctOfMax + spread };
}

/** False for a rate no person breathes at for a whole session: the strap slipped or the signal is noise (D-K). */
export function isPlausibleRate(rateBpm: number): boolean {
  const { min, max } = FIXED_CONSTANTS.plausibleRateBpm;
  return insideBand(rateBpm, min, max);
}

export function isNormalRate(rateBpm: number): boolean {
  const { min, max } = FIXED_CONSTANTS.normalRateBpm;
  return insideBand(rateBpm, min, max);
}

export function isNormalDepth(depthPct: number): boolean {
  const { min, max } = normalDepthRangePct();
  return insideBand(depthPct, min, max);
}

export function depthIndex(avgDepthPct: number): number {
  const reference = FIXED_CONSTANTS.referenceDepthPeakToTroughPctOfMax;
  const cap = FIXED_CONSTANTS.depthIndexCapPct;
  const eps = FIXED_CONSTANTS.bandEdgeEpsilon;
  const raw = ((avgDepthPct - reference) / reference) * PERCENT;
  if (raw >= cap - eps) return cap;
  if (raw <= -cap + eps) return -cap;
  return raw;
}

export function openBreaths(transitions: readonly OpenTransition[]): OpenBreath[] {
  const ordered = [...transitions].sort((a, b) => a.t - b.t);
  const out: OpenBreath[] = [];
  for (let i = 0; i + 2 < ordered.length; i++) {
    const [trough, peak, next] = [ordered[i], ordered[i + 1], ordered[i + 2]];
    if (trough.type !== "trough" || peak.type !== "peak" || next.type !== "trough") continue;
    const periodS = next.t - trough.t;
    out.push({
      troughS: trough.t,
      peakS: peak.t,
      nextTroughS: next.t,
      periodS,
      rateBpm: SECONDS_PER_MINUTE / periodS,
      inhaleS: peak.t - trough.t,
      exhaleS: next.t - peak.t,
      depthPct: peak.level - next.level,
      inhaleDepthPct: peak.level - FIXED_CONSTANTS.depthMidlinePctOfMax,
      exhaleDepthPct: FIXED_CONSTANTS.depthMidlinePctOfMax - next.level,
    });
  }
  return out;
}

export function breathMetrics(breaths: readonly OpenBreath[]): OpenMetrics | null {
  if (breaths.length === 0) return null;
  const inhaleS = mean(breaths.map((b) => b.inhaleS));
  const exhaleS = mean(breaths.map((b) => b.exhaleS));
  const depthPct = mean(breaths.map((b) => b.depthPct));
  return {
    rateBpm: SECONDS_PER_MINUTE / mean(breaths.map((b) => b.periodS)),
    ieRatio: exhaleS / inhaleS,
    inhaleS,
    exhaleS,
    depthPct,
    inhaleDepthPct: mean(breaths.map((b) => b.inhaleDepthPct)),
    exhaleDepthPct: mean(breaths.map((b) => b.exhaleDepthPct)),
    depthIndex: depthIndex(depthPct),
    normalRatePct: share(breaths, (b) => isNormalRate(b.rateBpm)),
    normalDepthPct: share(breaths, (b) => isNormalDepth(b.depthPct)),
  };
}

function span(fromS: number, toS: number, breaths: readonly OpenBreath[]): OpenSpan {
  return { fromS, toS, breaths: breaths.length, metrics: breathMetrics(breaths) };
}

export function openMetrics(transitions: readonly OpenTransition[], options: OpenOptions): OpenResult {
  const { durationS } = options;
  if (!(durationS > 0) || !Number.isFinite(durationS)) {
    throw new RangeError(`open: durationS must be a positive finite number, got ${durationS}`);
  }
  const markers = [...(options.markersS ?? [])].sort((a, b) => a - b);
  const outside = markers.find((m) => !Number.isFinite(m) || m < 0 || m > durationS);
  if (outside !== undefined) {
    throw new RangeError(`open: event marker at ${outside} s lies outside the ${durationS} s session`);
  }
  const markersUsed = markers.slice(0, FIXED_CONSTANTS.maxEventMarkersPerOpenSession);
  const breaths = openBreaths(transitions);
  const bounds = [0, ...markersUsed, durationS];
  const segments: OpenSegment[] = SEGMENT_NAMES[markersUsed.length].map((name, s) => {
    const inside = breaths.filter((b) => markersUsed.filter((m) => m <= b.peakS).length === s);
    return { name, ...span(bounds[s], bounds[s + 1], inside) };
  });
  return {
    whole: span(0, durationS, breaths),
    segments,
    markersUsed,
    markersIgnored: markers.length - markersUsed.length,
  };
}

function isUsable(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= FIXED_CONSTANTS.artifactLimitPctOfMax;
}

export function refineTransitions(
  rawPct: readonly number[],
  sampleRateHz: number,
  detected: readonly DetectedTransition[],
): DetectedTransition[] {
  assertSampleRateHz(sampleRateHz);
  const reach = Math.round(FIXED_CONSTANTS.transitionRefineWindowS * sampleRateHz);
  const refined = detected.map((transition) => {
    const sign = transition.type === "peak" ? 1 : -1;
    const from = Math.max(0, transition.index - reach);
    const to = Math.min(rawPct.length - 1, transition.index + reach);
    let best = -1;
    for (let i = from; i <= to; i++) {
      if (isUsable(rawPct[i]) && (best < 0 || sign * rawPct[i] > sign * rawPct[best])) best = i;
    }
    if (best < 0) return transition;
    return { index: best, t: best / sampleRateHz, type: transition.type, level: rawPct[best] };
  });
  return refined.sort((a, b) => a.index - b.index);
}

export function analyzeOpen(
  pctSamples: readonly number[],
  sampleRateHz: number,
  markerIndices: readonly number[] = [],
): OpenResult {
  const detected = detectTransitions(pctSamples, sampleRateHz);
  const refined = refineTransitions(pctSamples, sampleRateHz, detected);
  return openMetrics(refined, {
    durationS: pctSamples.length / sampleRateHz,
    markersS: markerIndices.map((i) => i / sampleRateHz),
  });
}
