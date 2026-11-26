import { describe, expect, it } from "vitest";
import { generatePiecewise, OPEN_NORMAL_PATTERN, withCycle } from "@/lib/analysis/synth";
import { formatScore } from "@/lib/domain/scores";
import type { BreathGoal, OpenSpanMetrics, TransitionScores } from "@/lib/domain/types";
import {
  coaching,
  grade,
  onTargetShare,
  rateChange,
  rateWord,
  resultsEmphasis,
  tipFor,
  weakestPart,
  weakRun,
  type ResultsSession,
  type TurnPoints,
} from "./tone";

type Part = {
  timing: { inhale: number; exhale: number };
  depth: { inhale: number; exhale: number };
};

function paced(
  total: number,
  parts: Part,
  lean: Partial<Record<"ti" | "te" | "di" | "de", number>> = {},
  onTarget = { timing: 70, depth: 60 },
): ResultsSession {
  const scores: TransitionScores = { total, ...parts, smoothness: null };
  return {
    mode: "paced",
    durationSec: 180,
    pacerHalfCycleSec: 5,
    scores,
    paced: {
      onTargetPct: onTarget,
      direction: {
        timing: { inhale: lean.ti ?? null, exhale: lean.te ?? null },
        depth: { inhale: lean.di ?? null, exhale: lean.de ?? null },
      },
      histogram: { timing: [], depth: [], missedOrDouble: 0 },
      missed: 0,
      double: 0,
      transitions: 36,
    },
    open: null,
  };
}

function metrics(rateBpm: number): OpenSpanMetrics {
  return {
    rateBpm,
    ieRatio: 1.8,
    inhaleS: 1.5,
    exhaleS: 2.7,
    depthPct: 6,
    inhaleDepthPct: 6,
    exhaleDepthPct: 6,
    depthIndex: 100,
    normalRatePct: 80,
    normalDepthPct: 70,
  };
}

function open(rateBpm: number | null): ResultsSession {
  return {
    mode: "open",
    durationSec: 180,
    pacerHalfCycleSec: null,
    scores: null,
    paced: null,
    open: {
      whole: rateBpm === null ? null : metrics(rateBpm),
      breaths: 40,
      segments: [],
    },
  };
}

// A good (Good, band ok), a middling (Fair) and a poor (Starting out) paced session, each with a clear weakest part.
const GOOD = paced(8.8, { timing: { inhale: 9, exhale: 8 }, depth: { inhale: 9.2, exhale: 9 } }, { te: -0.3 }, { timing: 88, depth: 80 });
const MIDDLING = paced(
  5.8,
  { timing: { inhale: 7, exhale: 6 }, depth: { inhale: 4, exhale: 6.2 } },
  { di: -0.5 },
  { timing: 60, depth: 40 },
);
const POOR = paced(2.5, { timing: { inhale: 3, exhale: 1 }, depth: { inhale: 3, exhale: 3 } }, { te: 0.4 }, { timing: 20, depth: 30 });
const SESSIONS = { good: GOOD, middling: MIDDLING, poor: POOR } as const;

const PRAISE = /\b(nice|great|excellent|well done|good|calm)\b/i;
const GOALS: (BreathGoal | null)[] = ["train", "focus", "calm", null];

describe("resultsEmphasis per goal", () => {
  it("Train shows every number, open", () => {
    expect(resultsEmphasis("train")).toMatchObject({
      density: "full",
      detailsOpen: true,
      share: false,
      tip: false,
    });
  });
  it("Focus leads with the headline and the share on target, the rest folded", () => {
    expect(resultsEmphasis("focus")).toMatchObject({
      density: "focused",
      detailsOpen: false,
      share: true,
      rateChange: true,
      tip: false,
    });
  });
  it("Calm keeps the headline, its word and one tip", () => {
    expect(resultsEmphasis("calm")).toMatchObject({
      density: "minimal",
      detailsOpen: false,
      share: false,
      tip: true,
    });
  });
  it("without a goal, today's full results", () => {
    expect(resultsEmphasis(null)).toMatchObject({
      density: "full",
      detailsOpen: true,
    });
  });
});

