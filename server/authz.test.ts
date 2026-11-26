import { describe, expect, it } from "vitest";
import {
  canReadAthlete,
  canReadCurves,
  canReadPrivateProfile,
  canReadProfile,
  canSetProFields,
  canWriteOwn,
  type LinkScope,
} from "./authz";

const ATHLETE = "athlete-1";
const COACH = "coach-1";
const STRANGER = "stranger-1";

describe("own data", () => {
  it("lets the athlete read and write their own sessions, signal and profile", () => {
    expect(canReadAthlete(ATHLETE, ATHLETE, null)).toBe(true);
    expect(canReadCurves(ATHLETE, ATHLETE, null)).toBe(true);
    expect(canReadProfile(ATHLETE, ATHLETE, null, null)).toBe(true);
    expect(canReadPrivateProfile(ATHLETE, ATHLETE)).toBe(true);
    expect(canWriteOwn(ATHLETE, ATHLETE)).toBe(true);
  });

  it("refuses someone else's data to a person with no link", () => {
    expect(canReadAthlete(STRANGER, ATHLETE, null)).toBe(false);
    expect(canReadCurves(STRANGER, ATHLETE, null)).toBe(false);
    expect(canReadProfile(STRANGER, ATHLETE, null, null)).toBe(false);
    expect(canWriteOwn(STRANGER, ATHLETE)).toBe(false);
  });
});

describe("a linked professional, per scope", () => {
  it.each<[LinkScope, boolean]>([
    ["scores", false],
    ["curves", true],
  ])("with %s reads sessions; curves only with the curves scope (%s)", (scope, curves) => {
    expect(canReadAthlete(COACH, ATHLETE, scope)).toBe(true);
    expect(canReadCurves(COACH, ATHLETE, scope)).toBe(curves);
  });

  it("hides the curves on a scores-only link", () => {
    expect(canReadCurves(COACH, ATHLETE, "scores")).toBe(false);
  });

  it("reads the profile from either side of the link, but never the birth year or consents", () => {
    expect(canReadProfile(COACH, ATHLETE, "scores", null)).toBe(true);
    expect(canReadProfile(ATHLETE, COACH, null, "curves")).toBe(true);
    expect(canReadPrivateProfile(COACH, ATHLETE)).toBe(false);
  });

  it("never writes the athlete's data, whatever the scope", () => {
    expect(canWriteOwn(COACH, ATHLETE)).toBe(false);
  });

  it("is denied everything once the link is revoked", () => {
    const revoked: LinkScope = null;
    expect(canReadAthlete(COACH, ATHLETE, revoked)).toBe(false);
    expect(canReadCurves(COACH, ATHLETE, revoked)).toBe(false);
    expect(canReadProfile(COACH, ATHLETE, revoked, null)).toBe(false);
  });
});

describe("professional fields", () => {
  it("are for role coach only", () => {
    expect(canSetProFields("coach")).toBe(true);
    expect(canSetProFields("athlete")).toBe(false);
  });
});
