import { describe, expect, it } from "vitest";
import type { AuthState } from "@/lib/backend/BackendProvider";
import { defaultProProfile } from "@/lib/domain/pro-profile";
import type { UserProfile } from "@/lib/domain/types";
import { proKindOf, termsOf } from "./useTerms";

const signedIn = (profile: Partial<UserProfile> | null): AuthState => ({
  status: "signed-in",
  user: { uid: "u1", email: "pro@example.com", emailVerified: true },
  profile: profile && { uid: "u1", role: "coach", displayName: "Pro", email: "pro@example.com", createdAt: "2026-11-01T09:00:00.000Z", ...profile },
});

describe("termsOf", () => {
  it("gives each kind's default", () => {
    expect(termsOf(signedIn({ proKind: "coach", proProfile: defaultProProfile("coach") })).many).toBe("athletes");
    expect(termsOf(signedIn({ proKind: "clinician", proProfile: defaultProProfile("clinician") })).Many).toBe("Clients");
    expect(termsOf(signedIn({ proKind: "educator" })).one).toBe("student");
  });

  it("the professional's own choice wins", () => {
    expect(termsOf(signedIn({ proKind: "clinician", proProfile: { ...defaultProProfile("clinician"), terminology: "students" } })).many).toBe("students");
    expect(termsOf(signedIn({ proKind: "educator", proProfile: { ...defaultProProfile("educator"), terminology: "athletes" } })).One).toBe("Athlete");
  });

  it("says athletes for older coach accounts, while loading and when signed out", () => {
    expect(termsOf(signedIn({}))).toMatchObject({ one: "athlete", many: "athletes" });
    expect(termsOf(signedIn(null)).many).toBe("athletes");
    expect(termsOf({ status: "loading" }).many).toBe("athletes");
    expect(termsOf({ status: "signed-out" }).many).toBe("athletes");
  });
});

describe("proKindOf", () => {
  it("reads the professional's kind, from proKind or proProfile", () => {
    expect(proKindOf(signedIn({ proKind: "clinician" }))).toBe("clinician");
    expect(proKindOf(signedIn({ proProfile: defaultProProfile("educator") }))).toBe("educator");
  });

  it("is null for an athlete, an older coach account, or nobody", () => {
    expect(proKindOf(signedIn({ role: "athlete", proKind: "coach" }))).toBeNull();
    expect(proKindOf(signedIn({}))).toBeNull();
    expect(proKindOf({ status: "signed-out" })).toBeNull();
  });
});
