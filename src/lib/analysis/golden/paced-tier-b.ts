import type { SkillLevel } from "../config";
import type { SynthNoise } from "../synth";

export interface TierBRange {
  readonly min: number;
  readonly max: number;
}

export interface TierBExpected {
  readonly total?: TierBRange;
  readonly timing?: TierBRange;
  readonly depth?: TierBRange;
  readonly depthInhale?: TierBRange;
  readonly depthExhale?: TierBRange;
  readonly depthDirectionInhaleSd?: TierBRange;
  readonly depthDirectionExhaleSd?: TierBRange;
  readonly minDouble?: number;
}

export const PACED_TIER_B = {
  sampleRateHz: 20,
  halfCycleS: 5,
  durationS: 180,
  skillLevel: "beginner",
  noise: { seed: 3, sampleSdPct: 0.05, amplitudeSdPct: 0.25, timingSdS: 0.5 },
  expected: {
    onTime: { total: { min: 9.6, max: 10.0 } },
    early: { timing: { min: 6.7, max: 7.3 }, depth: { min: 9.4, max: 10.0 } },
    halfDepth: { depth: { min: 5.2, max: 6.1 } },
    deep: { depth: { min: 2.1, max: 2.7 } },
    offset: {
      depthInhale: { min: 5.3, max: 5.9 },
      depthExhale: { min: 4.9, max: 5.5 },
      depthDirectionInhaleSd: { min: 0.4, max: 0.6 },
      depthDirectionExhaleSd: { min: -0.6, max: -0.4 },
    },
    shortCycle: { timing: { min: 5.4, max: 6.0 }, minDouble: 1 },
  },
} as const satisfies {
  readonly sampleRateHz: number;
  readonly halfCycleS: number;
  readonly durationS: number;
  readonly skillLevel: SkillLevel;
  readonly noise: SynthNoise;
  readonly expected: Record<string, TierBExpected>;
};
