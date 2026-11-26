import { describe, expect, it } from "vitest";
import { proDefaults, proDefaultsProblem, scopeText, targetsText, withProDefaults } from "./pro-defaults";
import { defaultProProfile, proProblem } from "./pro-profile";

describe("each kind's defaults (planning/v1/02 §4.1 step 7, §5.2)", () => {
  it("coach: Total 7, rate 12–16, 4 a week; asks for scores and curves", () => {
    expect(proDefaults("coach")).toEqual({ defaultTargets: { score: 7, rateLow: 12, rateHigh: 16, sessionsPerWeek: 4 }, scopeRequested: "curves" });
  });

  it("clinician: 5 a week and no score target at first; asks for scores and curves", () => {
    expect(proDefaults("clinician")).toEqual({ defaultTargets: { sessionsPerWeek: 5 }, scopeRequested: "curves" });
  });

  it("educator: 3 a week; asks for scores only", () => {
    expect(proDefaults("educator")).toEqual({ defaultTargets: { sessionsPerWeek: 3 }, scopeRequested: "scores" });
  });

  it("hands out copies, so changing one doesn't change the next", () => {
    proDefaults("coach").defaultTargets.sessionsPerWeek = 1;
    expect(proDefaults("coach").defaultTargets.sessionsPerWeek).toBe(4);
  });
});

describe("withProDefaults", () => {
  it("fills in the kind's defaults on a profile without them, and keeps chosen ones", () => {
    expect(withProDefaults(defaultProProfile("educator"))).toMatchObject({ defaultTargets: { sessionsPerWeek: 3 }, scopeRequested: "scores" });
    const chosen = withProDefaults({ ...defaultProProfile("coach"), defaultTargets: { sessionsPerWeek: 6 }, scopeRequested: "scores" });
    expect(chosen).toMatchObject({ defaultTargets: { sessionsPerWeek: 6 }, scopeRequested: "scores" });
  });
});

describe("in words", () => {
  it("names the targets and the scope", () => {
    expect(targetsText(proDefaults("coach").defaultTargets)).toBe("Total 7 · 12–16 breaths a minute · 4 sessions a week");
    expect(targetsText(proDefaults("clinician").defaultTargets)).toBe("5 sessions a week");
    expect(targetsText({ sessionsPerWeek: 1 })).toBe("1 session a week");
    expect(scopeText("curves")).toBe("Scores and curves");
    expect(scopeText("scores")).toBe("Scores only");
  });
});

describe("proDefaultsProblem", () => {
  it("accepts each kind's defaults, and none at all (profiles from before T-0118)", () => {
    for (const kind of ["coach", "clinician", "educator"] as const) expect(proDefaultsProblem(proDefaults(kind))).toBeNull();
    expect(proDefaultsProblem({})).toBeNull();
  });

  it.each([
    ["no sessions a week", { defaultTargets: { score: 7 } }, /sessionsPerWeek/],
    ["a fractional week", { defaultTargets: { sessionsPerWeek: 2.5 } }, /sessionsPerWeek/],
    ["too many sessions", { defaultTargets: { sessionsPerWeek: 22 } }, /sessionsPerWeek/],
    ["a score over 10", { defaultTargets: { sessionsPerWeek: 3, score: 11 } }, /score: 1–10/],
    ["half a rate range", { defaultTargets: { sessionsPerWeek: 3, rateLow: 12 } }, /together/],
    ["a backwards rate range", { defaultTargets: { sessionsPerWeek: 3, rateLow: 16, rateHigh: 12 } }, /low under high/],
    ["an unknown target", { defaultTargets: { sessionsPerWeek: 3, flags: 1 } }, /unknown "flags"/],
    ["targets that aren't an object", { defaultTargets: 4 }, /an object/],
    ["an unknown scope", { scopeRequested: "everything" }, /scopeRequested/],
  ])("refuses %s", (_, p, message) => {
    expect(proDefaultsProblem(p as never)).toMatch(message);
  });

  it("is part of proProblem", () => {
    const p = { ...withProDefaults(defaultProProfile("educator")), profession: "teacher" as const, useCases: ["class-calm" as const] };
    expect(proProblem("educator", p)).toBeNull();
    expect(proProblem("educator", { ...p, scopeRequested: "all" as never })).toMatch(/scopeRequested/);
  });
});
