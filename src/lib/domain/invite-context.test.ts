import { describe, expect, it } from "vitest";
import {
  firstAssignment,
  goalForKind,
  inviteHeadline,
  invitePractice,
  invitePracticeChoices,
  inviteScope,
  practiceAssignment,
  proTitle,
} from "./invite-context";
import { templatesFor } from "./pro-templates";
import type { Assignment } from "./types";

describe("the goal an invite starts onboarding with (§3.5)", () => {
  it("Coach → Train, Clinician → Calm, Educator → Focus", () => {
    expect(goalForKind("coach")).toBe("train");
    expect(goalForKind("clinician")).toBe("calm");
    expect(goalForKind("educator")).toBe("focus");
  });

  it("no prefill when the professional's kind isn't known", () => {
    expect(goalForKind(null)).toBeNull();
    expect(goalForKind(undefined)).toBeNull();
  });
});

describe("the scope the invite page starts at", () => {
  it("is what the professional asks for", () => {
    expect(inviteScope({ coachKind: "coach", scopeRequested: "scores" })).toBe("scores");
    expect(inviteScope({ coachKind: "educator", scopeRequested: "curves" })).toBe("curves");
  });

  it("falls back to the kind's default when they haven't said (educators ask for scores only)", () => {
    expect(inviteScope({ coachKind: "educator" })).toBe("scores");
    expect(inviteScope({ coachKind: "clinician", scopeRequested: null })).toBe("curves");
    expect(inviteScope({ coachKind: "coach" })).toBe("curves");
  });

  it("is scores and curves for an older account with no kind, as the page was before", () => {
    expect(inviteScope({})).toBe("curves");
  });
});

describe("who's asking, in their own terms", () => {
  it("uses the profession or role when given, else the kind", () => {
    expect(proTitle({ coachKind: "clinician", coachProfession: "physiotherapist" })).toBe("physiotherapist");
    expect(proTitle({ coachKind: "clinician", coachProfession: "respiratory-therapist" })).toBe("respiratory therapist");
    expect(proTitle({ coachKind: "clinician", coachProfession: "other" })).toBe("clinician");
    expect(proTitle({ coachKind: "educator", coachProfession: "counsellor" })).toBe("counsellor");
    expect(proTitle({ coachKind: "educator" })).toBe("teacher");
    expect(proTitle({ coachKind: "coach", coachProfession: null })).toBe("coach");
    expect(proTitle({})).toBe("coach");
  });

  it("says exactly what they'd see", () => {
    expect(inviteHeadline("Lena Vos", { coachKind: "coach" }, "curves")).toBe("Lena Vos (coach) would like to see your scores and breathing curves.");
    expect(inviteHeadline("Ms Okafor", { coachKind: "educator", coachProfession: "teacher" }, "scores")).toBe("Ms Okafor (teacher) would like to see your scores.");
  });
});

describe("practice set with an invite", () => {
  it("offers the kind's sessions and plans, never a group session", () => {
    expect(invitePracticeChoices("educator").map((t) => t.id)).toEqual(["focus-sprint", "exam-week"]);
    expect(invitePracticeChoices("clinician").map((t) => t.id)).toEqual(["daily-slow-breathing", "weekly-open-check", "between-visits"]);
    expect(invitePracticeChoices(null)).toEqual([]);
    expect(invitePractice("educator", "class-calm")).toBeNull();
    expect(invitePractice("clinician", "focus-sprint")).toBeNull();
    expect(invitePractice("clinician", null)).toBeNull();
    expect(invitePractice("clinician", "between-visits")?.name).toBe("Between visits");
  });

  it("a plan becomes its sessions over its days, due at its end", () => {
    const accepted = new Date("2026-11-26T09:00:00.000Z");
    const block = templatesFor("coach").find((t) => t.id === "breath-control-block")!;
    expect(practiceAssignment(block, accepted)).toEqual({
      mode: "paced",
      pacerHalfCycleSec: 5,
      durationSec: 600,
      target: 16,
      dueAt: "2026-12-24T09:00:00.000Z",
      note: "Breath Control Block",
    });
  });

  it("a single session is one, due within a week; open sessions have no pacer", () => {
    const accepted = new Date("2026-11-26T09:00:00.000Z");
    const check = templatesFor("clinician").find((t) => t.id === "weekly-open-check")!;
    expect(practiceAssignment(check, accepted)).toEqual({
      mode: "open",
      pacerHalfCycleSec: null,
      durationSec: 180,
      target: 1,
      dueAt: "2026-12-03T09:00:00.000Z",
      note: "Weekly open check",
    });
  });
});

describe("the practice a newly invited person starts with", () => {
  const now = new Date("2026-11-27T00:00:00.000Z");
  const a = (id: string, over: Partial<Assignment> = {}): Assignment => ({
    id,
    coachId: "c1",
    athleteId: "p1",
    createdAt: "2026-11-26T10:00:00.000Z",
    mode: "paced",
    pacerHalfCycleSec: 5,
    durationSec: 300,
    target: 7,
    dueAt: "2026-12-10T10:00:00.000Z",
    note: "Between visits",
    cancelled: false,
    ...over,
  });

  it("is the first open one this professional set", () => {
    const list = [a("newer", { createdAt: "2026-11-26T11:00:00.000Z" }), a("first"), a("other", { coachId: "c2", createdAt: "2026-11-01T00:00:00.000Z" })];
    expect(firstAssignment(list, "c1", now)?.id).toBe("first");
    expect(firstAssignment(list, null, now)?.id).toBe("other");
  });

  it("skips cancelled and overdue practice, and is null without any", () => {
    expect(firstAssignment([a("x", { cancelled: true }), a("y", { dueAt: "2026-11-26T23:00:00.000Z" })], "c1", now)).toBeNull();
    expect(firstAssignment([], "c1", now)).toBeNull();
  });
});
