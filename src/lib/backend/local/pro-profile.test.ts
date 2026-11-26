import { beforeEach, describe, expect, it } from "vitest";
import { defaultProProfile } from "@/lib/domain/pro-profile";
import type { ProProfile } from "@/lib/domain/types";
import { BackendError, type Backend } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";
import { DEMO_ATHLETE, DEMO_COACH, DEMO_PASSWORD } from "./seed";

// T-0112: professional onboarding stores `proKind` and `proProfile` through
// updateProfile. Professionals only; the profile's kind matches proKind.

let backend: Backend;

beforeEach(() => {
  backend = createLocalBackend({ store: memoryStore(createSeededDb(new Date("2026-11-26T12:00:00Z"))), latencyMs: 0 });
});

const clinician: ProProfile = {
  ...defaultProProfile("clinician"),
  organisation: "Harbour Physio",
  profession: "physiotherapist",
  country: "Ireland",
  useCases: ["between-visits", "stress-anxiety"],
};
const coach: ProProfile = { ...defaultProProfile("coach"), sports: ["team"], level: "amateur", useCases: ["team-warm-ups"], terminology: "students" };

const refused = async (promise: Promise<unknown>, code: string, message: RegExp) => {
  await expect(promise).rejects.toBeInstanceOf(BackendError);
  await expect(promise).rejects.toMatchObject({ code, message: expect.stringMatching(message) });
};

describe("updateProfile with professional answers", () => {
  beforeEach(async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
  });

  it("stores proKind and proProfile, and reads them back", async () => {
    const returned = await backend.data.updateProfile(DEMO_COACH.uid, { proKind: "clinician", proProfile: clinician });
    expect(returned).toMatchObject({ proKind: "clinician", proProfile: clinician });
    const stored = await backend.data.getProfile(DEMO_COACH.uid);
    expect(stored?.proKind).toBe("clinician");
    expect(stored?.proProfile).toEqual(clinician);
    expect(stored?.role).toBe("coach");
  });

  it("stores an overridden terminology, and a later change of kind with its own profile", async () => {
    await backend.data.updateProfile(DEMO_COACH.uid, { proKind: "clinician", proProfile: clinician });
    await backend.data.updateProfile(DEMO_COACH.uid, { proKind: "coach", proProfile: coach });
    expect(await backend.data.getProfile(DEMO_COACH.uid)).toMatchObject({ proKind: "coach", proProfile: { kind: "coach", terminology: "students" } });
  });

  it("older coach accounts without the fields still read and save as before", async () => {
    const before = await backend.data.getProfile(DEMO_COACH.uid);
    expect(before?.proKind).toBeUndefined();
    expect(before?.proProfile).toBeUndefined();
    await backend.data.updateProfile(DEMO_COACH.uid, { displayName: "Lena V." });
    expect(await backend.data.getProfile(DEMO_COACH.uid)).not.toHaveProperty("proKind");
  });

  it("refuses malformed answers and keeps what was there", async () => {
    await backend.data.updateProfile(DEMO_COACH.uid, { proKind: "clinician", proProfile: clinician });

    await refused(backend.data.updateProfile(DEMO_COACH.uid, { proKind: "dentist" as never }), "invalid-input", /proKind/);
    // Changing the kind alone leaves the stored clinician profile mismatched.
    await refused(backend.data.updateProfile(DEMO_COACH.uid, { proKind: "educator" }), "invalid-input", /proProfile.kind: must match/);
    await refused(backend.data.updateProfile(DEMO_COACH.uid, { proProfile: coach }), "invalid-input", /proProfile.kind: must match/);
    await refused(backend.data.updateProfile(DEMO_COACH.uid, { proProfile: { ...clinician, useCases: [] } }), "invalid-input", /useCases: at least 1/);
    await refused(backend.data.updateProfile(DEMO_COACH.uid, { proProfile: { ...clinician, terminology: "patients" as never } }), "invalid-input", /terminology/);
    await refused(backend.data.updateProfile(DEMO_COACH.uid, { proProfile: { ...clinician, country: null } }), "invalid-input", /country: required/);

    const stored = await backend.data.getProfile(DEMO_COACH.uid);
    expect(stored).toMatchObject({ proKind: "clinician", proProfile: clinician });
  });

  it("a profile for a new account needs its kind", async () => {
    await refused(backend.data.updateProfile(DEMO_COACH.uid, { proProfile: coach }), "invalid-input", /needs proKind/);
  });
});

describe("professional fields are for professionals only", () => {
  it("refuses them from an athlete, and stores nothing", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    await refused(backend.data.updateProfile(DEMO_ATHLETE.uid, { proKind: "coach" }), "permission-denied", /professionals only/);
    await refused(backend.data.updateProfile(DEMO_ATHLETE.uid, { proKind: "coach", proProfile: coach }), "permission-denied", /professionals only/);
    expect(await backend.data.getProfile(DEMO_ATHLETE.uid)).not.toHaveProperty("proKind");
  });

  it("refuses them on someone else's profile", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    await expect(backend.data.updateProfile(DEMO_COACH.uid, { proKind: "coach" })).rejects.toMatchObject({ code: "permission-denied" });
  });
});
