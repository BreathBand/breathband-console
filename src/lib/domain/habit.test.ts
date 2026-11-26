import { describe, expect, it } from "vitest";
import {
  award,
  dailyMinutesOf,
  DEFAULT_DAILY_MINUTES,
  earnedMilestones,
  gamificationProblem,
  mechanicsOf,
  newMilestones,
  ringOf,
  streakDays,
  streakOf,
} from "./habit";
import { defaultPreferences } from "./preferences";
import type { SessionSummary, TransitionScores } from "./types";

const NOW = new Date("2026-11-24T15:00:00");

/** A session on the given local day ("2026-11-24") at 08:00, `min` minutes long. */
const on = (day: string, min = 5, fields: Partial<SessionSummary> = {}) =>
  ({ startedAt: `${day}T08:00:00`, durationSec: min * 60, mode: "open", scores: null, ...fields }) as SessionSummary;

/** Sessions on each of these days back from NOW (0 is today). */
const daysAgo = (...ago: number[]) =>
  ago.map((n) => {
    const d = new Date(NOW);
    d.setDate(d.getDate() - n);
    return { startedAt: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8).toISOString(), durationSec: 300, mode: "open", scores: null } as SessionSummary;
  });

const scored = (total: number): TransitionScores => ({
  total,
  timing: { inhale: total, exhale: total },
  depth: { inhale: total, exhale: total },
  smoothness: null,
});

describe("dailyMinutesOf", () => {
  it("uses the person's own minutes a day", () => {
    expect(dailyMinutesOf({ ...defaultPreferences("calm"), dailyMinutes: 10 })).toBe(10);
  });

  it("falls back to the goal's default session length when unset", () => {
    expect(dailyMinutesOf(defaultPreferences("train"))).toBe(10);
    expect(dailyMinutesOf(defaultPreferences("focus"))).toBe(3);
    expect(dailyMinutesOf(defaultPreferences("calm"))).toBe(3);
  });

  it("is 5 with no preferences at all", () => {
    expect(dailyMinutesOf(null)).toBe(DEFAULT_DAILY_MINUTES);
    expect(DEFAULT_DAILY_MINUTES).toBe(5);
  });
});

describe("ringOf", () => {
  it("adds up today's sessions against the daily minutes", () => {
    const ring = ringOf([on("2026-11-24", 2), on("2026-11-24", 1), on("2026-11-23", 20)], NOW, 5);
    expect(ring).toEqual({ goalMinutes: 5, minutes: 3, fraction: 0.6, closed: false });
  });

  it("closes at the planned minutes and never overfills", () => {
    expect(ringOf([on("2026-11-24", 5)], NOW, 5)).toMatchObject({ fraction: 1, closed: true });
    expect(ringOf([on("2026-11-24", 12)], NOW, 5)).toMatchObject({ minutes: 12, fraction: 1, closed: true });
  });

  it("doesn't round a nearly-done ring up to closed", () => {
    const ring = ringOf([{ startedAt: "2026-11-24T08:00:00", durationSec: 290 }], NOW, 5);
    expect(ring.minutes).toBe(4);
    expect(ring.closed).toBe(false);
  });

  it("is empty with nothing today", () => {
    expect(ringOf([on("2026-11-23", 10)], NOW, 3)).toEqual({ goalMinutes: 3, minutes: 0, fraction: 0, closed: false });
  });

  it("uses the goal's default when dailyMinutes is unset", () => {
    const ring = ringOf([on("2026-11-24", 3)], NOW, dailyMinutesOf(defaultPreferences("calm")));
    expect(ring).toMatchObject({ goalMinutes: 3, closed: true });
  });
});

describe("streakOf", () => {
  it("is none before the first session", () => {
    expect(streakOf([], NOW)).toMatchObject({ days: 0, state: "none" });
  });

  it("counts consecutive days, today included", () => {
    expect(streakOf(daysAgo(0, 1, 2), NOW)).toMatchObject({ days: 3, state: "active", doneToday: true, restDays: 0 });
  });

  it("still counts through yesterday while there's today left", () => {
    expect(streakOf(daysAgo(1, 2), NOW)).toMatchObject({ days: 2, state: "active", doneToday: false });
  });

  it("holds over one rest day without counting it", () => {
    expect(streakOf(daysAgo(0, 1, 3, 4), NOW)).toMatchObject({ days: 4, state: "active", restDays: 1 });
  });

  it("holds when yesterday was the rest day and today isn't done yet", () => {
    expect(streakOf(daysAgo(2, 3), NOW)).toMatchObject({ days: 2, state: "active", restDays: 1 });
  });

  it("allows one rest day per rolling 7 days: a second inside 7 days pauses it", () => {
    // Rest days 6 and 2 ago are 4 days apart: the second ends the run, which restarts at 1 ago.
    expect(streakOf(daysAgo(0, 1, 3, 4, 5, 7, 8), NOW)).toMatchObject({ days: 2, restDays: 0, best: 5 });
    // Rest days 9 and 2 ago are 7 days apart: both hold.
    expect(streakOf(daysAgo(0, 1, 3, 4, 5, 6, 7, 8, 10), NOW)).toMatchObject({ days: 9, restDays: 2, state: "active" });
  });

  it("pauses after two missed days in a row, and never goes negative or 'lost'", () => {
    expect(streakOf(daysAgo(3, 4, 5), NOW)).toMatchObject({ days: 0, state: "paused", best: 3 });
  });

  it("starts again from the first day back", () => {
    expect(streakOf(daysAgo(0, 4, 5, 6), NOW)).toMatchObject({ days: 1, state: "active", doneToday: true, best: 3 });
  });

  it("ignores sessions after now (the session review asks as of a past session)", () => {
    expect(streakOf(daysAgo(0, 1), new Date(NOW.getTime() - 86_400_000))).toMatchObject({ days: 1, doneToday: true });
  });

  it("streakDays is the run's length", () => {
    expect(streakDays(daysAgo(0, 1, 3), NOW)).toBe(3);
    expect(streakDays(daysAgo(3), NOW)).toBe(0);
  });
});

