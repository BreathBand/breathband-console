import { beforeEach, describe, expect, it } from "vitest";
import { withOnboardingAnswers } from "@/lib/domain/goal-questions";
import { defaultPreferences } from "@/lib/domain/preferences";
import { BackendError, type Backend } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";
import { DEMO_ATHLETE, DEMO_PASSWORD } from "./seed";

// Onboarding's goal questions and plan land in preferences through the
// existing updateProfile: no new backend capability, only new checks.

let backend: Backend;

beforeEach(async () => {
  backend = createLocalBackend({ store: memoryStore(createSeededDb(new Date("2026-11-26T12:00:00Z"))), latencyMs: 0 });
  await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
});

const refused = async (promise: Promise<unknown>, message: RegExp) => {
  await expect(promise).rejects.toBeInstanceOf(BackendError);
  await expect(promise).rejects.toMatchObject({ code: "invalid-input", message: expect.stringMatching(message) });
};

describe("updateProfile with onboarding answers", () => {
  it("stores the goal's answers, daily minutes and reminders, and reads them back", async () => {
    const prefs = withOnboardingAnswers(
      { ...defaultPreferences("focus"), onboardedAt: "2026-11-26T12:00:00.000Z" },
      { stressors: ["exams"], examDates: ["2027-01-12"], studyTimes: ["evening"], classTimes: ["morning"], moodCheckins: true },
      { sessionsPerWeek: 5, dailyMinutes: 5, reminders: { enabled: true, time: "19:00", days: ["mon", "wed"], timeZone: "Europe/London" } },
    );
    await backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: prefs });
    const stored = (await backend.data.getProfile(DEMO_ATHLETE.uid))?.preferences;
    expect(stored).toEqual(prefs);
    expect(stored?.goalDetails?.focus?.examDates).toEqual(["2027-01-12"]);
    expect(stored).toMatchObject({ sessionsPerWeek: 5, dailyMinutes: 5, reminders: { time: "19:00", days: ["mon", "wed"] } });
  });

  it("still stores preferences without the new fields", async () => {
    const prefs = defaultPreferences("calm");
    await backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: prefs });
    expect((await backend.data.getProfile(DEMO_ATHLETE.uid))?.preferences).toEqual(prefs);
  });

  it("refuses malformed answers and keeps what was there", async () => {
    const ok = withOnboardingAnswers(defaultPreferences("calm"), null, null);
    await backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: ok });

    await refused(backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: { ...ok, dailyMinutes: 500 } }), /dailyMinutes/);
    await refused(backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: { ...ok, reminders: { ...ok.reminders!, time: "8am" } } }), /reminders.time/);
    await refused(
      backend.data.updateProfile(DEMO_ATHLETE.uid, { preferences: { ...ok, goalDetails: { calm: { hopes: ["world-peace" as never], bestTime: null } } } }),
      /goalDetails.calm.hopes/,
    );
    expect((await backend.data.getProfile(DEMO_ATHLETE.uid))?.preferences).toEqual(ok);
  });
});
