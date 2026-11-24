import { describe, expect, it } from "vitest";
import { FIXED_CONSTANTS, OPEN_CONSTANTS } from "./config";

describe("FIXED_CONSTANTS for open-session metrics", () => {
  it("caps the depth index at +/-100", () => {
    expect(FIXED_CONSTANTS.depthIndexCapPct).toBe(100);
  });

  it("refines transitions within 0.25 s of the detected time", () => {
    expect(FIXED_CONSTANTS.transitionRefineWindowS).toBe(0.25);
  });

  it("keeps the new names out of the open group", () => {
    for (const name of ["depthIndexCapPct", "transitionRefineWindowS"]) {
      expect(Object.hasOwn(OPEN_CONSTANTS, name)).toBe(false);
    }
  });
});
