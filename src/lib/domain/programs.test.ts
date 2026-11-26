import { describe, expect, it } from "vitest";
import { parseSetup } from "@/lib/prefs";
import { award, earnedMilestones, gamificationProblem, newMilestones } from "./habit";
import { PROGRAMS, programDayHref, programProgress, progressLine, promotedProgram } from "./programs";
import type { ProgramEnrolment, SessionSummary } from "./types";

const foundations = PROGRAMS.foundations;
/** Enrolled on Monday 2 November 2026, 07:00 local time. */
const ENROLLED: ProgramEnrolment = { id: "foundations", startedAt: new Date(2026, 10, 2, 7).toISOString() };

/** A local date `n` days after enrolment day, at the given hour. */
const day = (n: number, hour = 8) => new Date(2026, 10, 2 + n, hour);
const sessionsOn = (...days: number[]) =>
  days.map((n) => ({ startedAt: day(n).toISOString(), mode: "open", scores: null }) as Pick<SessionSummary, "startedAt" | "mode" | "scores">);

describe("Foundations", () => {
  it("is 14 days, each a session preset", () => {
    expect(foundations.days).toHaveLength(14);
    expect(foundations.days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    for (const d of foundations.days) {
      expect(d.name).not.toBe("");
      expect(d.setup.pacer).toBe(5);
      expect([120, 180, 300, 600]).toContain(d.setup.lengthSec);
    }
  });

  it("opens with natural breathing and brings in the 5-5 pacer on day 3", () => {
    expect(foundations.days[0]).toMatchObject({ name: "Just breathe", setup: { mode: "open", lengthSec: 180 } });
    expect(foundations.days[1].setup.mode).toBe("open");
    expect(foundations.days[2]).toMatchObject({ name: "Meet the pacer", setup: { mode: "paced", pacer: 5, lengthSec: 180, view: "circle", sound: true } });
    expect(foundations.days[12].setup).toMatchObject({ mode: "paced", lengthSec: 600 });
    expect(foundations.days[13].setup).toEqual(foundations.days[0].setup);
  });

  it("day N's address carries its preset, at the person's level, to the instrument", () => {
    const href = programDayHref(foundations, foundations.days[2], "beginner");
    expect(href.startsWith("/cloud/record/live/?")).toBe(true);
    const q = new URL(href, "http://x").searchParams;
    expect(parseSetup(q)).toEqual({ mode: "paced", pacer: 5, lengthSec: 180, view: "circle", sound: true, skill: "beginner" });
    expect(q.get("program")).toBe("foundations");
    expect(q.get("day")).toBe("3");
    expect(parseSetup(new URL(programDayHref(foundations, foundations.days[0], "advanced"), "http://x").searchParams)).toMatchObject({
      mode: "open",
      lengthSec: 180,
      sound: false,
      skill: "advanced",
    });
  });

  it("is promoted to Calm only, since the other goals' programs aren't written yet", () => {
    expect(promotedProgram("calm")).toBe("foundations");
    expect(promotedProgram("train")).toBeNull();
    expect(promotedProgram("focus")).toBeNull();
    expect(promotedProgram(null)).toBeNull();
  });
});

describe("programProgress", () => {
  it("starts on day 1, without counting sessions from before enrolling", () => {
    const before = [{ startedAt: new Date(2026, 10, 2, 6).toISOString() }, { startedAt: new Date(2026, 9, 30, 8).toISOString() }];
    const p = programProgress(ENROLLED, before, day(0, 9));
    expect(p).toMatchObject({ done: 0, doneToday: false, missed: 0, finishedAt: null });
    expect(p.next?.day).toBe(1);
    expect(progressLine(p)).toBe("One day at a time. Miss one and it waits for you.");
  });

  it("does one day per calendar day on consecutive days", () => {
    const p = programProgress(ENROLLED, sessionsOn(0, 1, 2), day(2, 20));
    expect(p).toMatchObject({ done: 3, doneToday: true, missed: 0 });
    expect(p.next?.day).toBe(4);
    expect(progressLine(p)).toBe("Day 3 done. Day 4 opens tomorrow.");
    // The next morning, day 4 is today's.
    const morning = programProgress(ENROLLED, sessionsOn(0, 1, 2), day(3, 7));
    expect(morning).toMatchObject({ done: 3, doneToday: false, missed: 0 });
    expect(progressLine(morning)).toBe("11 days to go.");
  });

  it("counts two sessions on one day as one program day", () => {
    const p = programProgress(ENROLLED, [...sessionsOn(0), { startedAt: day(0, 18).toISOString() }], day(0, 20));
    expect(p.done).toBe(1);
    expect(p.next?.day).toBe(2);
  });

  it("waits through missed days: nothing skipped, nothing reset", () => {
    // Days 1 and 2 done, then three days away, then back.
    const away = programProgress(ENROLLED, sessionsOn(0, 1), day(5, 9));
    expect(away).toMatchObject({ done: 2, missed: 3, doneToday: false });
    expect(away.next?.day).toBe(3);
    expect(progressLine(away)).toBe("Day 3 is waiting for you. A missed day resets nothing: carry on where you left off.");

    const back = programProgress(ENROLLED, sessionsOn(0, 1, 5), day(5, 20));
    expect(back).toMatchObject({ done: 3, missed: 0, doneToday: true });
    expect(back.next?.day).toBe(4);
  });

  it("doesn't count the enrolment day as missed", () => {
    expect(programProgress(ENROLLED, [], day(1, 9)).missed).toBe(0);
    expect(programProgress(ENROLLED, [], day(3, 9)).missed).toBe(2);
  });

  it("finishes on the 14th day done, with when, and stays finished", () => {
    const days = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15];
    const p = programProgress(ENROLLED, sessionsOn(...days), day(15, 20));
    expect(p).toMatchObject({ done: 14, next: null, missed: 0, finishedAt: day(15).toISOString() });
    expect(progressLine(p)).toBe("Finished: all 14 days of Foundations.");
    const later = programProgress(ENROLLED, sessionsOn(...days, 16, 17), day(30, 9));
    expect(later).toMatchObject({ done: 14, missed: 0, finishedAt: day(15).toISOString() });
  });

  it("ignores sessions after now", () => {
    expect(programProgress(ENROLLED, sessionsOn(0, 1), day(0, 20)).done).toBe(1);
  });
});