describe("milestones", () => {
  it("awards nothing before the first session", () => {
    expect(earnedMilestones([], NOW)).toEqual([]);
  });

  it("awards the first calibration with the first session, and the first paced session", () => {
    expect(earnedMilestones([on("2026-11-24")], NOW)).toEqual(["first-calibration"]);
    expect(earnedMilestones([on("2026-11-24", 5, { mode: "paced" })], NOW)).toEqual(["first-calibration", "first-paced"]);
  });

  it("awards 7 and 30 days from the longest streak, even after it paused", () => {
    const week = daysAgo(10, 11, 12, 13, 14, 15, 16);
    expect(earnedMilestones(week, NOW)).toContain("streak-7");
    expect(earnedMilestones(week, NOW)).not.toContain("streak-30");
    const month = daysAgo(...Array.from({ length: 30 }, (_, i) => i));
    expect(earnedMilestones(month, NOW)).toEqual(expect.arrayContaining(["streak-7", "streak-30"]));
  });

  it("awards 100 sessions and the first 9 or above", () => {
    expect(earnedMilestones(Array.from({ length: 100 }, () => on("2026-11-20")), NOW)).toContain("sessions-100");
    expect(earnedMilestones(Array.from({ length: 99 }, () => on("2026-11-20")), NOW)).not.toContain("sessions-100");
    expect(earnedMilestones([on("2026-11-20", 5, { mode: "paced", scores: scored(9) })], NOW)).toContain("first-9");
    expect(earnedMilestones([on("2026-11-20", 5, { mode: "paced", scores: scored(8.9) })], NOW)).not.toContain("first-9");
  });

  it("never awards the first program until programs exist", () => {
    expect(earnedMilestones(Array.from({ length: 100 }, () => on("2026-11-20", 5, { mode: "paced", scores: scored(10) })), NOW)).not.toContain(
      "first-program",
    );
  });

  it("shows each milestone once: awarded ones never come back", () => {
    const earned = earnedMilestones([on("2026-11-24", 5, { mode: "paced" })], NOW);
    expect(newMilestones(earned, undefined)).toEqual(["first-calibration", "first-paced"]);
    const g = award(undefined, newMilestones(earned, undefined), NOW);
    expect(newMilestones(earned, g)).toEqual([]);
    // A later award keeps the first one's date.
    const later = award(g, ["first-paced", "streak-7"], new Date("2026-12-24T08:00:00Z"));
    expect(later.awarded?.["first-paced"]).toBe(g.awarded?.["first-paced"]);
    expect(later.awarded?.["streak-7"]).toBe("2026-12-24T08:00:00.000Z");
  });

  it("keeps the person's switches when awarding", () => {
    expect(award({ ring: false }, ["first-calibration"], NOW)).toMatchObject({ ring: false, awarded: { "first-calibration": NOW.toISOString() } });
  });
});

describe("mechanicsOf", () => {
  it("takes each goal's defaults (02 §5.1)", () => {
    expect(mechanicsOf(defaultPreferences("train"))).toEqual({ ring: true, streak: true, milestones: false });
    expect(mechanicsOf(defaultPreferences("focus"))).toEqual({ ring: true, streak: true, milestones: false });
    expect(mechanicsOf(defaultPreferences("calm"))).toEqual({ ring: true, streak: true, milestones: true });
    expect(mechanicsOf(null)).toEqual({ ring: true, streak: true, milestones: false });
  });

  it("gives a clinician's client milestones only", () => {
    expect(mechanicsOf(defaultPreferences("calm"), true)).toEqual({ ring: false, streak: false, milestones: true });
  });

  it("lets the person's own switches win", () => {
    expect(mechanicsOf({ ...defaultPreferences("calm"), gamification: { streak: false } })).toEqual({ ring: true, streak: false, milestones: true });
    expect(mechanicsOf({ ...defaultPreferences("train"), gamification: { milestones: true } }).milestones).toBe(true);
  });
});

describe("gamificationProblem", () => {
  it("accepts absent, empty and full", () => {
    expect(gamificationProblem(undefined)).toBeNull();
    expect(gamificationProblem({})).toBeNull();
    expect(gamificationProblem({ ring: true, streak: false, milestones: true, awarded: { "streak-7": "2026-11-24T08:00:00.000Z" } })).toBeNull();
  });

  it("rejects odd shapes, unknown switches and unknown milestones", () => {
    expect(gamificationProblem([])).toMatch(/an object/);
    expect(gamificationProblem({ confetti: true })).toMatch(/unknown "confetti"/);
    expect(gamificationProblem({ ring: "yes" })).toMatch(/ring: true or false/);
    expect(gamificationProblem({ awarded: [] })).toMatch(/awarded: an object/);
    expect(gamificationProblem({ awarded: { "streak-365": "2026-11-24T08:00:00.000Z" } })).toMatch(/unknown milestone/);
    expect(gamificationProblem({ awarded: { "streak-7": "yesterday" } })).toMatch(/ISO date/);
  });
});
