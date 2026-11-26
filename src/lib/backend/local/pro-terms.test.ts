import { beforeEach, describe, expect, it } from "vitest";
import { CONSENT_VERSIONS, currentConsents } from "@/lib/domain/consent";
import { withProDefaults } from "@/lib/domain/pro-defaults";
import { defaultProProfile } from "@/lib/domain/pro-profile";
import { proConsents } from "@/lib/domain/pro-terms";
import type { ProProfile } from "@/lib/domain/types";
import { BackendError, type Backend } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";
import { DEMO_ATHLETE, DEMO_PASSWORD } from "./seed";

// T-0118: the end of professional onboarding records the professional terms
// (and a clinician's wellness or an educator's 16+ acknowledgement) as consent
// records after sign-up's, and stores the kind's default targets and scope.

const SIGNED_UP = new Date("2026-11-26T12:00:00.000Z");
const FINISHED = new Date("2026-11-26T12:05:00.000Z");
let clock = SIGNED_UP;
let backend: Backend;
let uid: string;

const clinician: ProProfile = withProDefaults({
  ...defaultProProfile("clinician"),
  profession: "physiotherapist",
  country: "Ireland",
  useCases: ["between-visits"],
});
const educator: ProProfile = withProDefaults({ ...defaultProProfile("educator"), profession: "teacher", useCases: ["class-calm"] });

const refused = async (promise: Promise<unknown>, code: string, message: RegExp) => {
  await expect(promise).rejects.toBeInstanceOf(BackendError);
  await expect(promise).rejects.toMatchObject({ code, message: expect.stringMatching(message) });
};

beforeEach(async () => {
  clock = SIGNED_UP;
  backend = createLocalBackend({ store: memoryStore(createSeededDb(SIGNED_UP)), latencyMs: 0, now: () => clock });
  const user = await backend.auth.signUp({
    email: "niamh@example.com",
    password: "long-enough",
    displayName: "Niamh",
    role: "coach",
    consents: currentConsents(),
    birthYear: 1985,
  });
  uid = user.uid;
  clock = FINISHED;
});

const consentsOf = async () => (await backend.data.getProfile(uid))?.consents;

describe("professional terms through updateProfile", () => {
  it("appends a clinician's terms and wellness acknowledgement after sign-up's, with versions and the time", async () => {
    await backend.data.updateProfile(uid, { proKind: "clinician", proProfile: clinician, proConsents: proConsents("clinician") });
    expect(await consentsOf()).toEqual([
      { kind: "terms", version: CONSENT_VERSIONS.terms, acceptedAt: SIGNED_UP.toISOString() },
      { kind: "privacy", version: CONSENT_VERSIONS.privacy, acceptedAt: SIGNED_UP.toISOString() },
      { kind: "breathing-data", version: CONSENT_VERSIONS["breathing-data"], acceptedAt: SIGNED_UP.toISOString() },
      { kind: "professional-terms", version: CONSENT_VERSIONS["professional-terms"], acceptedAt: FINISHED.toISOString() },
      { kind: "wellness-acknowledgement", version: CONSENT_VERSIONS["wellness-acknowledgement"], acceptedAt: FINISHED.toISOString() },
    ]);
  });

  it("refuses a clinician who hasn't given the wellness acknowledgement, and stores nothing", async () => {
    await refused(
      backend.data.updateProfile(uid, { proKind: "clinician", proProfile: clinician, proConsents: currentConsents(["professional-terms"]) }),
      "invalid-input",
      /wellness-acknowledgement is required/,
    );
    const profile = await backend.data.getProfile(uid);
    expect(profile?.consents).toHaveLength(3);
    expect(profile).not.toHaveProperty("proKind");
  });

  it("refuses an educator without the 16+ acknowledgement, and another kind's acknowledgement", async () => {
    await refused(
      backend.data.updateProfile(uid, { proKind: "educator", proProfile: educator, proConsents: currentConsents(["professional-terms"]) }),
      "invalid-input",
      /student-age-acknowledgement is required/,
    );
    await refused(
      backend.data.updateProfile(uid, { proKind: "educator", proProfile: educator, proConsents: proConsents("clinician") }),
      "invalid-input",
      /wellness-acknowledgement is not for an educator/,
    );
  });

  it("refuses an old version, a sign-up kind, and terms without a kind of work", async () => {
    const stale = proConsents("clinician").map((c) => ({ ...c, version: "2020-01-01" }));
    await refused(backend.data.updateProfile(uid, { proKind: "clinician", proProfile: clinician, proConsents: stale }), "invalid-input", /not current/);
    await refused(backend.data.updateProfile(uid, { proKind: "clinician", proProfile: clinician, proConsents: currentConsents() }), "invalid-input", /unknown "terms"/);
    await refused(backend.data.updateProfile(uid, { proConsents: proConsents("coach") }), "invalid-input", /needs proKind/);
    expect(await consentsOf()).toHaveLength(3);
  });

  it("records each kind once when onboarding is finished again", async () => {
    await backend.data.updateProfile(uid, { proKind: "educator", proProfile: educator, proConsents: proConsents("educator") });
    await backend.data.updateProfile(uid, { proKind: "educator", proProfile: educator, proConsents: proConsents("educator") });
    expect((await consentsOf())?.map((c) => c.kind)).toEqual(["terms", "privacy", "breathing-data", "professional-terms", "student-age-acknowledgement"]);
  });

  it("refuses them from an athlete", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    await refused(backend.data.updateProfile(DEMO_ATHLETE.uid, { proConsents: proConsents("coach") }), "permission-denied", /professionals only/);
  });
});

describe("default targets and scope on proProfile", () => {
  it("stores each kind's defaults and reads them back", async () => {
    await backend.data.updateProfile(uid, { proKind: "clinician", proProfile: clinician });
    expect((await backend.data.getProfile(uid))?.proProfile).toMatchObject({ defaultTargets: { sessionsPerWeek: 5 }, scopeRequested: "curves" });
    await backend.data.updateProfile(uid, { proKind: "educator", proProfile: { ...educator, defaultTargets: { sessionsPerWeek: 4 } } });
    expect((await backend.data.getProfile(uid))?.proProfile).toMatchObject({ defaultTargets: { sessionsPerWeek: 4 }, scopeRequested: "scores" });
  });

  it("refuses defaults out of range", async () => {
    await refused(
      backend.data.updateProfile(uid, { proKind: "clinician", proProfile: { ...clinician, defaultTargets: { sessionsPerWeek: 0 } } }),
      "invalid-input",
      /sessionsPerWeek/,
    );
    await refused(
      backend.data.updateProfile(uid, { proKind: "clinician", proProfile: { ...clinician, scopeRequested: "everything" as never } }),
      "invalid-input",
      /scopeRequested/,
    );
  });
});
