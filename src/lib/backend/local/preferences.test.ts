import { beforeEach, describe, expect, it } from "vitest";
import { defaultPreferences, GOALS, preferencesProblem } from "@/lib/domain/preferences";
import { BackendError, type Backend } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";
import { DEMO_ATHLETE, DEMO_COACH, DEMO_PASSWORD } from "./seed";

let backend: Backend;

beforeEach(() => {
  backend = createLocalBackend({ store: memoryStore(createSeededDb(new Date("2026-11-24T12:00:00Z"))), latencyMs: 0 });
});

const expectCode = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(BackendError);
  await expect(promise).rejects.toMatchObject({ code });
};

describe("defaultPreferences", () => {
  it("gives every goal a valid starting point", () => {
    for (const g of GOALS) expect(preferencesProblem(defaultPreferences(g.id))).toBeNull();
  });

  it("starts Calm on open sessions and Train on long paced ones", () => {
    expect(defaultPreferences("calm").session.mode).toBe("open");
    expect(defaultPreferences("train").session).toMatchObject({ mode: "paced", durationSec: 600 });
  });
});

describe("preferencesProblem", () => {
  const ok = defaultPreferences("focus");

  it("rejects unknown goals and skill levels", () => {
    expect(preferencesProblem({ ...ok, goal: "sleep" as never })).toMatch(/goal/);
    expect(preferencesProblem({ ...ok, skillLevel: "pro" as never })).toMatch(/skillLevel/);
  });

  it("rejects a paced session with no length, and odd lengths", () => {
    expect(preferencesProblem({ ...ok, session: { ...ok.session, mode: "paced", durationSec: 0 } })).toMatch(/needs a length/);
    expect(preferencesProblem({ ...ok, session: { ...ok.session, durationSec: 77 } })).toMatch(/durationSec/);
  });

  it("keeps the weekly goal between 1 and 14", () => {
    expect(preferencesProblem({ ...ok, sessionsPerWeek: 0 })).toMatch(/sessionsPerWeek/);
    expect(preferencesProblem({ ...ok, sessionsPerWeek: 15 })).toMatch(/sessionsPerWeek/);
  });
});

describe("updateProfile with preferences", () => {
  it("stores the signed-in user's preferences and returns them", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    const prefs = { ...defaultPreferences("calm", "advanced"), onboardedAt: "2026-11-24T12:00:00.000Z" };
    const profile = await backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: prefs });
    expect(profile.preferences).toEqual(prefs);
    expect(profile.displayName).toBe(DEMO_ATHLETE.displayName);
    expect((await backend.data.getProfile(DEMO_ATHLETE.uid))?.preferences).toEqual(prefs);
  });

  it("refuses invalid preferences and other people's profiles", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    await expectCode(backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: { ...defaultPreferences(), sessionsPerWeek: 99 } }), "invalid-input");
    await expectCode(backend.data.updateProfile(DEMO_COACH.uid, { preferences: defaultPreferences() }), "permission-denied");
  });

  it("starts a new account with no preferences, so it goes through onboarding", async () => {
    const user = await backend.auth.signUp({ email: "new@example.com", password: "long-enough", displayName: "New", role: "athlete" });
    expect((await backend.data.getProfile(user.uid))?.preferences ?? null).toBeNull();
  });
});
