import { describe, expect, it } from "vitest";
import { analyzeOpenRecording, analyzePacedRecording } from "@/lib/analysis/session";
import { isTransitionScores } from "@/lib/domain/scores";
import { SCORING_VERSIONS, type SessionSummary } from "@/lib/domain/types";
import { openDetails } from "@/lib/recording";
import { createSeededDb } from "./db";
import { DEMO_ATHLETE, generateWaveform } from "./seed";

const NOW = new Date("2026-11-24T12:00:00.000Z");
const db = createSeededDb(NOW);
const all = Object.values(db.sessions).flat();
const alex = db.sessions[DEMO_ATHLETE.uid];
const byId = (id: string) => alex.find((s) => s.id === id)!;
const scoresOf = (s: SessionSummary) => {
  if (!isTransitionScores(s.scores)) throw new Error(`${s.id} has no 1–10 scores`);
  return s.scores;
};
const mean = (v: { inhale: number; exhale: number }) => (v.inhale + v.exhale) / 2;

describe("seeded demo data", () => {
  it("is method C (or the app's legacy 0–100 %), never the retired transition-v1 scoring", () => {
    const versions = new Set(all.map((s) => s.scoringVersion));
    expect(versions.has(SCORING_VERSIONS.transition)).toBe(false);
    expect(versions.has(SCORING_VERSIONS.methodC)).toBe(true);
    expect(alex.some((s) => s.scoringVersion === SCORING_VERSIONS.legacy)).toBe(true);
    for (const s of all.filter((x) => x.scoringVersion === SCORING_VERSIONS.methodC)) {
      expect(s.skillLevel).toBe("intermediate");
      expect(s.source).toBe("app");
      if (s.mode === "paced") expect(s.paced).toBeTruthy();
      else expect(s.open).toBeTruthy();
    }
  });

  it("seeds quickly enough to run in the browser on first load", () => {
    const t = performance.now();
    createSeededDb(NOW);
    expect(performance.now() - t).toBeLessThan(1500);
  });

  it("stores exactly the scores the analysis gives for each regenerated signal", () => {
    for (const s of all.filter((x) => x.scoringVersion === SCORING_VERSIONS.methodC)) {
      const w = generateWaveform(s);
      expect(w.units).toBe("pct-max");
      expect(w.user).toHaveLength(s.durationSec * 20);
      if (s.mode === "paced") {
        const fresh = analyzePacedRecording(w.user, 20, { halfCycleS: s.pacerHalfCycleSec!, skillLevel: "intermediate" });
        expect(scoresOf(s)).toEqual({ ...fresh.scores, smoothness: null });
        expect(s.paced!.missed).toBe(fresh.counts.missed);
      } else {
        expect(s.open).toEqual(openDetails(analyzeOpenRecording(w.user, 20, w.markers)));
      }
    }
  });

  it("opens Alex's history on a good 5-5 session", () => {
    const newest = alex[0];
    expect(newest.mode).toBe("paced");
    expect(newest.pacerHalfCycleSec).toBe(5);
    expect(scoresOf(newest).total).toBeGreaterThanOrEqual(8);
  });

  describe("Alex's fault sessions score worse where the fault is", () => {
    const good = scoresOf(alex[0]);

    it("early: timing", () => {
      expect(mean(scoresOf(byId("f-early")).timing)).toBeLessThan(mean(good.timing) - 2);
    });

    it("shallow and too deep: depth", () => {
      expect(mean(scoresOf(byId("f-shallow")).depth)).toBeLessThan(mean(good.depth) - 2);
      expect(mean(scoresOf(byId("f-deep")).depth)).toBeLessThan(mean(good.depth) - 2);
    });

    it("too fast: timing", () => {
      expect(mean(scoresOf(byId("f-fast")).timing)).toBeLessThan(mean(good.timing) - 2);
    });

    it("lost then recovered: missed turns", () => {
      expect(byId("f-lost").paced!.missed).toBeGreaterThan(0);
    });

    it("each carries a note saying what happened", () => {
      for (const id of ["f-early", "f-shallow", "f-deep", "f-fast", "f-lost"]) expect(byId(id).note).not.toBe("");
    });
  });

  it("gives Alex open sessions split into before, between and after, with faster breathing between the markers", () => {
    for (const id of ["m-001", "m-002"]) {
      const s = byId(id);
      expect(s.open!.segments.map((x) => x.name)).toEqual(["before", "between", "after"]);
      const [before, between] = s.open!.segments;
      expect(between.metrics!.rateBpm).toBeGreaterThan(before.metrics!.rateBpm + 3);
      expect(generateWaveform(s).markers).toHaveLength(2);
    }
  });
});
