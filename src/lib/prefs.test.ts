import { describe, expect, it } from "vitest";
import { DEFAULT_SETUP, parseSetup, setupQuery } from "./prefs";

describe("session setup", () => {
  it("round-trips through the query string", () => {
    const setup = { mode: "open", pacer: 2, lengthSec: 0, view: "line", sound: false, skill: "expert" } as const;
    expect(parseSetup(new URLSearchParams(setupQuery(setup)))).toEqual(setup);
  });

  it("falls back to the defaults for anything missing or out of range", () => {
    expect(parseSetup(new URLSearchParams(""))).toEqual(DEFAULT_SETUP);
    const odd = parseSetup(new URLSearchParams("mode=x&pacer=9&len=99999&view=y&skill=z"));
    expect(odd).toEqual({ ...DEFAULT_SETUP, pacer: 5 });
  });
});
