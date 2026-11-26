import { beforeEach, describe, expect, it } from "vitest";
import { CONSENT_KINDS, CONSENT_VERSIONS } from "@/lib/domain/consent";
import { defaultPreferences } from "@/lib/domain/preferences";
import { defaultProProfile } from "@/lib/domain/pro-profile";
import type { ProProfile, UserPreferences, UserProfile } from "@/lib/domain/types";
import type { DataContractHarness } from "./data.harness";
import { refusal } from "./data.harness";

// The profile and preferences section of the shared adapter suite. Run by
// contract/data.local.test.ts and http/data.http.test.ts.

const preferences: UserPreferences = {
  ...defaultPreferences("train"),
  sessionsPerWeek: 4,
  dailyMinutes: 10,
  onboarding: { bandRoute: "simulated", sampleData: false },
  gamification: { ring: true, streak: false, milestones: true, awarded: { "first-paced": "2026-11-20T08:00:00.000Z" } },
};

const clinician: ProProfile = {
  ...defaultProProfile("clinician"),
  organisation: "Harbour Physio",
  profession: "physiotherapist",
  country: "Ireland",
  useCases: ["between-visits", "stress-anxiety"],
};

export function describeProfileContract(adapter: string, setup: () => DataContractHarness | Promise<DataContractHarness>) {
  describe(`DataService contract, profile and preferences: ${adapter}`, () => {
    let h: DataContractHarness;

    beforeEach(async () => {
      h = await setup();
    });

    describe("getProfile", () => {
      it("returns the signed-in person's own profile with their consents and birth year", async () => {
        const ana = await h.person();
        const profile = await ana.backend.data.getProfile(ana.uid);
        expect(profile).toMatchObject({ uid: ana.uid, email: ana.email, displayName: "Ana Athlete", role: "athlete", birthYear: ana.birthYear });
        expect(Date.parse(profile!.createdAt)).not.toBeNaN();
        expect(profile!.consents?.map((c) => [c.kind, c.version])).toEqual(CONSENT_KINDS.map((k) => [k, CONSENT_VERSIONS[k]]));
        for (const consent of profile!.consents ?? []) expect(Date.parse(consent.acceptedAt)).not.toBeNaN();
      });

      it("needs someone signed in", async () => {
        const ana = await h.person();
        await refusal(h.signedOut().data.getProfile(ana.uid), "not-signed-in");
      });

      it("refuses someone with no link, and lets either side of a link read the other", async () => {
        const [ana, cara, stranger] = await Promise.all([h.person(), h.person("coach"), h.person()]);
        await refusal(stranger.backend.data.getProfile(ana.uid), "permission-denied");
        await refusal(cara.backend.data.getProfile(ana.uid), "permission-denied");

        await h.link(cara.uid, ana.uid, "scores");
        expect(await cara.backend.data.getProfile(ana.uid)).toMatchObject({ uid: ana.uid, displayName: "Ana Athlete", role: "athlete" });
        expect(await ana.backend.data.getProfile(cara.uid)).toMatchObject({ uid: cara.uid, displayName: "Cara Coach", role: "coach" });

        await h.link(cara.uid, ana.uid, null);
        await refusal(cara.backend.data.getProfile(ana.uid), "permission-denied");
      });
    });

    describe("updateProfile", () => {
      it("changes the name, trimmed, and returns the profile as getProfile will", async () => {
        const ana = await h.person();
        const returned = await ana.backend.data.updateProfile(ana.uid, { displayName: "  Ana Renamed " });
        expect(returned).toMatchObject({ uid: ana.uid, displayName: "Ana Renamed" });
        expect(await ana.backend.data.getProfile(ana.uid)).toEqual(returned);
      });

      it("refuses an empty name, and anyone else's profile", async () => {
        const [ana, other] = await Promise.all([h.person(), h.person()]);
        await refusal(ana.backend.data.updateProfile(ana.uid, { displayName: "   " }), "invalid-input");
        await refusal(other.backend.data.updateProfile(ana.uid, { displayName: "Hijacked" }), "permission-denied");
        expect(await ana.backend.data.getProfile(ana.uid)).toMatchObject({ displayName: "Ana Athlete" });
      });

      it("keeps role and email fixed", async () => {
        const ana = await h.person();
        const sneaky = { displayName: "Ana", role: "coach", email: "else@example.test" } as Parameters<typeof ana.backend.data.updateProfile>[1];
        await ana.backend.data.updateProfile(ana.uid, sneaky);
        expect(await ana.backend.data.getProfile(ana.uid)).toMatchObject({ role: "athlete", email: ana.email });
      });

      it.each<[string, Record<string, unknown>]>([
        ["an athlete making themselves a professional", { role: "coach" }],
        ["setting the professional kind", { proKind: "clinician" }],
        ["changing the birth year", { birthYear: 1970 }],
      ])("refuses %s by any other route, so updateProfile's rules can't be skipped", async (_, fields) => {
        const ana = await h.person();
        expect(await h.updateAccount(ana, fields)).toBe("refused");
        const profile = await ana.backend.data.getProfile(ana.uid);
        expect(profile).toMatchObject({ role: "athlete", birthYear: ana.birthYear });
        expect(profile?.proKind).toBeUndefined();
        await refusal(ana.backend.data.updateProfile(ana.uid, { proKind: "clinician", proProfile: clinician }), "permission-denied");
      });

      it("stores preferences, with the onboarding and habit answers, exactly", async () => {
        const ana = await h.person();
        const returned = await ana.backend.data.updateProfile(ana.uid, { preferences });
        expect(returned.preferences).toEqual(preferences);
        expect((await ana.backend.data.getProfile(ana.uid))?.preferences).toEqual(preferences);
      });

      it.each<[string, unknown]>([
        ["an unknown goal", { ...preferences, goal: "sleep" }],
        ["an unknown goal track in goalDetails", { ...preferences, goalDetails: { swim: {} } }],
        ["an unknown band route", { ...preferences, onboarding: { bandRoute: "carrier-pigeon", sampleData: false } }],
        ["an unknown habit switch", { ...preferences, gamification: { confetti: true } }],
      ])("refuses preferences with %s, and keeps the old ones", async (_, bad) => {
        const ana = await h.person();
        await ana.backend.data.updateProfile(ana.uid, { preferences });
        await refusal(ana.backend.data.updateProfile(ana.uid, { preferences: bad as UserPreferences }), "invalid-input");
        expect((await ana.backend.data.getProfile(ana.uid))?.preferences).toEqual(preferences);
      });

      it("refuses the professional fields from an athlete", async () => {
        const ana = await h.person();
        await refusal(ana.backend.data.updateProfile(ana.uid, { proKind: "clinician", proProfile: clinician }), "permission-denied");
        const profile: UserProfile | null = await ana.backend.data.getProfile(ana.uid);
        expect(profile?.proKind).toBeUndefined();
        expect(profile?.proProfile).toBeUndefined();
      });

      it("stores a professional's kind and practice, and refuses a mismatched kind", async () => {
        const cara = await h.person("coach");
        const returned = await cara.backend.data.updateProfile(cara.uid, { proKind: "clinician", proProfile: clinician });
        expect(returned).toMatchObject({ proKind: "clinician", proProfile: clinician });
        expect(await cara.backend.data.getProfile(cara.uid)).toMatchObject({ proKind: "clinician", proProfile: clinician });

        await refusal(cara.backend.data.updateProfile(cara.uid, { proKind: "educator" }), "invalid-input");
        expect(await cara.backend.data.getProfile(cara.uid)).toMatchObject({ proKind: "clinician" });
      });
    });
  });
}
