import { describe, expect, it } from "vitest";
import { defaultProProfile } from "./pro-profile";
import { countPeople, defaultTerm, nounsFor, peopleNouns } from "./terminology";
import type { ProKind } from "./types";

describe("terminology per kind", () => {
  it.each<[ProKind, string, string]>([
    ["coach", "athlete", "athletes"],
    ["clinician", "client", "clients"],
    ["educator", "student", "students"],
  ])("a %s's people default to %s / %s", (kind, one, many) => {
    expect(defaultTerm(kind)).toBe(many);
    expect(peopleNouns({ proKind: kind })).toEqual({ term: many, one, many, One: one[0].toUpperCase() + one.slice(1), Many: many[0].toUpperCase() + many.slice(1) });
    expect(peopleNouns({ proKind: kind, proProfile: defaultProProfile(kind) }).many).toBe(many);
  });

  it("falls back to athletes for coach accounts made before onboarding asked", () => {
    expect(defaultTerm(undefined)).toBe("athletes");
    expect(peopleNouns({}).many).toBe("athletes");
    expect(peopleNouns(null).Many).toBe("Athletes");
    expect(peopleNouns(undefined).one).toBe("athlete");
  });
});

describe("terminology per override", () => {
  it("the professional's own choice wins over the kind's default", () => {
    expect(peopleNouns({ proKind: "clinician", proProfile: { ...defaultProProfile("clinician"), terminology: "athletes" } }).many).toBe("athletes");
    expect(peopleNouns({ proKind: "coach", proProfile: { ...defaultProProfile("coach"), terminology: "students" } }).One).toBe("Student");
    expect(peopleNouns({ proKind: "educator", proProfile: { ...defaultProProfile("educator"), terminology: "clients" } }).one).toBe("client");
  });

  it("ignores an unknown stored term and uses the kind's default", () => {
    expect(peopleNouns({ proKind: "clinician", proProfile: { ...defaultProProfile("clinician"), terminology: "patients" as never } }).many).toBe("clients");
  });

  it("nounsFor and countPeople give the words for any term", () => {
    expect(nounsFor("clients")).toEqual({ term: "clients", one: "client", many: "clients", One: "Client", Many: "Clients" });
    expect(countPeople(0, nounsFor("students"))).toBe("no students");
    expect(countPeople(1, nounsFor("students"))).toBe("1 student");
    expect(countPeople(12, nounsFor("athletes"))).toBe("12 athletes");
  });
});
