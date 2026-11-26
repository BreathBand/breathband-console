import { describe, expect, it } from "vitest";
import {
  asksMood,
  isMoodScore,
  moodChange,
  moodPairs,
  moodSentence,
  moodsProblem,
  moodTrend,
  moodTrendLine,
} from "./mood";
import { defaultPreferences } from "./preferences";
import type { FocusDetails, MoodCheckin, UserPreferences } from "./types";

const focusDetails: FocusDetails = { stressors: [], examDates: [], studyTimes: [], classTimes: [], moodCheckins: true };
const focus = (details?: Partial<FocusDetails>): UserPreferences => ({
  ...defaultPreferences("focus"),
  goalDetails: details ? { focus: { ...focusDetails, ...details } } : undefined,
});

describe("asksMood", () => {
  it("asks a Focus person whose check-in is on", () => {
    expect(asksMood(focus({ moodCheckins: true }))).toBe(true);
  });

  it("skips the check-in when the preference is off", () => {
    expect(asksMood(focus({ moodCheckins: false }))).toBe(false);
  });

  it("skips it for every goal but Focus, even with Focus answers kept", () => {
    expect(asksMood({ ...focus({ moodCheckins: true }), goal: "train" })).toBe(false);
    expect(asksMood(defaultPreferences("calm"))).toBe(false);
    expect(asksMood(null)).toBe(false);
    expect(asksMood(undefined)).toBe(false);
  });

  it("asks a Focus person from before the goal questions, the question's default", () => {
    expect(asksMood(focus())).toBe(true);
  });
});

describe("the change", () => {
  it("is after minus before, only when both exist", () => {
    expect(moodChange(2, 4)).toBe(2);
    expect(moodChange(4, 3)).toBe(-1);
    expect(moodChange(3, 3)).toBe(0);
    expect(moodChange(3, null)).toBeNull();
    expect(moodChange(null, 3)).toBeNull();
  });

  it("is said in words only when both exist", () => {
    expect(moodSentence(2, 4)).toBe("Mood up from low to good.");
    expect(moodSentence(4, 3)).toBe("Mood down from good to okay.");
    expect(moodSentence(5, 5)).toBe("Mood steady at great.");
    expect(moodSentence(2, null)).toBeNull();
    expect(moodSentence(null, null)).toBeNull();
  });
});

describe("moodsProblem", () => {
  it("takes 1 to 5 or null for each phase", () => {
    expect(moodsProblem({ before: 1, after: 5 })).toBeNull();
    expect(moodsProblem({ before: null, after: 3 })).toBeNull();
    expect(moodsProblem({ before: 0, after: 3 })).toMatch(/^before/);
    expect(moodsProblem({ before: 3, after: 2.5 })).toMatch(/^after/);
    expect(moodsProblem({ before: "4", after: null })).toMatch(/^before/);
    expect(isMoodScore(6)).toBe(false);
  });
});

let n = 0;
const checkin = (sessionId: string | null, phase: MoodCheckin["phase"], mood: MoodCheckin["mood"], createdAt: string): MoodCheckin => ({
  id: `m${++n}`,
  athleteId: "a",
  sessionId,
  phase,
  mood,
  createdAt,
});

describe("moodPairs", () => {
  it("pairs before and after per session, newest first, leaving out half pairs and deleted sessions", () => {
    const pairs = moodPairs([
      checkin("s1", "before", 2, "2026-11-20T09:00:00.000Z"),
      checkin("s1", "after", 4, "2026-11-20T09:10:00.000Z"),
      checkin("s2", "before", 3, "2026-11-22T09:00:00.000Z"),
      checkin("s3", "after", 5, "2026-11-23T09:10:00.000Z"),
      checkin("s4", "before", 4, "2026-11-24T09:00:00.000Z"),
      checkin("s4", "after", 3, "2026-11-24T09:10:00.000Z"),
      checkin(null, "before", 1, "2026-11-25T09:00:00.000Z"),
      checkin(null, "after", 5, "2026-11-25T09:10:00.000Z"),
    ]);
    expect(pairs).toEqual([
      { sessionId: "s4", at: "2026-11-24T09:10:00.000Z", before: 4, after: 3, change: -1 },
      { sessionId: "s1", at: "2026-11-20T09:10:00.000Z", before: 2, after: 4, change: 2 },
    ]);
  });

  it("counts the later of two check-ins in one phase", () => {
    const pairs = moodPairs([
      checkin("s1", "before", 2, "2026-11-20T09:00:00.000Z"),
      checkin("s1", "before", 3, "2026-11-20T09:01:00.000Z"),
      checkin("s1", "after", 4, "2026-11-20T09:10:00.000Z"),
    ]);
    expect(pairs[0]).toMatchObject({ before: 3, change: 1 });
  });
});

describe("moodTrend", () => {
  const NOW = new Date("2026-11-26T12:00:00.000Z");

  it("averages the change over the last two weeks and keeps the latest, oldest first", () => {
    const trend = moodTrend(
      [
        checkin("old", "before", 1, "2026-11-01T09:00:00.000Z"),
        checkin("old", "after", 5, "2026-11-01T09:10:00.000Z"),
        checkin("s1", "before", 2, "2026-11-20T09:00:00.000Z"),
        checkin("s1", "after", 4, "2026-11-20T09:10:00.000Z"),
        checkin("s2", "before", 3, "2026-11-25T09:00:00.000Z"),
        checkin("s2", "after", 4, "2026-11-25T09:10:00.000Z"),
        checkin("s3", "before", 4, "2026-11-26T09:00:00.000Z"),
        checkin("s3", "after", 4, "2026-11-26T09:10:00.000Z"),
      ],
      NOW,
    );
    expect(trend).toMatchObject({ days: 14, sessions: 3, averageChange: 1 });
    expect(trend!.recent.map((p) => p.sessionId)).toEqual(["s1", "s2", "s3"]);
    expect(moodTrendLine(trend!)).toBe("Your mood rises 1 point on average after a session.");
  });

  it("is null with no session holding both check-ins in the span", () => {
    expect(moodTrend([checkin("s1", "before", 2, "2026-11-25T09:00:00.000Z")], NOW)).toBeNull();
    expect(moodTrend([], NOW)).toBeNull();
  });

  it("says a dip or a steady mood plainly", () => {
    const base = { days: 14, sessions: 2, recent: [] };
    expect(moodTrendLine({ ...base, averageChange: -0.5 })).toBe("Your mood dips 0.5 points on average after a session.");
    expect(moodTrendLine({ ...base, averageChange: 0 })).toBe("Your mood holds steady from before a session to after.");
    expect(moodTrendLine({ ...base, averageChange: 1.5 })).toBe("Your mood rises 1.5 points on average after a session.");
  });
});
