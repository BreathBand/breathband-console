import { beforeEach, describe, expect, it } from "vitest";
import { currentConsents } from "@/lib/domain/consent";
import { withProDefaults } from "@/lib/domain/pro-defaults";
import { defaultProProfile } from "@/lib/domain/pro-profile";
import type { ProProfile } from "@/lib/domain/types";
import type { Backend } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";

// T-0129: the invite page before sign-up. Anyone, signed in or not, sees who
// is asking (name, kind, profession), what they ask to see and the practice;
// only for a pending, unexpired invite, and nothing else: no ids, code, dates,
// contact or athleteId. Every other code answers null.

const START = new Date("2026-11-26T12:00:00.000Z");
let now: Date;
let backend: Backend;
let clinicianId: string;

const educator: ProProfile = withProDefaults({ ...defaultProProfile("educator"), profession: "counsellor", useCases: ["exam-stress"] });

async function signUp(email: string, displayName: string, role: "athlete" | "coach") {
  const user = await backend.auth.signUp({ email, password: "long-enough", displayName, role, consents: currentConsents(), birthYear: 1990 });
  return user.uid;
}

beforeEach(async () => {
  now = START;
  backend = createLocalBackend({ store: memoryStore(createSeededDb(START)), latencyMs: 0, now: () => now });
  clinicianId = await signUp("mia@example.com", "Mia Walsh", "coach");
  await backend.data.updateProfile(clinicianId, { proKind: "educator", proProfile: educator });
});

const invite = (practice?: "exam-week") =>
  backend.data.createCoachInvite(clinicianId, { athleteName: "Jordan Lee", contact: "jordan@example.com", ...(practice ? { practice } : {}) });

describe("getPublicCoachInvite", () => {
  it("shows a signed-out visitor the minimum for a pending invite, whatever the code's case and spaces", async () => {
    const { code } = await invite("exam-week");
    await backend.auth.signOut();
    const seen = await backend.data.getPublicCoachInvite(` ${code.toLowerCase()} `);
    expect(seen).toEqual({
      coachName: "Mia Walsh",
      coachKind: "educator",
      coachProfession: "counsellor",
      scopeRequested: educator.scopeRequested,
      practice: "exam-week",
    });
    expect(Object.keys(seen!).sort()).toEqual(["coachKind", "coachName", "coachProfession", "practice", "scopeRequested"]);
  });

  it("answers null for an unknown code, and once the invite is expired, revoked, declined or accepted", async () => {
    const [revoked, declined, accepted, expiring] = [await invite(), await invite(), await invite(), await invite()];
    await backend.data.revokeCoachInvite(clinicianId, revoked.code);
    await backend.auth.signOut();
    const jordan = await signUp("jordan@example.com", "Jordan Lee", "athlete");
    await backend.data.respondToCoachInvite(jordan, declined.code, { accept: false });
    await backend.data.respondToCoachInvite(jordan, accepted.code, { accept: true, scope: "scores" });
    await backend.auth.signOut();

    expect(await backend.data.getPublicCoachInvite(expiring.code)).not.toBeNull();
    for (const code of ["ZZZZ2222", "", revoked.code, declined.code, accepted.code]) {
      expect(await backend.data.getPublicCoachInvite(code)).toBeNull();
    }
    now = new Date(expiring.expiresAt);
    expect(await backend.data.getPublicCoachInvite(expiring.code)).toBeNull();
  });

  it("says nothing more about a revoked invite than about a code that never existed", async () => {
    const { code } = await invite();
    await backend.data.revokeCoachInvite(clinicianId, code);
    expect(await backend.data.getPublicCoachInvite(code)).toEqual(await backend.data.getPublicCoachInvite("ZZZZ2222"));
  });
});