describe("weakest part and grade", () => {
  it("picks the lowest sub-score with its lean", () => {
    expect(weakestPart(GOOD)).toEqual({
      measure: "timing",
      phase: "exhale",
      score: 8,
      lean: -0.3,
    });
    expect(weakestPart(MIDDLING)).toEqual({
      measure: "depth",
      phase: "inhale",
      score: 4,
      lean: -0.5,
    });
    expect(weakestPart(open(14))).toBeNull();
  });
  it("grades by the Total's band, and open sessions by their rate", () => {
    expect([GOOD, MIDDLING, POOR].map(grade)).toEqual(["ok", "mid", "low"]);
    expect([open(10), open(15), open(18), open(25), open(null)].map(grade)).toEqual(["ok", "ok", "mid", "low", null]);
  });
});

describe("the coaching line never contradicts the score", () => {
  for (const goal of GOALS) {
    for (const [name, session] of Object.entries(SESSIONS)) {
      it(`${goal ?? "no goal"}, ${name} session`, () => {
        const { line } = coaching({ goal, session, streakDays: 3 });
        expect(line).toBeTruthy();
        if (name === "good") return;
        // No praise for a middling or poor session, in any tone.
        expect(line).not.toMatch(PRAISE);
      });
    }
  }

  it("Train names the weakest part with its own number", () => {
    for (const session of [GOOD, MIDDLING, POOR]) {
      const part = weakestPart(session)!;
      expect(coaching({ goal: "train", session, streakDays: 1 }).line).toContain(
        `${part.phase === "inhale" ? "Inhale" : "Exhale"} ${part.measure} ${formatScore(part.score)}.`,
      );
    }
  });
});

describe("Train: numbers first", () => {
  it("good: the weakest part and which way it leaned", () => {
    expect(coaching({ goal: "train", session: GOOD, streakDays: 1 }).line).toBe("Exhale timing 8. You cut breaths out short by 1.5 s.");
  });
  it("middling: depth in % of max", () => {
    expect(coaching({ goal: "train", session: MIDDLING, streakDays: 1 }).line).toBe(
      "Inhale depth 4. Breaths in were 1.5% of max shallower than the pacer.",
    );
  });
  it("poor: late, and the breaths it happened on", () => {
    const turns: TurnPoints[] = Array.from({ length: 18 }, (_, i) => ({
      phase: i % 2 === 0 ? "inhale" : "exhale",
      missed: false,
      double: false,
      timingPoints: i % 2 === 1 && i >= 7 && i <= 17 ? 2 : 9,
      depthPoints: 8,
    }));
    expect(coaching({ goal: "train", session: POOR, streakDays: 1, turns }).line).toBe(
      "Exhale timing 1. You held breaths out 2.0 s past the turn, most of all on breaths out 4 to 9.",
    );
  });
  it("excellent: every part at 9 or above", () => {
    const best = paced(9.5, {
      timing: { inhale: 10, exhale: 9 },
      depth: { inhale: 9.5, exhale: 9.5 },
    });
    expect(coaching({ goal: "train", session: best, streakDays: 1 }).line).toBe("Total 9.5. Every part at 9 or above.");
  });
  it("open: the rate against the normal range, and the rhythm", () => {
    expect(coaching({ goal: "train", session: open(18.4), streakDays: 1 }).line).toBe(
      "Rate 18 br/min, above the normal 12–16. In to out 1 : 1.8; 1 : 2 is typical.",
    );
  });
  it("no goal reads like Train", () => {
    expect(coaching({ goal: null, session: GOOD, streakDays: 1 })).toEqual(coaching({ goal: "train", session: GOOD, streakDays: 1 }));
  });
  it("an old-style score has no line", () => {
    const legacy: ResultsSession = {
      ...GOOD,
      scores: {
        overall: 70,
        timing: 70,
        depth: 70,
      } as unknown as ResultsSession["scores"],
      paced: null,
    };
    expect(coaching({ goal: "train", session: legacy, streakDays: 1 }).line).toBeNull();
  });
});

