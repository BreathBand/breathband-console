import { beforeEach, describe, expect, it } from "vitest";
import { onboardingProblem } from "@/lib/domain/onboarding";
import { defaultPreferences } from "@/lib/domain/preferences";
import type { OnboardingChoices } from "@/lib/domain/types";
import { BackendError, type Backend } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";
import { DEMO_ATHLETE, DEMO_PASSWORD } from "./seed";

// T-0109: the band step's route and sample mode land in preferences.onboarding
// through the existing updateProfile: no new backend capability, only a check.

let backend: Backend;

beforeEach(async () => {
  backend = createLocalBackend({ store: memoryStore(createSeededDb(new Date("2026-11-26T12:00:00Z"))), latencyMs: 0 });
  await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
});

describe("onboardingProblem", () => {
  it("accepts every route, sample data only with no band, and its absence", () => {
    expect(onboardingProblem(undefined)).toBeNull();
    for (const bandRoute of ["bluetooth", "app", "none", "simulated"] as const) {
      expect(onboardingProblem({ bandRoute, sampleData: false })).toBeNull();
    }
    expect(onboardingProblem({ bandRoute: "none", sampleData: true })).toBeNull();
  });

  it("refuses unknown routes, non-boolean sample data, and sample data with a band", () => {
    expect(onboardingProblem({ bandRoute: "usb" as never, sampleData: false })).toMatch(/bandRoute/);
    expect(onboardingProblem({ bandRoute: "none", sampleData: "yes" as never })).toMatch(/sampleData/);
    expect(onboardingProblem({ bandRoute: "simulated", sampleData: true })).toMatch(/only with bandRoute "none"/);
    expect(onboardingProblem(null as never)).toMatch(/onboarding/);
  });
});

describe("updateProfile with the band step's choice", () => {
  it("stores the route and sample mode, and reads them back", async () => {
    const onboarding: OnboardingChoices = { bandRoute: "none", sampleData: true };
    const prefs = { ...defaultPreferences("calm"), onboardedAt: "2026-11-26T12:00:00.000Z", onboarding };
    await backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: prefs });
    expect((await backend.data.getProfile(DEMO_ATHLETE.uid))?.preferences?.onboarding).toEqual(onboarding);
  });

  it("refuses a malformed choice and keeps what was there", async () => {
    const ok = { ...defaultPreferences("train"), onboarding: { bandRoute: "app", sampleData: false } as OnboardingChoices };
    await backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: ok });
    const bad = backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: { ...ok, onboarding: { bandRoute: "bluetooth", sampleData: true } } });
    await expect(bad).rejects.toBeInstanceOf(BackendError);
    await expect(bad).rejects.toMatchObject({ code: "invalid-input", message: expect.stringMatching(/onboarding.sampleData/) });
    expect((await backend.data.getProfile(DEMO_ATHLETE.uid))?.preferences?.onboarding).toEqual({ bandRoute: "app", sampleData: false });
  });
});
