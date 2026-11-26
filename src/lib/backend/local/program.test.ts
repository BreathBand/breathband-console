import { beforeEach, describe, expect, it } from "vitest";
import { defaultPreferences } from "@/lib/domain/preferences";
import { BackendError, type Backend } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";
import { DEMO_ATHLETE, DEMO_PASSWORD } from "./seed";

// A program enrolment (J5) lives inside `preferences.gamification`, beside the
// switches and the milestones shown; Home writes it when someone enrols.

let backend: Backend;

beforeEach(async () => {
  backend = createLocalBackend({ store: memoryStore(createSeededDb(new Date("2026-11-24T12:00:00Z"))), latencyMs: 0 });
  await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
});

const prefs = defaultPreferences("calm");
const program = { id: "foundations" as const, startedAt: "2026-11-24T12:00:00.000Z" };

describe("updateProfile with preferences.gamification.program", () => {
  it("stores the enrolment with the rest of gamification", async () => {
    const gamification = { awarded: { "first-calibration": "2026-11-24T12:00:00.000Z" }, program };
    await backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: { ...prefs, gamification } });
    expect((await backend.data.getProfile(DEMO_ATHLETE.uid))?.preferences?.gamification).toEqual(gamification);
  });

  it("rejects an unknown program or a missing start", async () => {
    for (const bad of [{ id: "exam-week", startedAt: program.startedAt }, { id: "foundations" }]) {
      const attempt = backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: { ...prefs, gamification: { program: bad as never } } });
      await expect(attempt).rejects.toBeInstanceOf(BackendError);
      await expect(attempt).rejects.toMatchObject({ code: "invalid-input" });
    }
  });
});