describe("Focus: calm minutes and the number that shows it", () => {
  it("good: calm minutes and the share on target", () => {
    expect(coaching({ goal: "focus", session: GOOD, streakDays: 1 }).line).toBe("Three calm minutes. On target 84% of the time.");
  });
  it("middling and poor: done, the share, and what to change", () => {
    expect(coaching({ goal: "focus", session: MIDDLING, streakDays: 1 }).line).toBe(
      "Three minutes done, on target 50% of the time. Next time, breathe in a little fuller, into your belly.",
    );
    expect(coaching({ goal: "focus", session: POOR, streakDays: 1 }).line).toBe(
      "Three minutes done, on target 25% of the time. Next time, turn with the pacer a little sooner.",
    );
  });
  it("open: the rate dropping through the session (02 §5.1)", () => {
    expect(
      coaching({
        goal: "focus",
        session: open(14),
        streakDays: 1,
        rates: { from: 17, to: 12 },
      }).line,
    ).toBe("Three calm minutes. Rate dropped from 17 to 12.");
    expect(
      coaching({
        goal: "focus",
        session: open(20),
        streakDays: 1,
        rates: { from: 24, to: 20 },
      }).line,
    ).toBe("Three minutes done. Rate dropped from 24 to 20.");
    expect(
      coaching({
        goal: "focus",
        session: open(15),
        streakDays: 1,
        rates: { from: 13, to: 17 },
      }).line,
    ).toBe("Three minutes done. Rate rose from 13 to 17. Same again next time.");
  });
  it("open without a start and end rate: the whole session's rate", () => {
    expect(
      coaching({
        goal: "focus",
        session: { ...open(14), durationSec: 32 },
        streakDays: 1,
      }).line,
    ).toBe("32 calm seconds, at 14 breaths a minute.");
    expect(coaching({ goal: "focus", session: open(19), streakDays: 1 }).line).toBe(
      "Three minutes done, at 19 breaths a minute. Next time, try a slower, longer breath out.",
    );
  });
  it("the share on target is the mean of timing and depth", () => {
    expect(onTargetShare(GOOD)).toBe(84);
    expect(onTargetShare(open(14))).toBeNull();
  });
});

describe("Calm: showing up, one tip", () => {
  it("good: praise and the streak (the Home line's words)", () => {
    expect(coaching({ goal: "calm", session: GOOD, streakDays: 3 })).toEqual({
      line: "Nice. Three days in a row.",
      tip: "Next time, let each breath out run until the pacer turns.",
    });
    expect(coaching({ goal: "calm", session: GOOD, streakDays: 1 }).line).toBe("Done for today. Nice.");
  });
  it("middling and poor: done, the streak, no praise", () => {
    expect(coaching({ goal: "calm", session: MIDDLING, streakDays: 3 }).line).toBe("Done. Three days in a row.");
    expect(coaching({ goal: "calm", session: POOR, streakDays: 1 })).toEqual({
      line: "Done for today.",
      tip: "Next time, turn with the pacer a little sooner.",
    });
  });
  it("a clinician's client hears about the visit, never a streak", () => {
    const line = coaching({
      goal: "calm",
      session: GOOD,
      streakDays: 5,
      professional: { name: "Lena Vos", kind: "clinician" },
    }).line;
    expect(line).toBe("Done for today. Lena will see this before your next visit.");
  });
  it("open sessions: praise at a resting rate, a slower breath out when fast", () => {
    expect(coaching({ goal: "calm", session: open(13), streakDays: 2 })).toEqual({
      line: "Nice. Two days in a row.",
      tip: "Same again next time.",
    });
    expect(coaching({ goal: "calm", session: open(22), streakDays: 2 })).toEqual({
      line: "Done. Two days in a row.",
      tip: "Next time, try a slower, longer breath out.",
    });
  });
});

