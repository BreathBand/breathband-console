import { describe, expect, it } from "vitest";
import type { Backend } from "@/lib/backend/types";
import { defaultPreferences } from "@/lib/domain/preferences";
import type { UserPreferences } from "@/lib/domain/types";
import { withChanges } from "./account/merge-preferences";
import { changeGamification } from "./home/gamification";
import { changePreferences } from "./profile-writes";

/** A backend holding one person's preferences, each write landing `writeMs` later (a slow round trip). */
function slowBackend(initial: UserPreferences, writeMs: number) {
  let stored = initial;
  const backend = {
    data: {
      getProfile: async () => ({ uid: "me", preferences: structuredClone(stored) }),
      updateProfile: async (_uid: string, { preferences }: { preferences: UserPreferences }) => {
        await new Promise((done) => setTimeout(done, writeMs));
        stored = structuredClone(preferences);
        return { uid: "me", preferences: stored };
      },
    },
  } as unknown as Backend;
  return { backend, stored: () => stored };
}

describe("changePreferences", () => {
  it("keeps both of two overlapping Settings saves", async () => {
    const start = defaultPreferences("calm");
    const db = slowBackend(start, 30);
    // Settings as a person uses it: the goal, then the weekly goal before the first save lands.
    const goal = { ...start, goal: "train" as const };
    const first = changePreferences(db.backend, "me", (s) => (s ? withChanges(s, start, goal) : goal));
    const weekly = { ...goal, sessionsPerWeek: 6 };
    const second = changePreferences(db.backend, "me", (s) => (s ? withChanges(s, goal, weekly) : weekly));
    await Promise.all([first, second]);
    expect(db.stored()).toMatchObject({ goal: "train", sessionsPerWeek: 6 });
  });

  it("doesn't let Home's program and a Settings save overwrite each other", async () => {
    const start = defaultPreferences("calm");
    const db = slowBackend(start, 30);
    const program = { id: "foundations" as const, startedAt: "2026-11-26T08:00:00.000Z" };
    const enrol = changeGamification(db.backend, "me", (g) => ({ ...g, program }));
    const weekly = { ...start, sessionsPerWeek: 6 };
    const save = changePreferences(db.backend, "me", (s) => (s ? withChanges(s, start, weekly) : weekly));
    await Promise.all([enrol, save]);
    expect(db.stored()).toMatchObject({ sessionsPerWeek: 6, gamification: { program } });
  });

  it("carries on after a failed write", async () => {
    const db = slowBackend(defaultPreferences("calm"), 0);
    await expect(changePreferences(db.backend, "me", () => { throw new Error("offline"); })).rejects.toThrow("offline");
    await changePreferences(db.backend, "me", (s) => s && { ...s, sessionsPerWeek: 2 });
    expect(db.stored().sessionsPerWeek).toBe(2);
  });
});
