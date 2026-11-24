import { describe, expect, it } from "vitest";
import { FIXED_CONSTANTS, OPEN_CONSTANTS } from "./config";

describe("FIXED_CONSTANTS additions", () => {
  it("calibrates from the 3 highest peaks and the 3 lowest troughs", () => {
    expect(FIXED_CONSTANTS.calibrationPeakCount).toBe(3);
    expect(FIXED_CONSTANTS.calibrationTroughCount).toBe(3);
  });

  it("keeps the new names out of the open group", () => {
    expect(Object.hasOwn(OPEN_CONSTANTS, "calibrationPeakCount")).toBe(false);
    expect(Object.hasOwn(OPEN_CONSTANTS, "calibrationTroughCount")).toBe(false);
  });
});
