import { describe, expect, it } from "vitest";
import { daysAgoText } from "./activity";
import { isLegacyScores, legacyBand } from "./scores";

describe("daysAgoText", () => {
  it("says today, yesterday, or how many days ago", () => {
    expect(daysAgoText(0)).toBe("Today");
    expect(daysAgoText(1)).toBe("Yesterday");
    expect(daysAgoText(4)).toBe("4 days ago");
  });
});

describe("legacyBand", () => {
  it("is ok from 70", () => {
    expect(legacyBand(70)).toBe("ok");
    expect(legacyBand(69.9)).toBe("mid");
  });

  it("is mid from 50 and low below", () => {
    expect(legacyBand(50)).toBe("mid");
    expect(legacyBand(49.9)).toBe("low");
  });
});

describe("isLegacyScores", () => {
  it("is true for legacy scores only", () => {
    expect(isLegacyScores({ overall: 72, depth: 70, timing: 75 })).toBe(true);
    expect(
      isLegacyScores({ total: 7.5, timing: { inhale: 8, exhale: 7 }, depth: { inhale: 7, exhale: 8 }, smoothness: null }),
    ).toBe(false);
    expect(isLegacyScores(null)).toBe(false);
  });
});
