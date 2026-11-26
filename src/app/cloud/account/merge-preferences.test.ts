import { describe, expect, it } from "vitest";
import { defaultPreferences } from "@/lib/domain/preferences";
import { withChanges } from "./merge-preferences";

const before = defaultPreferences("calm");
const program = { id: "foundations" as const, startedAt: "2026-11-26T08:00:00.000Z" };
const stored = { ...before, gamification: { program, awarded: { "first-paced": "2026-11-26T08:00:00.000Z" } } };

describe("withChanges", () => {
  it("keeps a program and milestones written since Settings loaded", () => {
    const merged = withChanges(stored, before, { ...before, sessionsPerWeek: 6 });
    expect(merged.sessionsPerWeek).toBe(6);
    expect(merged.gamification).toEqual(stored.gamification);
  });

  it("takes every field the change touched, nested session included", () => {
    const after = { ...before, goal: "train" as const, session: { ...before.session, durationSec: 600 } };
    expect(withChanges(stored, before, after)).toEqual({ ...stored, goal: "train", session: after.session });
  });

  it("changes nothing else when nothing changed", () => {
    expect(withChanges(stored, before, before)).toEqual(stored);
  });
});
