import { describe, expect, it } from "vitest";
import { shareCardOf } from "./shareCard";

const base = { startedAt: "2026-11-24T08:00:00.000Z", durationSec: 300, pacerHalfCycleSec: 5 };

describe("shareCardOf", () => {
  it("shows a paced session's Total Breath Score and its word, nothing more", () => {
    const card = shareCardOf({ ...base, mode: "paced", respirationRateBpm: 6, scores: { total: 7.25, timing: 7, depth: 7.5 } as never });
    expect(card).toMatchObject({ big: "7.3", unit: "/ 10" });
    expect(card.word).toMatch(/· Total Breath Score$/);
    expect(card.detail).toContain("Paced 5-5");
  });

  it("shows an open session's breathing rate, or a dash with too few breaths", () => {
    expect(shareCardOf({ ...base, mode: "open", pacerHalfCycleSec: null, scores: null, respirationRateBpm: 13.6 })).toMatchObject({ big: "14", unit: "br/min" });
    expect(shareCardOf({ ...base, mode: "open", pacerHalfCycleSec: null, scores: null, respirationRateBpm: null }).big).toBe("–");
  });
});
