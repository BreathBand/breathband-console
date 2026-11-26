import { describe, expect, it } from "vitest";
import { activity } from "./activity";
import { defaultFlags, rulesInForce } from "./default-flags";
import { DEFAULT_ALERTS, type AlertRules, type SessionSummary } from "./types";

describe("default flags per kind", () => {
  it("a coach starts with the full set: 3 missed days, Total down 2 and the rest", () => {
    expect(defaultFlags("coach")).toEqual(DEFAULT_ALERTS);
    expect(defaultFlags("coach")).toMatchObject({ missedDays: 3, scoreDrop: 2 });
  });

  it("a clinician starts with 3 missed days only, no score-drop flag", () => {
    expect(defaultFlags("clinician")).toEqual({
      missedDays: 3,
      scoreDrop: null,
      belowTarget: null,
      trendingDown: false,
      rateOutOfRange: false,
      practiceBehind: false,
    });
  });

  it("an educator starts with every flag off", () => {
    expect(defaultFlags("educator")).toEqual({
      missedDays: null,
      scoreDrop: null,
      belowTarget: null,
      trendingDown: false,
      rateOutOfRange: false,
      practiceBehind: false,
    });
  });

  it("a professional of unknown kind (older coach accounts) keeps the coach's set", () => {
    expect(defaultFlags(undefined)).toEqual(DEFAULT_ALERTS);
    expect(defaultFlags(null)).toEqual(DEFAULT_ALERTS);
  });

  it("hands out a copy, so changing it doesn't change the defaults", () => {
    const rules = defaultFlags("coach");
    rules.missedDays = 9;
    expect(DEFAULT_ALERTS.missedDays).toBe(3);
    expect(defaultFlags("coach").missedDays).toBe(3);
  });
});

describe("rules in force", () => {
  it("nothing saved (the backend's DEFAULT_ALERTS): the kind's defaults apply", () => {
    expect(rulesInForce(DEFAULT_ALERTS, "clinician")).toEqual(defaultFlags("clinician"));
    expect(rulesInForce({ ...DEFAULT_ALERTS }, "educator")).toEqual(defaultFlags("educator"));
    expect(rulesInForce(DEFAULT_ALERTS, "coach")).toEqual(DEFAULT_ALERTS);
  });

  it("saved rules win over the kind's defaults", () => {
    const saved: AlertRules = { ...DEFAULT_ALERTS, missedDays: 5 };
    expect(rulesInForce(saved, "clinician")).toBe(saved);
    expect(rulesInForce(saved, "educator")).toBe(saved);
    const off = defaultFlags("educator");
    expect(rulesInForce(off, "coach")).toBe(off);
  });

  it("a clinician's client gets the missed-days flag but not the score-drop one", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    const at = (daysAgo: number, total: number): SessionSummary => ({
      id: `s${daysAgo}`,
      athleteId: "a",
      startedAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
      durationSec: 300,
      mode: "paced",
      pacerHalfCycleSec: 5,
      scores: { total, timing: { inhale: total, exhale: total }, depth: { inhale: total, exhale: total }, smoothness: null },
      scoringVersion: "transition-v1",
      respirationRateBpm: 6,
      note: "",
      waveformPath: "",
      appVersion: "",
    });
    // Latest well below the five before it, and four days ago.
    const sessions = [at(4, 3), at(5, 8), at(6, 8), at(7, 8), at(8, 8), at(9, 8)];
    const kinds = (rules: AlertRules) => activity(sessions, now, rules).flags.map((f) => f.kind);
    expect(kinds(rulesInForce(DEFAULT_ALERTS, "clinician"))).toEqual(["missed"]);
    expect(kinds(rulesInForce(DEFAULT_ALERTS, "educator"))).toEqual([]);
  });
});
