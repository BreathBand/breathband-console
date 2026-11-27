import { beforeEach, describe, expect, it } from "vitest";
import { SCORING_VERSIONS, type AthleteTargets, type SessionSummary, type Waveform } from "@/lib/domain/types";
import type { NewAssignment, NewSession } from "../types";
import type { DataContractHarness, Person } from "./data.harness";
import { refusal } from "./data.harness";

// The coaching sections of the shared adapter suite: coach links (invite →
// redeem, scope, revoke), private notes, seen marks, targets, assignments,
// comments and kudos, with every permission case: own, linked (scores-only or
// curves), unlinked, revoked. Run by contract/data.local.test.ts and
// http/data.http.test.ts.

const session: NewSession = {
  startedAt: "2026-11-24T08:00:00.000Z",
  durationSec: 240,
  mode: "open",
  pacerHalfCycleSec: null,
  scores: null,
  scoringVersion: SCORING_VERSIONS.transition,
  respirationRateBpm: 14,
  note: "",
  appVersion: "web",
  source: "web",
};

const signal: Waveform = {
  sampleIntervalMs: 50,
  user: [0, 0.5, 1, 0.5, 0, -0.5, -1, -0.5],
  pacer: null,
  markers: [],
  calibration: { min: -1, max: 1 },
};

const TARGETS: AthleteTargets = { score: 8, rateLow: 10, rateHigh: 14, sessionsPerWeek: 5 };

const inAWeek = () => new Date(Date.now() + 7 * 86_400_000).toISOString();

const practice = (athleteId: string, fields: Partial<NewAssignment> = {}): NewAssignment => ({
  athleteId,
  mode: "paced",
  pacerHalfCycleSec: 5,
  durationSec: 300,
  target: 4,
  dueAt: inAWeek(),
  note: "  slow and even  ",
  ...fields,
});

const uids = (people: { uid: string }[]) => people.map((p) => p.uid).sort();

