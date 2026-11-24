import { describe, expect, it } from "vitest";
import { generateSignal, OPEN_NORMAL_PATTERN, PACED_NORMAL_PATTERN, toRaw, withDepth } from "@/lib/analysis/synth";
import { checkSessionContract } from "@/lib/backend/local/validate";
import { SAMPLE_RATE_HZ } from "@/lib/device/config";
import { isTransitionScores } from "@/lib/domain/scores";
import { SCORING_VERSIONS } from "@/lib/domain/types";
import { buildSession, pacerCurve, type Recording } from "./recording";

const SCALE = { a100: 900, midline: 2050 };

function recording(mode: "paced" | "open", user: number[], markers: number[] = []): Recording {
  return {
    mode,
    halfCycleS: mode === "paced" ? 5 : null,
    startedAt: new Date("2026-11-24T10:00:00Z"),
    raw: toRaw(user, SCALE),
    markers,
    calibration: SCALE,
    skillLevel: "intermediate",
    note: "",
    recorder: "simulator",
  };
}

describe("pacerCurve", () => {
  it("starts at the trough and peaks one half cycle later, at ±3 % of max", () => {
    const curve = pacerCurve(5, 201);
    expect(curve[0]).toBeCloseTo(-3);
    expect(curve[100]).toBeCloseTo(3);
    expect(curve[200]).toBeCloseTo(-3);
  });
});

describe("buildSession", () => {
  it("scores a paced recording that follows the pacer as method C 10s", () => {
    const signal = generateSignal(PACED_NORMAL_PATTERN, { durationS: 180, sampleRateHz: SAMPLE_RATE_HZ });
    const built = buildSession(recording("paced", signal.user));
    expect(built.session.scoringVersion).toBe(SCORING_VERSIONS.methodC);
    expect(built.session.mode).toBe("paced");
    expect(built.session.durationSec).toBe(180);
    expect(built.session.respirationRateBpm).toBe(6);
    expect(isTransitionScores(built.session.scores) ? built.session.scores.total : null).toBe(10);
    expect(built.session.paced?.onTargetPct).toEqual({ timing: 100, depth: 100 });
    expect(built.waveform.units).toBe("pct-max");
    expect(built.waveform.pacer).toHaveLength(built.waveform.user.length);
    expect(built.waveform.user[0]).toBeCloseTo(signal.user[0], 2);
    expect(() => checkSessionContract({ ...built.session, id: "x", athleteId: "a", waveformPath: "p" }, built.waveform)).not.toThrow();
  });

  it("marks a shallow paced recording down on depth", () => {
    const signal = generateSignal(withDepth(PACED_NORMAL_PATTERN, 0.5), { durationS: 180, sampleRateHz: SAMPLE_RATE_HZ });
    const scores = buildSession(recording("paced", signal.user)).session.scores;
    expect(isTransitionScores(scores) ? scores.depth.inhale : 10).toBeLessThan(8);
  });

  it("gives an open recording the Appendix metrics, split at its markers", () => {
    const signal = generateSignal(OPEN_NORMAL_PATTERN, { durationS: 120, sampleRateHz: SAMPLE_RATE_HZ });
    const built = buildSession(recording("open", signal.user, [40 * SAMPLE_RATE_HZ, 80 * SAMPLE_RATE_HZ, 100 * SAMPLE_RATE_HZ]));
    expect(built.session.scores).toBeNull();
    expect(built.session.open?.whole?.rateBpm).toBeCloseTo(14, 0);
    expect(built.session.respirationRateBpm).toBeCloseTo(14, 0);
    expect(built.session.open?.segments.map((s) => s.name)).toEqual(["before", "between", "after"]);
    expect(built.waveform.markers).toEqual([800, 1600]);
    expect(built.waveform.pacer).toBeNull();
  });
});
