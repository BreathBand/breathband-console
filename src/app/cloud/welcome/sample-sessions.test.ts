import { describe, expect, it } from "vitest";
import { isTransitionScores } from "@/lib/domain/scores";
import { sampleSessions } from "./sample-sessions";

const NOW = new Date("2026-11-26T12:00:00");

describe("sampleSessions", () => {
  const samples = sampleSessions(NOW);

  it("gives the sample person two weeks of sessions before now, newest first", () => {
    expect(samples).toHaveLength(6);
    const times = samples.map((s) => Date.parse(s.session.startedAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(Math.max(...times)).toBeLessThan(NOW.getTime());
    expect(NOW.getTime() - Math.min(...times)).toBeLessThan(14 * 24 * 3600 * 1000);
    expect(new Set(samples.map((s) => s.id)).size).toBe(samples.length);
  });

  it("scores paced samples as a real recording would, getting steadier over time", () => {
    const paced = samples.filter((s) => s.session.mode === "paced");
    expect(paced.length).toBeGreaterThanOrEqual(3);
    const totals = paced.map((s) => (isTransitionScores(s.session.scores) ? s.session.scores.total : NaN));
    for (const t of totals) expect(t).toBeGreaterThanOrEqual(1);
    expect(totals[0]).toBeGreaterThan(totals[totals.length - 1]);
  });

  it("gives open samples a breathing rate and every sample a curve to draw", () => {
    for (const s of samples.filter((x) => x.session.mode === "open")) expect(s.session.respirationRateBpm).toBeGreaterThan(8);
    for (const s of samples) expect(s.preview.length).toBe(240);
  });

  it("marks them as samples, never as the person's own recordings", () => {
    for (const s of samples) {
      expect(s.id).toMatch(/^sample-/);
      expect(s.session.appVersion).toBe("sample");
    }
  });

  it("is the same every time for the same day", () => {
    expect(sampleSessions(NOW)).toEqual(samples);
  });
});