export function describeCoachingContract(adapter: string, setup: () => DataContractHarness | Promise<DataContractHarness>) {
  describe(`DataService contract, coaching: ${adapter}`, () => {
    let h: DataContractHarness;
    let ana: Person;
    let cara: Person;

    beforeEach(async () => {
      h = await setup();
      [ana, cara] = await Promise.all([h.person(), h.person("coach")]);
    });

    /** Ana shares with Cara through an invite, the way the screens do it. */
    const linkAnaToCara = async (scope: "scores" | "curves" = "curves") => {
      const invite = await ana.backend.data.createInvite(ana.uid, scope);
      return cara.backend.data.redeemInvite(cara.uid, invite.code);
    };
    const saveAnaSession = (): Promise<SessionSummary> => ana.backend.data.saveSession(ana.uid, session, signal);

    describe("invites and coach links", () => {
      it("links a coach who redeems the athlete's invite, with the invite's scope, readable from both sides", async () => {
        const invite = await ana.backend.data.createInvite(ana.uid, "scores");
        expect(invite).toMatchObject({ athleteId: ana.uid, scope: "scores" });
        expect(invite.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
        const days = (Date.parse(invite.expiresAt) - Date.now()) / 86_400_000;
        expect(days).toBeGreaterThan(6.9);
        expect(days).toBeLessThanOrEqual(7);

        // Typed by hand: lower case and stray spaces still redeem.
        const link = await cara.backend.data.redeemInvite(cara.uid, ` ${invite.code.toLowerCase()} `);
        expect(link).toMatchObject({ coachId: cara.uid, athleteId: ana.uid, scope: "scores" });
        expect(Date.parse(link.createdAt)).not.toBeNaN();
        for (const reader of [ana, cara]) {
          expect(await reader.backend.data.getCoachLink(cara.uid, ana.uid)).toMatchObject({ coachId: cara.uid, athleteId: ana.uid, scope: "scores" });
        }
        expect(uids(await cara.backend.data.listAthletes(cara.uid))).toEqual([ana.uid]);
        expect(uids(await ana.backend.data.listCoaches(ana.uid))).toEqual([cara.uid]);
      });

      it("shares curves when the invite doesn't say", async () => {
        const invite = await ana.backend.data.createInvite(ana.uid);
        expect(invite.scope).toBe("curves");
        expect(await cara.backend.data.redeemInvite(cara.uid, invite.code)).toMatchObject({ scope: "curves" });
      });

      it("redeems a code once", async () => {
        const invite = await ana.backend.data.createInvite(ana.uid);
        await cara.backend.data.redeemInvite(cara.uid, invite.code);
        const other = await h.person("coach");
        await refusal(other.backend.data.redeemInvite(other.uid, invite.code), "invite-invalid");
        expect(await other.backend.data.getCoachLink(other.uid, ana.uid)).toBeNull();
      });

      it("refuses a code that doesn't exist, and the athlete's own", async () => {
        await refusal(cara.backend.data.redeemInvite(cara.uid, "ZZZZ2222"), "invite-invalid");
        const invite = await ana.backend.data.createInvite(ana.uid);
        await refusal(ana.backend.data.redeemInvite(ana.uid, invite.code), "invite-invalid");
        expect(await ana.backend.data.listCoaches(ana.uid)).toEqual([]);
      });

      it("lets only a professional redeem a code, and leaves it good for one", async () => {
        const invite = await ana.backend.data.createInvite(ana.uid);
        const friend = await h.person();
        await refusal(friend.backend.data.redeemInvite(friend.uid, invite.code), "invite-invalid");
        expect(await ana.backend.data.listCoaches(ana.uid)).toEqual([]);
        expect(await cara.backend.data.redeemInvite(cara.uid, invite.code)).toMatchObject({ coachId: cara.uid, athleteId: ana.uid });
      });

      it("lets only the athlete invite for themselves, and each coach redeem only as themselves", async () => {
        await refusal(cara.backend.data.createInvite(ana.uid), "permission-denied");
        const invite = await ana.backend.data.createInvite(ana.uid);
        const stranger = await h.person();
        await refusal(stranger.backend.data.redeemInvite(cara.uid, invite.code), "permission-denied");
        // Still good for the coach it was meant for.
        expect(await cara.backend.data.redeemInvite(cara.uid, invite.code)).toMatchObject({ athleteId: ana.uid });
      });

      it("answers null for no link, and keeps a link from anyone but its two sides", async () => {
        expect(await cara.backend.data.getCoachLink(cara.uid, ana.uid)).toBeNull();
        await linkAnaToCara();
        const stranger = await h.person();
        await refusal(stranger.backend.data.getCoachLink(cara.uid, ana.uid), "permission-denied");
        await refusal(stranger.backend.data.listAthletes(cara.uid), "permission-denied");
        await refusal(stranger.backend.data.listCoaches(ana.uid), "permission-denied");
        await refusal(cara.backend.data.listCoaches(ana.uid), "permission-denied");
        await refusal(ana.backend.data.listAthletes(cara.uid), "permission-denied");
        const nobody = h.signedOut().data;
        await refusal(nobody.getCoachLink(cara.uid, ana.uid), "not-signed-in");
        await refusal(nobody.createInvite(ana.uid), "not-signed-in");
      });
    });

    describe("setCoachScope", () => {
      it("lets the athlete switch a coach between scores and curves, and the signal follows", async () => {
        const saved = await saveAnaSession();
        await linkAnaToCara("scores");
        await refusal(cara.backend.data.getWaveform(saved), "permission-denied");

        await ana.backend.data.setCoachScope(ana.uid, cara.uid, "curves");
        expect(await cara.backend.data.getCoachLink(cara.uid, ana.uid)).toMatchObject({ scope: "curves" });
        expect(await cara.backend.data.getWaveform(saved)).toEqual(signal);

        await ana.backend.data.setCoachScope(ana.uid, cara.uid, "scores");
        await refusal(cara.backend.data.getWaveform(saved), "permission-denied");
        expect((await cara.backend.data.listSessions(ana.uid)).map((s) => s.id)).toEqual([saved.id]);
      });

      it("refuses the coach changing their own scope, and says not-found with no link", async () => {
        await refusal(ana.backend.data.setCoachScope(ana.uid, cara.uid, "curves"), "not-found");
        await linkAnaToCara("scores");
        await refusal(cara.backend.data.setCoachScope(ana.uid, cara.uid, "curves"), "permission-denied");
        expect(await ana.backend.data.getCoachLink(cara.uid, ana.uid)).toMatchObject({ scope: "scores" });
      });
    });

    describe("revokeCoach", () => {
      it("ends the link: the coach reads nothing of the athlete's afterwards", async () => {
        const saved = await saveAnaSession();
        await linkAnaToCara();
        await ana.backend.data.revokeCoach(ana.uid, cara.uid);

        expect(await ana.backend.data.getCoachLink(cara.uid, ana.uid)).toBeNull();
        expect(await cara.backend.data.listAthletes(cara.uid)).toEqual([]);
        expect(await ana.backend.data.listCoaches(ana.uid)).toEqual([]);
        await refusal(cara.backend.data.getProfile(ana.uid), "permission-denied");
        await refusal(cara.backend.data.listSessions(ana.uid), "permission-denied");
        await refusal(cara.backend.data.getWaveform(saved), "permission-denied");
        await refusal(cara.backend.data.listAssignments(ana.uid), "permission-denied");
        await refusal(cara.backend.data.listComments(ana.uid), "permission-denied");
      });

      it("is the athlete's to do, not the coach's", async () => {
        await linkAnaToCara();
        await refusal(cara.backend.data.revokeCoach(ana.uid, cara.uid), "permission-denied");
        expect(await ana.backend.data.getCoachLink(cara.uid, ana.uid)).not.toBeNull();
      });

      it("lets the athlete share again with a new invite", async () => {
        await linkAnaToCara("curves");
        await ana.backend.data.revokeCoach(ana.uid, cara.uid);
        await linkAnaToCara("scores");
        expect(await cara.backend.data.getCoachLink(cara.uid, ana.uid)).toMatchObject({ scope: "scores" });
      });
    });

    describe("coach notes", () => {
      it("keeps a coach's private note about a linked athlete, empty until written, capped at 5000", async () => {
        await linkAnaToCara("scores");
        expect(await cara.backend.data.getCoachNote(cara.uid, ana.uid)).toBe("");
        await cara.backend.data.saveCoachNote(cara.uid, ana.uid, "Works best in the morning.");
        expect(await cara.backend.data.getCoachNote(cara.uid, ana.uid)).toBe("Works best in the morning.");
        await cara.backend.data.saveCoachNote(cara.uid, ana.uid, "x".repeat(6000));
        expect(await cara.backend.data.getCoachNote(cara.uid, ana.uid)).toHaveLength(5000);
      });

      it("never shows the note to the athlete, or to anyone but the coach who wrote it", async () => {
        await linkAnaToCara();
        await cara.backend.data.saveCoachNote(cara.uid, ana.uid, "Private: anxious before meets.");
        const other = await h.person("coach");
        await refusal(ana.backend.data.getCoachNote(cara.uid, ana.uid), "permission-denied");
        await refusal(other.backend.data.getCoachNote(cara.uid, ana.uid), "permission-denied");
        await refusal(ana.backend.data.saveCoachNote(cara.uid, ana.uid, "overwritten"), "permission-denied");
        // The other coach's own note about Ana is theirs, and empty.
        expect(await other.backend.data.getCoachNote(other.uid, ana.uid)).toBe("");
        const profile = await ana.backend.data.getProfile(ana.uid);
        expect(JSON.stringify(profile)).not.toContain("anxious");
        expect(await cara.backend.data.getCoachNote(cara.uid, ana.uid)).toBe("Private: anxious before meets.");
      });

      it("refuses a note about an athlete the coach isn't linked to, or no longer is", async () => {
        await refusal(cara.backend.data.saveCoachNote(cara.uid, ana.uid, "x"), "permission-denied");
        await linkAnaToCara();
        await ana.backend.data.revokeCoach(ana.uid, cara.uid);
        await refusal(cara.backend.data.saveCoachNote(cara.uid, ana.uid, "x"), "permission-denied");
      });
    });

    describe("seen sessions", () => {
      it("records the sessions a linked coach opened, once each, whatever the scope", async () => {
        const saved = await saveAnaSession();
        await linkAnaToCara("scores");
        expect(await cara.backend.data.listSeenSessions(cara.uid)).toEqual([]);
        await cara.backend.data.markSessionSeen(cara.uid, ana.uid, saved.id);
        await cara.backend.data.markSessionSeen(cara.uid, ana.uid, saved.id);
        expect(await cara.backend.data.listSeenSessions(cara.uid)).toEqual([`${ana.uid}/${saved.id}`]);
      });

      it("keeps a coach's seen list from everyone else, the athlete included", async () => {
        const saved = await saveAnaSession();
        await linkAnaToCara();
        await cara.backend.data.markSessionSeen(cara.uid, ana.uid, saved.id);
        await refusal(ana.backend.data.listSeenSessions(cara.uid), "permission-denied");
        await refusal(ana.backend.data.markSessionSeen(cara.uid, ana.uid, saved.id), "permission-denied");
        await refusal(h.signedOut().data.listSeenSessions(cara.uid), "not-signed-in");
      });
    });

    describe("setTargets", () => {
      it("sets a linked coach's targets, which the athlete can see on the link", async () => {
        await linkAnaToCara("scores");
        await cara.backend.data.setTargets(cara.uid, ana.uid, TARGETS);
        expect(await ana.backend.data.getCoachLink(cara.uid, ana.uid)).toMatchObject({ targets: TARGETS });
        expect(await cara.backend.data.getCoachLink(cara.uid, ana.uid)).toMatchObject({ targets: TARGETS });
      });

      it.each<[string, Partial<AthleteTargets>]>([
        ["a score over 10", { score: 11 }],
        ["a rate range upside down", { rateLow: 16, rateHigh: 12 }],
        ["a rate under 4", { rateLow: 3 }],
        ["a fraction of a session", { sessionsPerWeek: 2.5 }],
        ["more than 21 sessions a week", { sessionsPerWeek: 22 }],
      ])("refuses %s", async (_, fields) => {
        await linkAnaToCara();
        await refusal(cara.backend.data.setTargets(cara.uid, ana.uid, { ...TARGETS, ...fields }), "invalid-input");
        expect((await ana.backend.data.getCoachLink(cara.uid, ana.uid))?.targets ?? null).toBeNull();
      });

      it("refuses an unlinked or revoked coach, and anyone acting as the coach", async () => {
        await refusal(cara.backend.data.setTargets(cara.uid, ana.uid, TARGETS), "permission-denied");
        await linkAnaToCara();
        await refusal(ana.backend.data.setTargets(cara.uid, ana.uid, TARGETS), "permission-denied");
        await ana.backend.data.revokeCoach(ana.uid, cara.uid);
        await refusal(cara.backend.data.setTargets(cara.uid, ana.uid, TARGETS), "permission-denied");
      });
    });

    describe("assignments", () => {
      it("lets a linked coach set practice the athlete and coach both read, newest first, the note trimmed", async () => {
        await linkAnaToCara("scores");
        const input = practice(ana.uid);
        const first = await cara.backend.data.createAssignment(cara.uid, input);
        expect(first).toMatchObject({ ...input, note: "slow and even", coachId: cara.uid, cancelled: false });
        expect(first.id).toEqual(expect.any(String));
        expect(Date.parse(first.createdAt)).not.toBeNaN();
        const second = await cara.backend.data.createAssignment(cara.uid, practice(ana.uid, { mode: "open", pacerHalfCycleSec: null, target: 2 }));
        for (const reader of [ana, cara]) {
          expect((await reader.backend.data.listAssignments(ana.uid)).map((a) => a.id)).toEqual([second.id, first.id]);
        }
      });

      it.each<[string, Partial<NewAssignment>]>([
        ["a target of 0", { target: 0 }],
        ["a target over 30", { target: 31 }],
        ["a fractional target", { target: 2.5 }],
        ["under a minute", { durationSec: 59 }],
        ["paced without a pacer", { pacerHalfCycleSec: null }],
        ["open with a pacer", { mode: "open", pacerHalfCycleSec: 5 }],
        ["a due date in the past", { dueAt: "2020-01-01T00:00:00.000Z" }],
      ])("refuses %s", async (_, fields) => {
        await linkAnaToCara();
        await refusal(cara.backend.data.createAssignment(cara.uid, practice(ana.uid, fields)), "invalid-input");
        expect(await ana.backend.data.listAssignments(ana.uid)).toEqual([]);
      });

      it("refuses practice from an unlinked coach, from the athlete, or set in someone else's name", async () => {
        await refusal(cara.backend.data.createAssignment(cara.uid, practice(ana.uid)), "permission-denied");
        await refusal(ana.backend.data.createAssignment(ana.uid, practice(ana.uid)), "permission-denied");
        await linkAnaToCara();
        await refusal(ana.backend.data.createAssignment(cara.uid, practice(ana.uid)), "permission-denied");
        const stranger = await h.person();
        await refusal(stranger.backend.data.listAssignments(ana.uid), "permission-denied");
      });

      it("lets only the coach who set it cancel it, even after the link ends", async () => {
        await linkAnaToCara();
        const set = await cara.backend.data.createAssignment(cara.uid, practice(ana.uid));
        const other = await h.person("coach");
        const invite = await ana.backend.data.createInvite(ana.uid);
        await other.backend.data.redeemInvite(other.uid, invite.code);

        await refusal(ana.backend.data.cancelAssignment(ana.uid, set.id), "permission-denied");
        await refusal(other.backend.data.cancelAssignment(ana.uid, set.id), "permission-denied");
        await refusal(cara.backend.data.cancelAssignment(ana.uid, "no-such-assignment"), "not-found");

        await ana.backend.data.revokeCoach(ana.uid, cara.uid);
        await cara.backend.data.cancelAssignment(ana.uid, set.id);
        expect(await ana.backend.data.listAssignments(ana.uid)).toMatchObject([{ id: set.id, cancelled: true }]);
      });
    });

    describe("comments and kudos", () => {
      it("threads the athlete's and a scores-only coach's comments and kudos, oldest first, per session or all", async () => {
        const [one, two] = [await saveAnaSession(), await saveAnaSession()];
        await linkAnaToCara("scores");
        const fromCara = await cara.backend.data.addComment(ana.uid, one.id, { kind: "comment", text: "  Smoother exhale.  " });
        expect(fromCara).toMatchObject({ athleteId: ana.uid, sessionId: one.id, authorId: cara.uid, authorName: "Cara Coach", authorRole: "coach", kind: "comment", text: "Smoother exhale." });
        const kudos = await cara.backend.data.addComment(ana.uid, one.id, { kind: "kudos", text: "ignored" });
        expect(kudos).toMatchObject({ kind: "kudos", text: "", authorId: cara.uid });
        const reply = await ana.backend.data.addComment(ana.uid, one.id, { kind: "comment", text: "Thanks!" });
        expect(reply).toMatchObject({ authorId: ana.uid, authorName: "Ana Athlete", authorRole: "athlete" });
        const elsewhere = await ana.backend.data.addComment(ana.uid, two.id, { kind: "comment", text: "Tired today." });

        for (const reader of [ana, cara]) {
          expect((await reader.backend.data.listComments(ana.uid, one.id)).map((c) => c.id)).toEqual([fromCara.id, kudos.id, reply.id]);
          expect((await reader.backend.data.listComments(ana.uid)).map((c) => c.id)).toEqual([fromCara.id, kudos.id, reply.id, elsewhere.id]);
        }
      });

      it("counts a second kudos from the same person once", async () => {
        const saved = await saveAnaSession();
        await linkAnaToCara();
        const first = await cara.backend.data.addComment(ana.uid, saved.id, { kind: "kudos", text: "" });
        const again = await cara.backend.data.addComment(ana.uid, saved.id, { kind: "kudos", text: "" });
        expect(again.id).toBe(first.id);
        const own = await ana.backend.data.addComment(ana.uid, saved.id, { kind: "kudos", text: "" });
        expect(own.id).not.toBe(first.id);
        expect((await ana.backend.data.listComments(ana.uid, saved.id)).map((c) => c.id)).toEqual([first.id, own.id]);
      });

      it("refuses an empty comment and a session that isn't there", async () => {
        const saved = await saveAnaSession();
        await refusal(ana.backend.data.addComment(ana.uid, saved.id, { kind: "comment", text: "   " }), "invalid-input");
        await refusal(ana.backend.data.addComment(ana.uid, "no-such-session", { kind: "comment", text: "hi" }), "not-found");
        expect(await ana.backend.data.listComments(ana.uid)).toEqual([]);
      });

      it("refuses a stranger and a revoked coach both reading and writing", async () => {
        const saved = await saveAnaSession();
        const stranger = await h.person();
        await refusal(stranger.backend.data.listComments(ana.uid), "permission-denied");
        await refusal(stranger.backend.data.addComment(ana.uid, saved.id, { kind: "kudos", text: "" }), "permission-denied");
        await linkAnaToCara();
        await ana.backend.data.revokeCoach(ana.uid, cara.uid);
        await refusal(cara.backend.data.listComments(ana.uid, saved.id), "permission-denied");
        await refusal(cara.backend.data.addComment(ana.uid, saved.id, { kind: "comment", text: "hi" }), "permission-denied");
        await refusal(h.signedOut().data.listComments(ana.uid), "not-signed-in");
      });

      it("lets only the author delete a comment or a kudos", async () => {
        const saved = await saveAnaSession();
        await linkAnaToCara();
        const comment = await cara.backend.data.addComment(ana.uid, saved.id, { kind: "comment", text: "Good." });
        const kudos = await ana.backend.data.addComment(ana.uid, saved.id, { kind: "kudos", text: "" });
        await refusal(ana.backend.data.deleteComment(ana.uid, saved.id, comment.id), "permission-denied");
        await refusal(cara.backend.data.deleteComment(ana.uid, saved.id, kudos.id), "permission-denied");
        await refusal(cara.backend.data.deleteComment(ana.uid, saved.id, "no-such-comment"), "not-found");

        await cara.backend.data.deleteComment(ana.uid, saved.id, comment.id);
        await ana.backend.data.deleteComment(ana.uid, saved.id, kudos.id);
        expect(await ana.backend.data.listComments(ana.uid)).toEqual([]);
      });

      it("goes with the session when the athlete deletes it", async () => {
        const saved = await saveAnaSession();
        await linkAnaToCara();
        await cara.backend.data.addComment(ana.uid, saved.id, { kind: "comment", text: "Nice." });
        await cara.backend.data.markSessionSeen(cara.uid, ana.uid, saved.id);
        await ana.backend.data.deleteSession(ana.uid, saved.id);
        expect(await ana.backend.data.listComments(ana.uid)).toEqual([]);
        expect(await cara.backend.data.listSeenSessions(cara.uid)).toEqual([]);
      });
    });
  });
}
