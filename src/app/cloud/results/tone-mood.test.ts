import { describe, expect, it } from "vitest";
import type { BreathGoal, TransitionScores } from "@/lib/domain/types";
import { coaching, type ResultsSession } from "./tone";

// Focus's results line names the mood change (J6) only when both check-ins exist.

function paced(total: number, onTarget: number): ResultsSession {
  const scores: TransitionScores = {
    total,
    timing: { inhale: total, exhale: total },
    depth: { inhale: total, exhale: total },
    smoothness: null,
  };
  return {
    mode: "paced",
    durationSec: 180,
    pacerHalfCycleSec: 5,
    scores,
    paced: {
      onTargetPct: { timing: onTarget, depth: onTarget },
      direction: { timing: { inhale: null, exhale: null }, depth: { inhale: null, exhale: null } },
      histogram: { timing: [], depth: [], missedOrDouble: 0 },
      missed: 0,
      double: 0,
      transitions: 36,
    },
    open: null,
  };
}

const GOOD = paced(8.8, 84);
const line = (goal: BreathGoal | null, mood: Parameters<typeof coaching>[0]["mood"], session = GOOD) =>
  coaching({ goal, session, streakDays: 1, mood }).line;

describe("Focus's line and the mood change", () => {
  it("adds the change after the session's own line when both moods exist", () => {
    expect(line("focus", { before: 2, after: 4 })).toBe("Three calm minutes. On target 84% of the time. Mood up from low to good.");
    expect(line("focus", { before: 4, after: 3 })).toBe("Three calm minutes. On target 84% of the time. Mood down from good to okay.");
    expect(line("focus", { before: 3, after: 3 })).toBe("Three calm minutes. On target 84% of the time. Mood steady at okay.");
  });

  it("says nothing about mood when either is missing", () => {
    const plain = line("focus", null);
    expect(plain).toBe("Three calm minutes. On target 84% of the time.");
    expect(line("focus", { before: 2, after: null })).toBe(plain);
    expect(line("focus", { before: null, after: 4 })).toBe(plain);
    expect(line("focus", undefined)).toBe(plain);
  });

  it("keeps the mood out of every other goal's line", () => {
    for (const goal of ["train", "calm", null] as const) {
      expect(line(goal, { before: 1, after: 5 })).toBe(line(goal, null));
      expect(line(goal, { before: 1, after: 5 })).not.toMatch(/mood/i);
    }
  });

  it("still names the change when the session has nothing else to speak from", () => {
    const legacy: ResultsSession = { ...GOOD, scores: { overall: 70, depth: 70, timing: 70 }, paced: null };
    expect(line("focus", null, legacy)).toBeNull();
    expect(line("focus", { before: 2, after: 3 }, legacy)).toBe("Mood up from low to okay.");
  });
});
