import { FIXED_CONSTANTS, OPEN_CONSTANTS } from "./config";
import { assertSampleRateHz, filtfilt } from "./filter";

export type TransitionType = "peak" | "trough";

export interface DetectedTransition {
  readonly index: number;
  readonly t: number;
  readonly type: TransitionType;
  readonly level: number;
}

export interface ExtremaOptions {
  readonly minProminence?: number;
  readonly minSpacingS?: number;
}

interface Candidate {
  readonly index: number;
  readonly type: TransitionType;
}

function direction(type: TransitionType): number {
  return type === "peak" ? 1 : -1;
}

function extremeness(transition: DetectedTransition): number {
  return direction(transition.type) * transition.level;
}

function isArtifact(value: number): boolean {
  return !Number.isFinite(value) || Math.abs(value) > FIXED_CONSTANTS.artifactLimitPctOfMax;
}

function interpolateArtifacts(samples: readonly number[]): number[] {
  const n = samples.length;
  const out = new Array<number>(n);
  let previous = -1;
  for (let i = 0; i <= n; i++) {
    if (i < n && isArtifact(samples[i])) continue;
    if (previous < 0 && i === n) return [];
    for (let j = previous + 1; j < i; j++) {
      if (previous < 0) out[j] = samples[i];
      else if (i === n) out[j] = samples[previous];
      else out[j] = samples[previous] + ((samples[i] - samples[previous]) * (j - previous)) / (i - previous);
    }
    if (i < n) out[i] = samples[i];
    previous = i;
  }
  return out;
}

function candidates(x: readonly number[]): Candidate[] {
  const out: Candidate[] = [];
  let i = 1;
  while (i < x.length - 1) {
    let j = i;
    while (j + 1 < x.length - 1 && x[j + 1] === x[i]) j++;
    const before = x[i - 1];
    const after = x[j + 1];
    const index = Math.floor((i + j) / 2);
    if (x[i] > before && x[i] > after) out.push({ index, type: "peak" });
    else if (x[i] < before && x[i] < after) out.push({ index, type: "trough" });
    i = j + 1;
  }
  return out;
}

function prominence(x: readonly number[], candidate: Candidate): number {
  const sign = direction(candidate.type);
  const top = sign * x[candidate.index];
  let leftBase = top;
  for (let i = candidate.index - 1; i >= 0 && sign * x[i] <= top; i--) leftBase = Math.min(leftBase, sign * x[i]);
  let rightBase = top;
  for (let i = candidate.index + 1; i < x.length && sign * x[i] <= top; i++) {
    rightBase = Math.min(rightBase, sign * x[i]);
  }
  return top - Math.max(leftBase, rightBase);
}

function enforceSpacing(found: readonly DetectedTransition[], minSpacingSamples: number): DetectedTransition[] {
  const kept: DetectedTransition[] = [];
  for (const transition of [...found].sort((a, b) => extremeness(b) - extremeness(a))) {
    const crowded = kept.some(
      (other) => other.type === transition.type && Math.abs(other.index - transition.index) < minSpacingSamples,
    );
    if (!crowded) kept.push(transition);
  }
  return kept.sort((a, b) => a.index - b.index);
}

function alternate(found: readonly DetectedTransition[]): DetectedTransition[] {
  const out: DetectedTransition[] = [];
  for (const transition of found) {
    const last = out[out.length - 1];
    if (last === undefined || last.type !== transition.type) out.push(transition);
    else if (extremeness(transition) > extremeness(last)) out[out.length - 1] = transition;
  }
  return out;
}

function extract(
  filtered: readonly number[],
  sampleRateHz: number,
  options: ExtremaOptions,
  accept: (level: number) => boolean,
): DetectedTransition[] {
  assertSampleRateHz(sampleRateHz);
  const minProminence = options.minProminence ?? OPEN_CONSTANTS.transitionMinProminencePctOfMax;
  const minSpacingS = options.minSpacingS ?? OPEN_CONSTANTS.transitionMinSpacingS;
  const found = candidates(filtered)
    .filter((c) => accept(filtered[c.index]) && prominence(filtered, c) >= minProminence)
    .map((c) => ({ index: c.index, t: c.index / sampleRateHz, type: c.type, level: filtered[c.index] }));
  return alternate(enforceSpacing(found, minSpacingS * sampleRateHz));
}

export function findExtrema(
  filtered: readonly number[],
  sampleRateHz: number,
  options: ExtremaOptions = {},
): DetectedTransition[] {
  return extract(filtered, sampleRateHz, options, () => true);
}

export function detectTransitions(
  pctSamples: readonly number[],
  sampleRateHz: number,
  options: ExtremaOptions = {},
): DetectedTransition[] {
  const filtered = filtfilt(interpolateArtifacts(pctSamples), sampleRateHz);
  return extract(filtered, sampleRateHz, options, (level) => !isArtifact(level));
}
