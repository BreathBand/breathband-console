export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

export type BreathPhase = "inhale" | "exhale";

export type ScoreComponent = "timingIn" | "timingEx" | "depthIn" | "depthEx";

export interface Range {
  readonly min: number;
  readonly max: number;
}

export const OPEN_CONSTANTS = {
  transitionMinProminencePctOfMax: 1,
  transitionMinSpacingS: 0.5,
  skillBandK: {
    beginner: 1.0,
    intermediate: 0.75,
    advanced: 0.5,
    expert: 0.25,
  } satisfies Record<SkillLevel, number>,
  topDeviationBand: { maxDeviationPct: 10, points: 10 },
  extremumPhase: { peak: "inhale", trough: "exhale" } satisfies Record<"peak" | "trough", BreathPhase>,
  totalBreathScoreWeights: {
    timingIn: 0.25,
    timingEx: 0.25,
    depthIn: 0.25,
    depthEx: 0.25,
  } satisfies Record<ScoreComponent, number>,
  normalInhaleDurationS: { min: 1.25, max: 1.67 } satisfies Range,
  normalExhaleDurationS: { min: 2.5, max: 3.33 } satisfies Range,
  normalDepthBand: { centrePctOfMax: 6, tolerancePct: 25 },
} as const;

export const FIXED_CONSTANTS = {
  referenceDepthPeakToTroughPctOfMax: 6,
  depthSdPctOfMax: 3,
  timingSdBreathFraction: 0.5,
  pacersS: [
    { inhaleS: 2, exhaleS: 2 },
    { inhaleS: 5, exhaleS: 5 },
  ],
  lowPassFilter: { cutoffHz: 1, order: 4, kind: "butterworth", zeroPhase: true },
  artifactLimitPctOfMax: 100,
  normalRateBpm: { min: 12, max: 16 } satisfies Range,
  normalIeRatio: { inhale: 1, exhale: 2 },
  maxEventMarkersPerOpenSession: 2,
  deviationHistogram: { minSd: -1, maxSd: 1, stepSd: 0.25, missedOrDoubleBin: true },
  calibrationPeakCount: 3,
  calibrationTroughCount: 3,
} as const;

export const ANALYSIS_CONFIG = {
  open: OPEN_CONSTANTS,
  fixed: FIXED_CONSTANTS,
} as const;

export type OpenConstantName = keyof typeof OPEN_CONSTANTS;

export type FixedConstantName = keyof typeof FIXED_CONSTANTS;

export function isOpenConstant(name: string): name is OpenConstantName {
  return Object.hasOwn(OPEN_CONSTANTS, name);
}
