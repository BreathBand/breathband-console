import { describe, expect, it } from "vitest";
import { targetsFor } from "./targets";
import { DEFAULT_TARGETS } from "./types";

describe("targetsFor", () => {
  it("uses the coach link's targets when it has them", () => {
    const targets = { score: 8, rateLow: 10, rateHigh: 14, sessionsPerWeek: 5 };
    expect(targetsFor({ targets })).toEqual(targets);
  });

  it("falls back to the usual targets when the link has none", () => {
    expect(targetsFor({ targets: null })).toEqual(DEFAULT_TARGETS);
    expect(targetsFor({ targets: undefined })).toEqual(DEFAULT_TARGETS);
    expect(targetsFor({})).toEqual(DEFAULT_TARGETS);
  });

  it("falls back to the usual targets when there is no link", () => {
    expect(targetsFor(null)).toEqual(DEFAULT_TARGETS);
    expect(targetsFor(undefined)).toEqual(DEFAULT_TARGETS);
  });
});