describe("the first-program milestone", () => {
  const all = sessionsOn(...Array.from({ length: 14 }, (_, i) => i));

  it("isn't earned without an enrolment, or before the last day", () => {
    expect(earnedMilestones(all, day(13, 20))).not.toContain("first-program");
    expect(earnedMilestones(all.slice(0, 13), day(12, 20), { program: ENROLLED })).not.toContain("first-program");
  });

  it("is earned when the 14th day is done, and awarded once", () => {
    const at = day(13, 20);
    const g = { program: ENROLLED };
    expect(earnedMilestones(all, at, g)).toContain("first-program");
    expect(newMilestones(earnedMilestones(all, at, g), g)).toContain("first-program");

    const shown = award(g, newMilestones(earnedMilestones(all, at, g), g), at);
    expect(shown.awarded?.["first-program"]).toBe(at.toISOString());
    expect(shown.program).toEqual(ENROLLED);
    // The next visit: still earned, never shown again, and the first date kept.
    const next = day(14, 9);
    expect(earnedMilestones(all, next, shown)).toContain("first-program");
    expect(newMilestones(earnedMilestones(all, next, shown), shown)).not.toContain("first-program");
    expect(award(shown, ["first-program"], next).awarded?.["first-program"]).toBe(at.toISOString());
  });
});

describe("gamification.program, as stored", () => {
  it("takes an enrolment beside the switches and milestones", () => {
    expect(gamificationProblem({ ring: true, awarded: { "first-paced": "2026-11-24T08:00:00.000Z" }, program: ENROLLED })).toBeNull();
  });

  it("refuses an unknown program, a bad date or anything else inside it", () => {
    expect(gamificationProblem({ program: "foundations" })).toMatch(/program: an object/);
    expect(gamificationProblem({ program: { id: "exam-week", startedAt: ENROLLED.startedAt } })).toMatch(/a known program/);
    expect(gamificationProblem({ program: { id: "foundations" } })).toMatch(/startedAt: an ISO date/);
    expect(gamificationProblem({ program: { id: "foundations", startedAt: "monday" } })).toMatch(/startedAt: an ISO date/);
    expect(gamificationProblem({ program: { ...ENROLLED, completedDays: 3 } })).toMatch(/unknown "completedDays"/);
  });
});
