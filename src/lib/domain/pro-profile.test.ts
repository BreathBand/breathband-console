import { describe, expect, it } from "vitest";
import { cleanProProfile, defaultProProfile, practiceProblem, proProblem, proSummary, usesProblem } from "./pro-profile";
import type { ProProfile } from "./types";

const coach: ProProfile = {
  ...defaultProProfile("coach"),
  organisation: "Riverside Rowing Club",
  sports: ["other", "running"],
  sportOther: "Rowing",
  level: "collegiate",
  useCases: ["pre-competition", "team-warm-ups"],
};
const clinician: ProProfile = {
  ...defaultProProfile("clinician"),
  organisation: null,
  profession: "physiotherapist",
  country: "Netherlands",
  useCases: ["between-visits", "injury-recovery"],
};
const educator: ProProfile = { ...defaultProProfile("educator"), organisation: "Northfield College", profession: "counsellor", useCases: ["exam-stress"] };

describe("each kind's answers", () => {
  it("starts from empty answers and the kind's terminology", () => {
    expect(defaultProProfile("coach")).toEqual({
      kind: "coach",
      organisation: null,
      profession: null,
      sports: [],
      level: null,
      country: null,
      useCases: [],
      terminology: "athletes",
    });
    expect(defaultProProfile("clinician").terminology).toBe("clients");
    expect(defaultProProfile("educator").terminology).toBe("students");
  });

  it.each([
    ["coach", coach],
    ["clinician", clinician],
    ["educator", educator],
  ] as const)("a complete %s profile is valid", (kind, p) => {
    expect(practiceProblem(p)).toBeNull();
    expect(usesProblem(p)).toBeNull();
    expect(proProblem(kind, p)).toBeNull();
  });

  it("an empty profile is not ready: the practice and a use case are required", () => {
    expect(practiceProblem(defaultProProfile("coach"))).toMatch(/proProfile.sports: at least 1/);
    expect(practiceProblem(defaultProProfile("clinician"))).toMatch(/proProfile.profession/);
    expect(practiceProblem(defaultProProfile("educator"))).toMatch(/proProfile.profession/);
    expect(practiceProblem({ ...defaultProProfile("coach"), sports: ["team"] })).toMatch(/proProfile.level/);
    expect(practiceProblem({ ...defaultProProfile("clinician"), profession: "nurse" })).toMatch(/proProfile.country: required/);
    expect(usesProblem(defaultProProfile("educator"))).toMatch(/proProfile.useCases: at least 1/);
  });

  it("the terminology can be changed from the kind's default", () => {
    expect(proProblem("clinician", { ...clinician, terminology: "athletes" })).toBeNull();
    expect(proProblem("coach", { ...coach, terminology: "students" })).toBeNull();
  });
});

describe("proSummary", () => {
  it("names each kind's answers in words", () => {
    expect(proSummary(coach)).toEqual([
      ["Your work", "Coach or trainer"],
      ["Practice", "Rowing, Running · Collegiate · Riverside Rowing Club"],
      ["Using it for", "Pre-competition calm, Team warm-ups"],
      ["People are", "Athletes"],
    ]);
    expect(proSummary(clinician)[1]).toEqual(["Practice", "Physiotherapist · Netherlands"]);
    expect(proSummary(educator)[1]).toEqual(["Practice", "Counsellor · Northfield College"]);
  });
});

describe("cleanProProfile", () => {
  it("trims typed fields, turns blanks into null and drops a stray sportOther", () => {
    expect(cleanProProfile({ ...clinician, organisation: "  ", country: "  Ireland " })).toMatchObject({ organisation: null, country: "Ireland" });
    expect(cleanProProfile({ ...coach, sports: ["running"], sportOther: "Rowing" })).not.toHaveProperty("sportOther");
    expect(cleanProProfile({ ...coach, sportOther: "  " })).not.toHaveProperty("sportOther");
    expect(cleanProProfile({ ...coach, organisation: "x".repeat(100) }).organisation).toHaveLength(80);
  });
});

describe("proProblem refuses malformed answers", () => {
  it("accepts both absent, and a kind on its own", () => {
    expect(proProblem(undefined, undefined)).toBeNull();
    expect(proProblem("educator", undefined)).toBeNull();
  });

  it.each([
    ["an unknown kind", "dentist", undefined, /proKind: one of/],
    ["a profile without a kind", undefined, coach, /needs proKind/],
    ["a profile for another kind", "clinician", coach, /proProfile.kind: must match/],
    ["a profile that isn't an object", "coach", "coach", /an object/],
    ["another kind's use case", "coach", { ...coach, useCases: ["exam-stress"] }, /useCases: unknown "exam-stress"/],
    ["a repeated use case", "educator", { ...educator, useCases: ["exam-stress", "exam-stress"] }, /no repeats/],
    ["a term that isn't offered", "clinician", { ...clinician, terminology: "patients" }, /terminology/],
    ["an unknown sport", "coach", { ...coach, sports: ["golf"] }, /sports: unknown "golf"/],
    ["sportOther without other", "coach", { ...coach, sports: ["running"] }, /sportOther: only with/],
    ["a coach with a profession", "coach", { ...coach, profession: "nurse" }, /profession: not for a coach/],
    ["a clinician with sports", "clinician", { ...clinician, sports: ["running"] }, /sports: not for a clinician/],
    ["a clinician's unknown profession", "clinician", { ...clinician, profession: "teacher" }, /profession: one of/],
    ["an educator with a level", "educator", { ...educator, level: "pro" }, /level: not for an educator/],
    ["an educator with a country", "educator", { ...educator, country: "France" }, /country: not for an educator/],
    ["a blank organisation", "educator", { ...educator, organisation: " " }, /organisation/],
    ["an organisation too long", "coach", { ...coach, organisation: "x".repeat(81) }, /organisation: text up to 80/],
  ])("%s", (_, kind, profile, message) => {
    expect(proProblem(kind, profile)).toMatch(message);
  });
});
