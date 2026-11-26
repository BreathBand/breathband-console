import { beforeEach, describe, expect, it } from "vitest";
import { CONSENT_VERSIONS, currentConsents, UNDER_AGE_MESSAGE } from "@/lib/domain/consent";
import { BackendError, type Backend, type SignUpInput } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";

const NOW = new Date("2026-11-26T12:00:00.000Z");

let backend: Backend;

beforeEach(() => {
  backend = createLocalBackend({ store: memoryStore(createSeededDb(NOW)), latencyMs: 0, now: () => NOW });
});

const input = (changes: Partial<SignUpInput> = {}): SignUpInput => ({
  email: "sam@example.com",
  password: "long-enough",
  displayName: "Sam",
  role: "athlete",
  consents: currentConsents(),
  birthYear: 1995,
  ...changes,
});

const refusal = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(BackendError);
  return error as BackendError;
};

describe("sign-up consents and age gate", () => {
  it("stores the consents and birth year on the profile", async () => {
    const user = await backend.auth.signUp(input());
    const profile = await backend.data.getProfile(user.uid);
    expect(profile?.birthYear).toBe(1995);
    expect(profile?.consents).toEqual([
      { kind: "terms", version: CONSENT_VERSIONS.terms, acceptedAt: NOW.toISOString() },
      { kind: "privacy", version: CONSENT_VERSIONS.privacy, acceptedAt: NOW.toISOString() },
      { kind: "breathing-data", version: CONSENT_VERSIONS["breathing-data"], acceptedAt: NOW.toISOString() },
    ]);
  });

  it("refuses an under-16 birth year with a clear message and creates no account", async () => {
    const error = await refusal(backend.auth.signUp(input({ birthYear: 2011 })));
    expect(error.code).toBe("under-age");
    expect(error.message).toBe(UNDER_AGE_MESSAGE);
    expect(backend.auth.currentUser()).toBeNull();
    await expect(backend.auth.signIn("sam@example.com", "long-enough")).rejects.toMatchObject({
      code: "invalid-credentials",
    });
  });

  it("accepts someone who turns 16 this year", async () => {
    const user = await backend.auth.signUp(input({ birthYear: 2010 }));
    expect(backend.auth.currentUser()?.uid).toBe(user.uid);
  });

  it("refuses a birth year that can't be real", async () => {
    for (const birthYear of [2027, 1850, 1990.5, Number.NaN]) {
      expect((await refusal(backend.auth.signUp(input({ birthYear })))).code).toBe("invalid-input");
    }
  });

  it("refuses sign-up without every consent, or with an old version", async () => {
    const withoutData = currentConsents(["terms", "privacy"]);
    expect((await refusal(backend.auth.signUp(input({ consents: withoutData })))).message).toMatch(/breathing-data/);
    const stale = currentConsents().map((c) => (c.kind === "terms" ? { ...c, version: "2020-01-01" } : c));
    expect((await refusal(backend.auth.signUp(input({ consents: stale })))).code).toBe("invalid-input");
    expect(backend.auth.currentUser()).toBeNull();
  });

  it("keeps consents and birth year out of profile updates", async () => {
    const user = await backend.auth.signUp(input());
    const sneaky = { displayName: "Sam B", birthYear: 2015, consents: [] } as Parameters<
      Backend["data"]["updateProfile"]
    >[1];
    const profile = await backend.data.updateProfile(user.uid, sneaky);
    expect(profile.birthYear).toBe(1995);
    expect(profile.consents).toHaveLength(3);
  });
});
