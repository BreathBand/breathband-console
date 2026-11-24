import type { BreathPattern, PatternSegment, SynthNoise } from "../synth";

export interface OpenTierBTolerance {
  readonly rateBpm: number;
  readonly ieRatio: number;
  readonly depthPct: number;
  readonly durationS: number;
}

export const OPEN_TIER_B = {
  sampleRateHz: 20,
  durationS: 180,
  noise: { seed: 3, sampleSdPct: 0.05, amplitudeSdPct: 0.25, timingSdS: 0.05 },
  tolerance: { rateBpm: 0.3, ieRatio: 0.3, depthPct: 0.3, durationS: 0.1 },
  normal: { inhaleS: 1.5, exhaleS: 3.0, peakPct: 3, troughPct: -3 },
  segmented: {
    markersS: [54, 90],
    segments: [
      { fromS: 0, pattern: { inhaleS: 1.5, exhaleS: 3.0, peakPct: 3, troughPct: -3 } },
      { fromS: 54, pattern: { inhaleS: 1.0, exhaleS: 2.0, peakPct: 4.5, troughPct: -4.5 } },
      { fromS: 90, pattern: { inhaleS: 1.5, exhaleS: 3.0, peakPct: 3, troughPct: -3 } },
    ],
  },
} as const satisfies {
  readonly sampleRateHz: number;
  readonly durationS: number;
  readonly noise: SynthNoise;
  readonly tolerance: OpenTierBTolerance;
  readonly normal: BreathPattern;
  readonly segmented: { readonly markersS: readonly number[]; readonly segments: readonly PatternSegment[] };
};