describe("tips and words", () => {
  it("one plain tip per weak part and lean, no numbers", () => {
    const cases: [ResultsSession, string][] = [
      [
        paced(6, { timing: { inhale: 4, exhale: 7 }, depth: { inhale: 7, exhale: 7 } }, { ti: -0.4 }),
        "Next time, keep breathing in until the pacer turns.",
      ],
      [
        paced(6, { timing: { inhale: 7, exhale: 7 }, depth: { inhale: 7, exhale: 4 } }, { de: -0.4 }),
        "Next time, let a little more air out on each breath.",
      ],
      [
        paced(6, { timing: { inhale: 7, exhale: 7 }, depth: { inhale: 4, exhale: 7 } }, { di: 0.6 }),
        "Next time, keep each breath a little softer.",
      ],
      [
        paced(6, {
          timing: { inhale: 4, exhale: 7 },
          depth: { inhale: 7, exhale: 7 },
        }),
        "Next time, follow the pacer's turns a little more closely.",
      ],
      [
        paced(9.5, {
          timing: { inhale: 10, exhale: 9 },
          depth: { inhale: 9.5, exhale: 9.5 },
        }),
        "Same again next time.",
      ],
      [open(null), "Next time, keep the band snug and breathe as you normally would."],
    ];
    for (const [session, tip] of cases) {
      expect(tipFor(session)).toBe(tip);
      expect(tip).not.toMatch(/\d/);
    }
  });
  it("names the rate against the normal range", () => {
    expect([rateWord(10), rateWord(14), rateWord(17)]).toEqual(["Slower than normal", "In the normal range", "Faster than normal"]);
  });
});

describe("weakRun", () => {
  const turns = (weak: boolean[]): TurnPoints[] =>
    weak.flatMap((w) => [
      {
        phase: "inhale" as const,
        missed: false,
        double: false,
        timingPoints: 9,
        depthPoints: 9,
      },
      {
        phase: "exhale" as const,
        missed: w,
        double: false,
        timingPoints: w ? 9 : 9,
        depthPoints: 9,
      },
    ]);
  it("finds the longest run of three or more weak breaths, counted per phase", () => {
    expect(weakRun(turns([false, true, true, false, true, true, true, true, false]), { measure: "timing", phase: "exhale" })).toEqual({
      from: 5,
      to: 8,
    });
    expect(
      weakRun(turns([false, false, true, true, true]), {
        measure: "depth",
        phase: "exhale",
      }),
    ).toEqual({ from: 3, to: 5 });
  });
  it("ignores runs shorter than three", () => {
    expect(
      weakRun(turns([true, true, false, true]), {
        measure: "timing",
        phase: "exhale",
      }),
    ).toBeNull();
    expect(
      weakRun(turns([true, true, true]), {
        measure: "timing",
        phase: "inhale",
      }),
    ).toBeNull();
  });
});

describe("rateChange", () => {
  const HZ = 20;
  it("reads the rate falling from the first third to the last", () => {
    const signal = generatePiecewise(
      [
        { fromS: 0, pattern: withCycle(OPEN_NORMAL_PATTERN, 60 / 17) },
        { fromS: 60, pattern: withCycle(OPEN_NORMAL_PATTERN, 60 / 14) },
        { fromS: 120, pattern: withCycle(OPEN_NORMAL_PATTERN, 60 / 12) },
      ],
      { durationS: 180, sampleRateHz: HZ },
    );
    const change = rateChange(signal.user, HZ)!;
    expect(Math.abs(change.from - 17)).toBeLessThanOrEqual(1);
    expect(Math.abs(change.to - 12)).toBeLessThanOrEqual(1);
  });
  it("is null when each third would be under 20 seconds", () => {
    const signal = generatePiecewise([{ fromS: 0, pattern: OPEN_NORMAL_PATTERN }], { durationS: 50, sampleRateHz: HZ });
    expect(rateChange(signal.user, HZ)).toBeNull();
  });
});
