import { describe, expect, it } from "vitest";
import {
  canAnswerCoachInvite,
  canCancelAssignment,
  canCoach,
  canComment,
  canDeleteComment,
  canHostGroup,
  canInviteAthlete,
  canManageSharing,
  canReadAthlete,
  canReadCurves,
  canReadPrivateProfile,
  canReadLink,
  canReadGroup,
  canReadProfile,
  canRedeemInvite,
  canRunGroup,
  canSaveSquad,
  canSetProFields,
  canUseCoachData,
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

describe("coach links and invites (I-09)", () => {
  it("lets either side read the link, and nobody else", () => {
    expect(canReadLink(COACH, COACH, ATHLETE)).toBe(true);
    expect(canReadLink(ATHLETE, COACH, ATHLETE)).toBe(true);
    expect(canReadLink(STRANGER, COACH, ATHLETE)).toBe(false);
  });

  it("leaves invites, scope and revoking to the athlete", () => {
    expect(canManageSharing(ATHLETE, ATHLETE)).toBe(true);
    expect(canManageSharing(COACH, ATHLETE)).toBe(false);
    expect(canManageSharing(STRANGER, ATHLETE)).toBe(false);
  });

  it("redeems an invite only as yourself, and never your own", () => {
    expect(canRedeemInvite(COACH, COACH, ATHLETE)).toBe(true);
    expect(canRedeemInvite(STRANGER, COACH, ATHLETE)).toBe(false);
    expect(canRedeemInvite(ATHLETE, ATHLETE, ATHLETE)).toBe(false);
  });
});

describe("coaching a linked athlete (I-09)", () => {
  it.each<[LinkScope, boolean]>([
    ["scores", true],
    ["curves", true],
    [null, false],
  ])("sets practice, targets and notes with a %s link: %s", (link, allowed) => {
    expect(canCoach(COACH, COACH, link)).toBe(allowed);
  });

  it("never lets someone coach in another's name, linked or not", () => {
    expect(canCoach(ATHLETE, COACH, "curves")).toBe(false);
    expect(canCoach(STRANGER, COACH, "curves")).toBe(false);
  });

  it("lets only the coach who set practice cancel it, even after a revoke", () => {
    expect(canCancelAssignment(COACH, COACH)).toBe(true);
    expect(canCancelAssignment(ATHLETE, COACH)).toBe(false);
    expect(canCancelAssignment(STRANGER, COACH)).toBe(false);
  });
});

describe("comments and kudos (I-09)", () => {
  it.each<[string, string, LinkScope, boolean]>([
    ["the athlete", ATHLETE, null, true],
    ["a scores-only coach", COACH, "scores", true],
    ["a curves coach", COACH, "curves", true],
    ["a revoked coach", COACH, null, false],
    ["a stranger", STRANGER, null, false],
  ])("%s may comment: %s", (_, viewer, link, allowed) => {
    expect(canComment(viewer, ATHLETE, link)).toBe(allowed);
  });

  it("lets only the author delete one", () => {
    expect(canDeleteComment(COACH, COACH)).toBe(true);
    expect(canDeleteComment(ATHLETE, COACH)).toBe(false);
  });
});

describe("a coach's own working data (I-09)", () => {
  it("is the coach's alone: the athlete never reads the seen marks or the private notes", () => {
    expect(canUseCoachData(COACH, COACH)).toBe(true);
    expect(canUseCoachData(ATHLETE, COACH)).toBe(false);
    expect(canUseCoachData(STRANGER, COACH)).toBe(false);
  });
});

describe("squads and alert rules (I-10)", () => {
  it("keeps squads and alert rules to the coach", () => {
    expect(canUseCoachData(COACH, COACH)).toBe(true);
    expect(canUseCoachData(ATHLETE, COACH)).toBe(false);
  });

  it.each<[string, LinkScope[], boolean]>([
    ["no one", [], true],
    ["linked athletes in either scope", ["scores", "curves"], true],
    ["an athlete not linked (or revoked)", ["curves", null], false],
  ])("lets a coach save a squad of %s: %s", (_, links, allowed) => {
    expect(canSaveSquad(COACH, COACH, links)).toBe(allowed);
  });

  it("never lets someone save a squad in another's name", () => {
    expect(canSaveSquad(STRANGER, COACH, ["curves"])).toBe(false);
  });
});

describe("a coach's invites to athletes (I-10)", () => {
  it("lets a professional invite in their own name only", () => {
    expect(canInviteAthlete(COACH, COACH, "coach")).toBe(true);
    expect(canInviteAthlete(ATHLETE, ATHLETE, "athlete")).toBe(false);
    expect(canInviteAthlete(STRANGER, COACH, "coach")).toBe(false);
  });

  it("lets an athlete answer for themselves only, and never a professional", () => {
    expect(canAnswerCoachInvite(ATHLETE, ATHLETE, "athlete")).toBe(true);
    expect(canAnswerCoachInvite(COACH, COACH, "coach")).toBe(false);
    expect(canAnswerCoachInvite(STRANGER, ATHLETE, "athlete")).toBe(false);
  });
});

describe("group sessions (I-10)", () => {
  it.each<[string, string, string, LinkScope[], boolean]>([
    ["a coach for linked athletes", COACH, "coach", ["scores", "curves"], true],
    ["a coach with an unlinked athlete", COACH, "coach", ["curves", null], false],
    ["an athlete", ATHLETE, "athlete", ["curves", "curves"], false],
  ])("lets %s host: %s", (_, viewer, role, links, allowed) => {
    expect(canHostGroup(viewer, viewer, role as "athlete" | "coach", links)).toBe(allowed);
  });

  it("never lets someone host in another's name", () => {
    expect(canHostGroup(STRANGER, COACH, "coach", ["curves", "curves"])).toBe(false);
  });

  it("shows a group session to its host and invited athletes only", () => {
    expect(canReadGroup(COACH, COACH, [ATHLETE])).toBe(true);
    expect(canReadGroup(ATHLETE, COACH, [ATHLETE])).toBe(true);
    expect(canReadGroup(STRANGER, COACH, [ATHLETE])).toBe(false);
  });

  it("lets only the host run it, invited athletes included", () => {
    expect(canRunGroup(COACH, COACH)).toBe(true);
    expect(canRunGroup(ATHLETE, COACH)).toBe(false);
  });
});
