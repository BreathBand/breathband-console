import { describe, expect, it } from "vitest";
import { ageGateProblem, consentsProblem, currentConsents, UNDER_AGE_MESSAGE } from "./consent";

const NOW = new Date("2026-11-26T12:00:00.000Z");

describe("ageGateProblem", () => {
  it("lets in anyone who turns 16 this calendar year or earlier", () => {
    expect(ageGateProblem(2010, NOW)).toBeNull();
    expect(ageGateProblem(1960, NOW)).toBeNull();
  });

  it("stops anyone younger with the spec's message", () => {
    expect(ageGateProblem(2011, NOW)).toEqual({ code: "under-age", message: UNDER_AGE_MESSAGE });
    expect(ageGateProblem(2026, NOW)?.code).toBe("under-age");
  });

  it("calls a future, ancient or fractional year invalid", () => {
    for (const year of [2027, 1900, 2000.5]) expect(ageGateProblem(year, NOW)?.code).toBe("invalid");
  });
});

describe("consentsProblem", () => {
  it("is happy with every kind at its current version", () => {
    expect(consentsProblem(currentConsents())).toBeNull();
  });

  it("names the missing kind", () => {
    expect(consentsProblem(currentConsents(["terms", "breathing-data"]))).toMatch(/privacy/);
  });

  it("treats a null entry as missing, not as a crash", () => {
    const withNull = [null, ...currentConsents(["terms", "breathing-data"])] as unknown as ReturnType<typeof currentConsents>;
    expect(consentsProblem(withNull)).toMatch(/privacy/);
  });
});
