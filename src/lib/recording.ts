import { toPctOfMax, type CalibrationScale } from "@/lib/analysis/calibration";
import type { SkillLevel } from "@/lib/analysis/config";
import type { OpenMetrics, OpenResult } from "@/lib/analysis/open";
import type { PacedResult } from "@/lib/analysis/paced";
import { analyzeOpenRecording, analyzePacedRecording } from "@/lib/analysis/session";
import { PACER_AMPLITUDE_PCT } from "@/lib/analysis/synth";
import type { NewSession } from "@/lib/backend/types";
import { SAMPLE_RATE_HZ } from "@/lib/device/config";
import { SCORING_VERSIONS, type OpenDetails, type OpenSpanMetrics, type PacerHalfCycle, type Waveform } from "@/lib/domain/types";

/** What the recorder hands over when a session stops. */
export interface Recording {
  mode: "paced" | "open";
  /** Null for open sessions. */
  halfCycleS: PacerHalfCycle | null;
  startedAt: Date;
  /** Raw readings at 20 Hz, from the pacer's first inhale (paced) or the start (open). */
  raw: readonly number[];
  /** Sample indices of the event markers (open sessions, at most two are used). */
  markers: readonly number[];
  calibration: CalibrationScale;
  skillLevel: SkillLevel;
  note: string;
  /** The band's build or "simulator", stored as the session's appVersion. */
  recorder: string;
}

export interface BuiltSession {
  session: NewSession;
  waveform: Waveform;
  paced: PacedResult | null;
  open: OpenResult | null;
}

/** Shortest recording worth scoring: two full breaths at the slowest pacer. */
export const MIN_RECORDING_S = 20;

const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places;

/** The pacer as the app draws it: a trough at the start, ±3 % of max, half-cosine between turns. */
export function pacerCurve(halfCycleS: number, samples: number, rateHz = SAMPLE_RATE_HZ): number[] {
  return Array.from({ length: samples }, (_, i) => round(-PACER_AMPLITUDE_PCT * Math.cos((Math.PI * i) / (halfCycleS * rateHz)), 3));
}

function spanMetrics(m: OpenMetrics | null): OpenSpanMetrics | null {
  if (!m) return null;
  return {
    rateBpm: round(m.rateBpm, 1),
    ieRatio: round(m.ieRatio, 2),
    inhaleS: round(m.inhaleS, 2),
    exhaleS: round(m.exhaleS, 2),
    depthPct: round(m.depthPct, 2),
    inhaleDepthPct: round(m.inhaleDepthPct, 2),
    exhaleDepthPct: round(m.exhaleDepthPct, 2),
    depthIndex: round(m.depthIndex, 0),
    normalRatePct: round(m.normalRatePct, 0),
    normalDepthPct: round(m.normalDepthPct, 0),
  };
}

export function openDetails(result: OpenResult): OpenDetails {
  return {
    whole: spanMetrics(result.whole.metrics),
    breaths: result.whole.breaths,
    segments: result.segments.map((s) => ({
      name: s.name,
      fromS: round(s.fromS, 1),
      toS: round(s.toS, 1),
      breaths: s.breaths,
      metrics: spanMetrics(s.metrics),
    })),
  };
}

/**
 * Scores a browser recording with the console's analysis library and shapes
 * it as a session and its signal: method C for paced sessions, the Appendix
 * metrics (with marker segments) for open ones. The stored signal is in % of
 * the calibrated maximum, like the app's review screen.
 */
export function buildSession(recording: Recording): BuiltSession {
  const pct = toPctOfMax(recording.raw, recording.calibration).map((v) => round(v, 3));
  const durationSec = Math.round(pct.length / SAMPLE_RATE_HZ);
  const { a100, midline } = recording.calibration;
  const markers = recording.mode === "open" ? recording.markers.slice(0, 2) : [];
  const waveform: Waveform = {
    sampleIntervalMs: 1000 / SAMPLE_RATE_HZ,
    units: "pct-max",
    user: pct,
    pacer: recording.halfCycleS ? pacerCurve(recording.halfCycleS, pct.length) : null,
    markers: [...markers],
    calibration: { min: midline - a100 / 2, max: midline + a100 / 2, a100, midline },
  };
  const base = {
    startedAt: recording.startedAt.toISOString(),
    durationSec,
    note: recording.note,
    appVersion: recording.recorder,
    skillLevel: recording.skillLevel,
    source: "web" as const,
    scoringVersion: SCORING_VERSIONS.methodC,
  };

  if (recording.mode === "paced" && recording.halfCycleS) {
    const paced = analyzePacedRecording(pct, SAMPLE_RATE_HZ, {
      halfCycleS: recording.halfCycleS,
      skillLevel: recording.skillLevel,
    });
    const { timing, depth } = paced.direction;
    const session: NewSession = {
      ...base,
      mode: "paced",
      pacerHalfCycleSec: recording.halfCycleS,
      scores: { total: paced.scores.total, timing: paced.scores.timing, depth: paced.scores.depth, smoothness: null },
      respirationRateBpm: round(60 / (2 * recording.halfCycleS), 1),
      paced: {
        onTargetPct: { timing: round(paced.onTargetPct.timing, 0), depth: round(paced.onTargetPct.depth, 0) },
        direction: {
          timing: { inhale: timing.inhale ? round(timing.inhale.sd, 2) : null, exhale: timing.exhale ? round(timing.exhale.sd, 2) : null },
          depth: { inhale: depth.inhale ? round(depth.inhale.sd, 2) : null, exhale: depth.exhale ? round(depth.exhale.sd, 2) : null },
        },
        histogram: paced.histogram,
        missed: paced.counts.missed,
        double: paced.counts.double,
        transitions: paced.counts.pacer,
      },
      open: null,
    };
    return { session, waveform, paced, open: null };
  }

  const open = analyzeOpenRecording(pct, SAMPLE_RATE_HZ, markers);
  const details = openDetails(open);
  const session: NewSession = {
    ...base,
    mode: "open",
    pacerHalfCycleSec: null,
    scores: null,
    respirationRateBpm: details.whole && open.whole.breaths >= 3 ? details.whole.rateBpm : null,
    paced: null,
    open: details,
  };
  return { session, waveform, paced: null, open };
}
