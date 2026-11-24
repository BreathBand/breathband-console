import { describe, expect, it } from "vitest";
import { FIXED_CONSTANTS, OPEN_CONSTANTS } from "./config";

describe("FIXED_CONSTANTS for paced scoring", () => {
  it("matches user transitions within 1 timing SD of the pacer", () => {
    expect(FIXED_CONSTANTS.pacedMatchWindowSd).toBe(1);
  });

  it("gives 1 point for a missed or double transition", () => {
    expect(FIXED_CONSTANTS.missedOrDoublePoints).toBe(1);
  });

  it("keeps points between 1 and 10", () => {
    expect(FIXED_CONSTANTS.pacedPointRange).toEqual({ min: 1, max: 10 });
  });

  it("keeps the new names out of the open group", () => {
    for (const name of ["pacedMatchWindowSd", "missedOrDoublePoints", "pacedPointRange"]) {
      expect(Object.hasOwn(OPEN_CONSTANTS, name)).toBe(false);
    }
  });
});
