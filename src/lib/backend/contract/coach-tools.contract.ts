import { beforeEach, describe, expect, it } from "vitest";
import { withProDefaults } from "@/lib/domain/pro-defaults";
import { defaultProProfile } from "@/lib/domain/pro-profile";
import { DEFAULT_ALERTS, type AlertRules, type ProProfile } from "@/lib/domain/types";
import type { DataContractHarness, Person } from "./data.harness";
import { refusal } from "./data.harness";

// The sections of the shared adapter suite for a coach's own tools: squads,
// "Needs a look" alert rules, and invites a coach sends athletes (accepted or
// declined by the athlete), with their permission cases. Run by
// contract/data.local.test.ts and http/data.http.test.ts.

const CODE = /^[A-HJ-NP-Z2-9]{8}$/;

const days = (iso: string) => (Date.parse(iso) - Date.now()) / 86_400_000;

/** A physiotherapist (T-0123): a clinician's kind, a profession, and the kind's defaults (scores and curves asked for). */
const physio: ProProfile = withProDefaults({
  ...defaultProProfile("clinician"),
  profession: "physiotherapist",
  country: "Ireland",
  useCases: ["between-visits"],
});

export function describeCoachToolsContract(adapter: string, setup: () => DataContractHarness | Promise<DataContractHarness>) {
  describe(`DataService contract, coach tools: ${adapter}`, () => {
    let h: DataContractHarness;
    let ana: Person;
    let ben: Person;
    let cara: Person;

    beforeEach(async () => {
      h = await setup();
      [ana, ben, cara] = await Promise.all([h.person(), h.person(), h.person("coach")]);
    });

    describe("squads", () => {
      beforeEach(async () => {
        await h.link(cara.uid, ana.uid, "curves");
        await h.link(cara.uid, ben.uid, "scores");
      });

      it("keeps a coach's squads of linked athletes, listed by name, and replaces one whole", async () => {
        const sprint = await cara.backend.data.saveSquad(cara.uid, { name: "  Sprint  ", athleteIds: [ana.uid, ana.uid, ben.uid] });
        expect(sprint).toMatchObject({ name: "Sprint", athleteIds: [ana.uid, ben.uid] });
        expect(sprint.id).toBeTruthy();
        expect(Date.parse(sprint.createdAt)).not.toBeNaN();
        await cara.backend.data.saveSquad(cara.uid, { name: "Juniors", athleteIds: [] });
        expect((await cara.backend.data.listSquads(cara.uid)).map((s) => s.name)).toEqual(["Juniors", "Sprint"]);

        const renamed = await cara.backend.data.saveSquad(cara.uid, { id: sprint.id, name: "Sprinters", athleteIds: [ben.uid] });
        expect(renamed).toEqual({ ...sprint, name: "Sprinters", athleteIds: [ben.uid] });
        expect((await cara.backend.data.listSquads(cara.uid)).find((s) => s.id === sprint.id)).toEqual(renamed);

        await cara.backend.data.deleteSquad(cara.uid, sprint.id);
        expect((await cara.backend.data.listSquads(cara.uid)).map((s) => s.name)).toEqual(["Juniors"]);
      });

      it("refuses an athlete not linked to the coach, a blank name, and an id that isn't theirs", async () => {
        const stranger = await h.person();
        await refusal(cara.backend.data.saveSquad(cara.uid, { name: "Mixed", athleteIds: [ana.uid, stranger.uid] }), "permission-denied");
        await h.link(cara.uid, ben.uid, null);
        await refusal(cara.backend.data.saveSquad(cara.uid, { name: "Revoked", athleteIds: [ben.uid] }), "permission-denied");
        await refusal(cara.backend.data.saveSquad(cara.uid, { name: "   ", athleteIds: [ana.uid] }), "invalid-input");
        await refusal(cara.backend.data.saveSquad(cara.uid, { id: "no-such-squad", name: "Ghost", athleteIds: [] }), "not-found");
        expect(await cara.backend.data.listSquads(cara.uid)).toEqual([]);
      });

      it("keeps squads to their coach: nobody else lists, saves or deletes them", async () => {
        const squad = await cara.backend.data.saveSquad(cara.uid, { name: "Mine", athleteIds: [ana.uid] });
        const other = await h.person("coach");
        await refusal(ana.backend.data.listSquads(cara.uid), "permission-denied");
        await refusal(other.backend.data.listSquads(cara.uid), "permission-denied");
        await refusal(other.backend.data.saveSquad(cara.uid, { id: squad.id, name: "Taken", athleteIds: [] }), "permission-denied");
        await refusal(other.backend.data.deleteSquad(cara.uid, squad.id), "permission-denied");
        expect(await other.backend.data.listSquads(other.uid)).toEqual([]);
        await refusal(h.signedOut().data.listSquads(cara.uid), "not-signed-in");
        expect(await cara.backend.data.listSquads(cara.uid)).toEqual([squad]);
      });
    });

    describe("alert rules", () => {
      it("answers null until the coach saves their own, per coach", async () => {
        expect(await cara.backend.data.getAlertRules(cara.uid)).toBeNull();
        const rules: AlertRules = { ...DEFAULT_ALERTS, missedDays: 5, scoreDrop: 1.5, trendingDown: false };
        await cara.backend.data.saveAlertRules(cara.uid, rules);
        expect(await cara.backend.data.getAlertRules(cara.uid)).toEqual(rules);

        const off: AlertRules = { missedDays: null, scoreDrop: null, belowTarget: null, trendingDown: false, rateOutOfRange: false, practiceBehind: false };
        await cara.backend.data.saveAlertRules(cara.uid, off);
        expect(await cara.backend.data.getAlertRules(cara.uid)).toEqual(off);

        const other = await h.person("coach");
        expect(await other.backend.data.getAlertRules(other.uid)).toBeNull();
      });

      it("keeps saved rules that equal the coach's full set, for a professional of any kind (never read back as unsaved)", async () => {
        await cara.backend.data.updateProfile(cara.uid, { proKind: "clinician", proProfile: physio });
        await cara.backend.data.saveAlertRules(cara.uid, DEFAULT_ALERTS);
        expect(await cara.backend.data.getAlertRules(cara.uid)).toEqual(DEFAULT_ALERTS);
      });

      it("keeps a professional's saved rules when their profile changes", async () => {
        const rules: AlertRules = { ...DEFAULT_ALERTS, scoreDrop: null, missedDays: 4 };
        await cara.backend.data.saveAlertRules(cara.uid, rules);
        await cara.backend.data.updateProfile(cara.uid, { proKind: "clinician", proProfile: physio });
        expect(await cara.backend.data.getAlertRules(cara.uid)).toEqual(rules);
      });

      it.each<[string, Partial<AlertRules>]>([
        ["a score drop of 0", { scoreDrop: 0 }],
        ["more than 60 missed days", { missedDays: 61 }],
        ["more than 5 sessions below target", { belowTarget: 6 }],
        ["a negative number", { missedDays: -1 }],
      ])("refuses %s and keeps the rules", async (_, change) => {
        const rules = { ...DEFAULT_ALERTS, missedDays: 7 };
        await cara.backend.data.saveAlertRules(cara.uid, rules);
        await refusal(cara.backend.data.saveAlertRules(cara.uid, { ...rules, ...change }), "invalid-input");
        expect(await cara.backend.data.getAlertRules(cara.uid)).toEqual(rules);
      });

      it("keeps a coach's rules from everyone else, the athlete included", async () => {
        await h.link(cara.uid, ana.uid, "curves");
        await refusal(ana.backend.data.getAlertRules(cara.uid), "permission-denied");
        await refusal(ana.backend.data.saveAlertRules(cara.uid, DEFAULT_ALERTS), "permission-denied");
        await refusal(h.signedOut().data.getAlertRules(cara.uid), "not-signed-in");
      });
    });

    describe("a coach's invites to athletes", () => {
      const invite = (coach: Person = cara, contact = "jo@example.com", athleteName = "Jo") =>
        coach.backend.data.createCoachInvite(coach.uid, { athleteName, contact });

      it("makes a link for 14 days, listed for the coach newest first with who it was for", async () => {
        const first = await invite(cara, "  jo@example.com  ", "  Jo  ");
        expect(first).toMatchObject({ coachId: cara.uid, coachName: "Cara Coach", athleteName: "Jo", contact: "jo@example.com", status: "pending", athleteId: null });
        expect(first.code).toMatch(CODE);
        expect(days(first.expiresAt)).toBeGreaterThan(13.9);
        expect(days(first.expiresAt)).toBeLessThanOrEqual(14);
        const second = await invite(cara, "+1 555 0100", "Kim");
        expect(second.code).not.toBe(first.code);
        expect(await cara.backend.data.listCoachInvites(cara.uid)).toEqual([second, first]);
      });

      it.each([
        ["a blank name", "   ", "jo@example.com"],
        ["a contact that is neither an email address nor a phone number", "Jo", "nope"],
      ])("refuses %s", async (_, name, contact) => {
        await refusal(invite(cara, contact, name), "invalid-input");
        expect(await cara.backend.data.listCoachInvites(cara.uid)).toEqual([]);
      });

      it("lets only a professional invite, in their own name, and only them list their invites", async () => {
        await refusal(invite(ana), "permission-denied");
        await refusal(ana.backend.data.createCoachInvite(cara.uid, { athleteName: "Jo", contact: "jo@example.com" }), "permission-denied");
        await invite();
        await refusal(ana.backend.data.listCoachInvites(cara.uid), "permission-denied");
        await refusal(h.signedOut().data.listCoachInvites(cara.uid), "not-signed-in");
      });

      it("shows whoever opens the link who is asking, without the contact details", async () => {
        const sent = await invite();
        const seen = await ana.backend.data.getCoachInvite(` ${sent.code.toLowerCase()} `);
        // A coach with no kind yet: nothing about them beyond their name, and no practice (T-0123).
        expect(seen).toEqual({
          code: sent.code,
          coachId: cara.uid,
          coachName: "Cara Coach",
          expiresAt: sent.expiresAt,
          status: "pending",
          practice: null,
          coachKind: null,
          coachProfession: null,
          scopeRequested: null,
        });
        expect(await ana.backend.data.getCoachInvite("ZZZZ2222")).toBeNull();
        await refusal(h.signedOut().data.getCoachInvite(sent.code), "not-signed-in");
      });

      describe("before sign-up (T-0129)", () => {
        it("shows anyone, signed out too, only who is asking and what they ask, for a pending invite", async () => {
          const sent = await invite();
          const minimum = { coachName: "Cara Coach", coachKind: null, coachProfession: null, scopeRequested: null, practice: null };
          expect(await h.signedOut().data.getPublicCoachInvite(` ${sent.code.toLowerCase()} `)).toEqual(minimum);
          expect(await ana.backend.data.getPublicCoachInvite(sent.code)).toEqual(minimum);
        });

        it("answers null alike for an unknown code and for revoked, declined and accepted invites", async () => {
          const [revoked, declined, accepted] = [await invite(), await invite(), await invite()];
          await cara.backend.data.revokeCoachInvite(cara.uid, revoked.code);
          await ana.backend.data.respondToCoachInvite(ana.uid, declined.code, { accept: false });
          await ben.backend.data.respondToCoachInvite(ben.uid, accepted.code, { accept: true, scope: "curves" });
          const out = h.signedOut().data;
          for (const code of ["ZZZZ2222", revoked.code, declined.code, accepted.code]) {
            expect(await out.getPublicCoachInvite(code)).toBeNull();
          }
        });
      });

      it("links an athlete who accepts, with the scope they choose, once", async () => {
        const sent = await invite();
        const link = await ana.backend.data.respondToCoachInvite(ana.uid, sent.code, { accept: true, scope: "scores" });
        expect(link).toMatchObject({ coachId: cara.uid, athleteId: ana.uid, scope: "scores" });
        expect(await cara.backend.data.getCoachLink(cara.uid, ana.uid)).toMatchObject({ scope: "scores" });
        expect((await cara.backend.data.listAthletes(cara.uid)).map((a) => a.uid)).toEqual([ana.uid]);
        expect((await cara.backend.data.listCoachInvites(cara.uid))[0]).toMatchObject({ status: "accepted", athleteId: ana.uid });

        await refusal(ben.backend.data.respondToCoachInvite(ben.uid, sent.code, { accept: true, scope: "curves" }), "invite-invalid");
        await refusal(ana.backend.data.respondToCoachInvite(ana.uid, sent.code, { accept: false }), "invite-invalid");
        expect(await cara.backend.data.getCoachLink(cara.uid, ben.uid)).toBeNull();
      });

      it("sets the scope just chosen on a link that already exists", async () => {
        await h.link(cara.uid, ana.uid, "curves");
        const sent = await invite();
        expect(await ana.backend.data.respondToCoachInvite(ana.uid, sent.code, { accept: true, scope: "scores" })).toMatchObject({ scope: "scores" });
        expect(await cara.backend.data.getCoachLink(cara.uid, ana.uid)).toMatchObject({ scope: "scores" });
      });

      it("records a decline, makes no link, and can't be answered again", async () => {
        const sent = await invite();
        expect(await ana.backend.data.respondToCoachInvite(ana.uid, sent.code, { accept: false })).toBeNull();
        expect(await cara.backend.data.getCoachLink(cara.uid, ana.uid)).toBeNull();
        expect(await ana.backend.data.getCoachInvite(sent.code)).toMatchObject({ status: "declined" });
        await refusal(ana.backend.data.respondToCoachInvite(ana.uid, sent.code, { accept: true, scope: "curves" }), "invite-invalid");
      });

      it("lets the coach revoke a pending invite, which then can't be accepted", async () => {
        const sent = await invite();
        const other = await h.person("coach");
        await refusal(other.backend.data.revokeCoachInvite(cara.uid, sent.code), "permission-denied");
        await other.backend.data.revokeCoachInvite(other.uid, sent.code); // not theirs: nothing changes
        expect(await ana.backend.data.getCoachInvite(sent.code)).toMatchObject({ status: "pending" });

        await cara.backend.data.revokeCoachInvite(cara.uid, sent.code);
        expect((await cara.backend.data.listCoachInvites(cara.uid))[0]).toMatchObject({ status: "revoked" });
        await refusal(ana.backend.data.respondToCoachInvite(ana.uid, sent.code, { accept: true, scope: "curves" }), "invite-invalid");
        expect(await cara.backend.data.getCoachLink(cara.uid, ana.uid)).toBeNull();
      });

      it("leaves an answered invite as it is when revoked afterwards", async () => {
        const sent = await invite();
        await ana.backend.data.respondToCoachInvite(ana.uid, sent.code, { accept: true, scope: "curves" });
        await cara.backend.data.revokeCoachInvite(cara.uid, sent.code);
        expect((await cara.backend.data.listCoachInvites(cara.uid))[0]).toMatchObject({ status: "accepted" });
        expect(await cara.backend.data.getCoachLink(cara.uid, ana.uid)).not.toBeNull();
      });

      it("lets only an athlete answer, for themselves", async () => {
        const sent = await invite();
        const other = await h.person("coach");
        await refusal(other.backend.data.respondToCoachInvite(other.uid, sent.code, { accept: true, scope: "curves" }), "permission-denied");
        await refusal(ben.backend.data.respondToCoachInvite(ana.uid, sent.code, { accept: true, scope: "curves" }), "permission-denied");
        await refusal(h.signedOut().data.respondToCoachInvite(ana.uid, sent.code, { accept: false }), "not-signed-in");
        expect(await ana.backend.data.getCoachInvite(sent.code)).toMatchObject({ status: "pending" });
      });

      describe("with a first practice (T-0123)", () => {
        beforeEach(async () => {
          await cara.backend.data.updateProfile(cara.uid, { proKind: "clinician", proProfile: physio });
        });

        it("keeps one of the professional's kind's templates with the invite, and refuses any other practice", async () => {
          const sent = await cara.backend.data.createCoachInvite(cara.uid, { athleteName: "Jo", contact: "jo@example.com", practice: "between-visits" });
          expect(sent.practice).toBe("between-visits");
          expect(await cara.backend.data.listCoachInvites(cara.uid)).toEqual([sent]);
          const plain = await invite();
          expect(plain).not.toHaveProperty("practice");
          for (const practice of ["focus-sprint", "nope"]) {
            await refusal(cara.backend.data.createCoachInvite(cara.uid, { athleteName: "Jo", contact: "jo@example.com", practice: practice as never }), "invalid-input");
          }
          expect(await cara.backend.data.listCoachInvites(cara.uid)).toHaveLength(2);
        });

        it("refuses practice from a coach with no kind", async () => {
          const other = await h.person("coach");
          await refusal(other.backend.data.createCoachInvite(other.uid, { athleteName: "Jo", contact: "jo@example.com", practice: "between-visits" }), "invalid-input");
        });

        it("shows who's asking in their own terms, what they ask to see and the practice", async () => {
          const sent = await cara.backend.data.createCoachInvite(cara.uid, { athleteName: "Jo", contact: "jo@example.com", practice: "between-visits" });
          expect(await ana.backend.data.getCoachInvite(sent.code)).toEqual({
            code: sent.code,
            coachId: cara.uid,
            coachName: "Cara Coach",
            expiresAt: sent.expiresAt,
            status: "pending",
            practice: "between-visits",
            coachKind: "clinician",
            coachProfession: "physiotherapist",
            scopeRequested: physio.scopeRequested,
          });
        });

        it("shows a signed-out visitor the professional in their own terms, the scope asked for and the practice (T-0129)", async () => {
          const sent = await cara.backend.data.createCoachInvite(cara.uid, { athleteName: "Jo", contact: "jo@example.com", practice: "between-visits" });
          expect(await h.signedOut().data.getPublicCoachInvite(sent.code)).toEqual({
            coachName: "Cara Coach",
            coachKind: "clinician",
            coachProfession: "physiotherapist",
            scopeRequested: physio.scopeRequested,
            practice: "between-visits",
          });
        });

        it("makes the practice the athlete's assignment when they accept, and nothing when they decline", async () => {
          const sent = await cara.backend.data.createCoachInvite(cara.uid, { athleteName: "Ana", contact: "ana@example.com", practice: "between-visits" });
          await ana.backend.data.respondToCoachInvite(ana.uid, sent.code, { accept: true, scope: "scores" });
          const [assignment, ...more] = await ana.backend.data.listAssignments(ana.uid);
          expect(more).toEqual([]);
          expect(assignment).toMatchObject({
            coachId: cara.uid,
            athleteId: ana.uid,
            mode: "paced",
            pacerHalfCycleSec: 5,
            durationSec: 300,
            target: 14,
            note: "Between visits",
            cancelled: false,
          });
          expect(days(assignment.dueAt)).toBeGreaterThan(13.9);
          expect(days(assignment.dueAt)).toBeLessThanOrEqual(14);
          expect(await cara.backend.data.listAssignments(ana.uid)).toEqual([assignment]);

          const declined = await cara.backend.data.createCoachInvite(cara.uid, { athleteName: "Ben", contact: "ben@example.com", practice: "between-visits" });
          await ben.backend.data.respondToCoachInvite(ben.uid, declined.code, { accept: false });
          expect(await ben.backend.data.listAssignments(ben.uid)).toEqual([]);
        });
      });

      it("refuses a code that doesn't exist", async () => {
        await refusal(ana.backend.data.respondToCoachInvite(ana.uid, "ZZZZ2222", { accept: true, scope: "curves" }), "invite-invalid");
      });
    });
  });
}
