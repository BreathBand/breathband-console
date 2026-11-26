import { beforeEach, describe, expect, it } from "vitest";
import { defaultPreferences } from "@/lib/domain/preferences";
import { BackendError, type Backend } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";
import { DEMO_ATHLETE, DEMO_PASSWORD } from "./seed";

// `preferences.gamification` (planning/v1/02 §7): the habit switches and the
// milestones already shown. Home writes the milestones; Settings (J7) the switches.

let backend: Backend;

beforeEach(async () => {
  backend = createLocalBackend({ store: memoryStore(createSeededDb(new Date("2026-11-24T12:00:00Z"))), latencyMs: 0 });
  await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
});

const prefs = defaultPreferences("calm");

describe("updateProfile with preferences.gamification", () => {
  it("stores the switches and the milestones shown", async () => {
    const gamification = { ring: true, streak: false, awarded: { "first-calibration": "2026-11-24T12:00:00.000Z" } };
    const profile = await backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: { ...prefs, gamification } });
    expect(profile.preferences?.gamification).toEqual(gamification);
    expect((await backend.data.getProfile(DEMO_ATHLETE.uid))?.preferences?.gamification).toEqual(gamification);
  });

  it("still takes preferences without it (older profiles)", async () => {
    const profile = await backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: prefs });
    expect(profile.preferences?.gamification).toBeUndefined();
  });

  it("rejects an unknown milestone or a switch that isn't true or false", async () => {
    for (const gamification of [{ awarded: { "streak-365": "2026-11-24T12:00:00.000Z" } }, { ring: "on" }, { confetti: true }]) {
      const attempt = backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: { ...prefs, gamification: gamification as never } });
      await expect(attempt).rejects.toBeInstanceOf(BackendError);
      await expect(attempt).rejects.toMatchObject({ code: "invalid-input" });
    }
  });
});
