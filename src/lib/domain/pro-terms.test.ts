import { describe, expect, it } from "vitest";
import { CONSENT_KINDS, CONSENT_VERSIONS, consentsProblem, currentConsents, PRO_CONSENT_KINDS } from "./consent";
import {
  hasProTerms,
  PRIVATE_NOTES_HINT,
  proConsents,
  proTermsBoxes,
  proTermsProblem,
  requiredProConsents,
  STUDENT_AGE_ACKNOWLEDGEMENT,
  WELLNESS_ACKNOWLEDGEMENT,
} from "./pro-terms";

describe("what each kind agrees to", () => {
  it("every professional agrees to the terms; a clinician also to the wellness acknowledgement, an educator to the 16+ one", () => {
    expect(requiredProConsents("coach")).toEqual(["professional-terms"]);
    expect(requiredProConsents("clinician")).toEqual(["professional-terms", "wellness-acknowledgement"]);
    expect(requiredProConsents("educator")).toEqual(["professional-terms", "student-age-acknowledgement"]);
  });

  it("uses the spec's wording for the acknowledgements and the private-notes hint", () => {
    expect(WELLNESS_ACKNOWLEDGEMENT).toBe(
      "Breathband is a wellness tool. It doesn't diagnose, treat or monitor any condition. Don't record diagnoses, medical history or treatment in BreathCloud.",
    );
    expect(STUDENT_AGE_ACKNOWLEDGEMENT).toBe("Only invite students aged 16 or over.");
    expect(PRIVATE_NOTES_HINT).toBe("For practice notes only. Don't record diagnoses or medical history here.");
    expect(proTermsBoxes("clinician").map((b) => b.label)).toEqual(["I agree to the professional terms.", WELLNESS_ACKNOWLEDGEMENT]);
  });

  it("sends each required kind at its current version", () => {
    expect(proConsents("clinician")).toEqual([
      { kind: "professional-terms", version: CONSENT_VERSIONS["professional-terms"] },
      { kind: "wellness-acknowledgement", version: CONSENT_VERSIONS["wellness-acknowledgement"] },
    ]);
    for (const kind of ["coach", "clinician", "educator"] as const) expect(proTermsProblem(kind, proConsents(kind))).toBeNull();
  });
});

describe("proTermsProblem", () => {
  it("a clinician can't finish without the wellness acknowledgement", () => {
    expect(proTermsProblem("clinician", currentConsents(["professional-terms"]))).toMatch(/wellness-acknowledgement is required/);
    expect(proTermsProblem("clinician", currentConsents(["wellness-acknowledgement"]))).toMatch(/professional-terms is required/);
    expect(proTermsProblem("clinician", [])).toMatch(/required/);
  });

  it.each([
    ["an educator without the 16+ acknowledgement", "educator", currentConsents(["professional-terms"]), /student-age-acknowledgement is required/],
    ["another kind's acknowledgement", "coach", proConsents("clinician"), /wellness-acknowledgement is not for a coach/],
    ["a sign-up kind", "coach", currentConsents(["terms", "professional-terms"]), /unknown "terms"/],
    ["an old version", "coach", [{ kind: "professional-terms", version: "2020-01-01" }], /not current/],
    ["a repeat", "coach", [...proConsents("coach"), ...proConsents("coach")], /twice/],
  ] as const)("refuses %s", (_, kind, given, message) => {
    expect(proTermsProblem(kind, given)).toMatch(message);
  });
});

describe("hasProTerms", () => {
  it("is true once every required kind is held at its current version", () => {
    const held = [...currentConsents(), ...proConsents("clinician")];
    expect(hasProTerms("clinician", held)).toBe(true);
    expect(hasProTerms("educator", held)).toBe(false);
    expect(hasProTerms("coach", undefined)).toBe(false);
    expect(hasProTerms("coach", [{ kind: "professional-terms", version: "old" }])).toBe(false);
  });
});

describe("professional consent kinds in lib/domain/consent", () => {
  it("each has a draft version, and sign-up neither needs nor sends them", () => {
    for (const kind of PRO_CONSENT_KINDS) expect(CONSENT_VERSIONS[kind]).toMatch(/^draft-/);
    expect(CONSENT_KINDS).toEqual(["terms", "privacy", "breathing-data"]);
    expect(currentConsents().map((c) => c.kind)).toEqual(CONSENT_KINDS);
    expect(consentsProblem(currentConsents())).toBeNull();
  });
});
