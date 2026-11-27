import { describe, expect, it } from "vitest";
import { isPlausibleRate } from "./open";

// D-K (2026-11-27): a whole-session rate below 3 or above 40 breaths a minute
// is flagged as the band, not the breathing; scores are unchanged.
describe("isPlausibleRate", () => {
  it("takes 3 to 40 breaths a minute, ends included", () => {
    for (const rate of [3, 6, 14, 30, 40]) expect(isPlausibleRate(rate)).toBe(true);
    for (const rate of [0, 2.9, 40.1, 90]) expect(isPlausibleRate(rate)).toBe(false);
  });
});
