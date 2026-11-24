import { describe, expect, it } from "vitest";
import { OPEN_CONSTANTS } from "../analysis/config";
import { combineTransitionScores } from "./scores";

describe("combineTransitionScores", () => {
  it("rounds the weighted mean of the four sub-scores once", () => {
    expect(combineTransitionScores({ inhale: 7.06, exhale: 7.06 }, { inhale: 8, exhale: 8 })).toBe(7.5);
    expect(combineTransitionScores({ inhale: 7.3, exhale: 7.4 }, { inhale: 8.2, exhale: 8.3 })).toBe(7.8);
    expect(combineTransitionScores({ inhale: 6.25, exhale: 6.25 }, { inhale: 8, exhale: 8 })).toBe(7.1);
  });

  it("gives the same result as before for whole-number sub-scores", () => {
    expect(combineTransitionScores({ inhale: 8, exhale: 7 }, { inhale: 7, exhale: 7 })).toBe(7.3);
    expect(combineTransitionScores({ inhale: 8, exhale: 8 }, { inhale: 8, exhale: 7 })).toBe(7.8);
  });

  it("uses weights from config that add up to 1", () => {
    const sum = Object.values(OPEN_CONSTANTS.totalBreathScoreWeights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});
