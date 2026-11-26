import { beforeEach, describe, expect, it } from "vitest";
import { currentConsents } from "@/lib/domain/consent";
import { withProDefaults } from "@/lib/domain/pro-defaults";
import { defaultProProfile } from "@/lib/domain/pro-profile";
import { proConsents } from "@/lib/domain/pro-terms";
import type { ProProfile } from "@/lib/domain/types";
import { BackendError, type Backend } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";
import { DEMO_COACH, DEMO_PASSWORD } from "./seed";

// T-0123: the invite lookup says who's asking in their own terms (kind,
// profession) and what they ask to see; an invite can carry a first practice
// (one of the kind's templates), which accepting turns into an assignment.

const NOW = new Date("2026-11-26T12:00:00.000Z");
let backend: Backend;
let clinicianId: string;

const clinician: ProProfile = withProDefaults({
  ...defaultProProfile("clinician"),
  profession: "physiotherapist",
  country: "Ireland",
  useCases: ["between-visits"],
});

async function signUp(email: string, displayName: string, role: "athlete" | "coach") {
  const user = await backend.auth.signUp({ email, password: "long-enough", displayName, role, consents: currentConsents(), birthYear: 1990 });
  return user.uid;
}

const refused = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(BackendError);
  await expect(promise).rejects.toMatchObject({ code });
};

beforeEach(async () => {
  backend = createLocalBackend({ store: memoryStore(createSeededDb(NOW)), latencyMs: 0, now: () => NOW });
  clinicianId = await signUp("aoife@example.com", "Aoife Byrne", "coach");
  await backend.data.updateProfile(clinicianId, { proKind: "clinician", proProfile: clinician, proConsents: proConsents("clinician") });
});

describe("an invite with a first practice", () => {
  it("stores one of the kind's templates, and refuses another kind's or a group session", async () => {
    const invite = await backend.data.createCoachInvite(clinicianId, { athleteName: "Jordan Lee", contact: "jordan@example.com", practice: "between-visits" });
    expect(invite.practice).toBe("between-visits");
    await refused(backend.data.createCoachInvite(clinicianId, { athleteName: "Sam", contact: "sam@example.com", practice: "focus-sprint" }), "invalid-input");
    await refused(backend.data.createCoachInvite(clinicianId, { athleteName: "Sam", contact: "sam@example.com", practice: "nope" as never }), "invalid-input");
    expect(await backend.data.listCoachInvites(clinicianId)).toHaveLength(1);
  });

  it("without practice stores none, as before", async () => {
    const invite = await backend.data.createCoachInvite(clinicianId, { athleteName: "Jordan Lee", contact: "jordan@example.com" });
    expect(invite).not.toHaveProperty("practice");
  });
});

describe("the invite lookup and accepting", () => {
  it("says who's asking in their own terms, what they ask for and the practice; accepting creates the assignment", async () => {
    const { code } = await backend.data.createCoachInvite(clinicianId, { athleteName: "Jordan Lee", contact: "jordan@example.com", practice: "between-visits" });
    await backend.auth.signOut();
    const jordan = await signUp("jordan@example.com", "Jordan Lee", "athlete");

    const lookup = await backend.data.getCoachInvite(code);
    expect(lookup).toEqual({
      code,
      coachId: clinicianId,
      coachName: "Aoife Byrne",
      expiresAt: expect.any(String),
      status: "pending",
      practice: "between-visits",
      coachKind: "clinician",
      coachProfession: "physiotherapist",
      scopeRequested: "curves",
    });
    expect(lookup).not.toHaveProperty("contact");

    await backend.data.respondToCoachInvite(jordan, code, { accept: true, scope: "scores" });
    expect(await backend.data.listAssignments(jordan)).toEqual([
      {
        id: expect.any(String),
        coachId: clinicianId,
        athleteId: jordan,
        createdAt: NOW.toISOString(),
        mode: "paced",
        pacerHalfCycleSec: 5,
        durationSec: 300,
        target: 14,
        dueAt: "2026-12-10T12:00:00.000Z",
        note: "Between visits",
        cancelled: false,
      },
    ]);
    expect(await backend.data.getCoachLink(clinicianId, jordan)).toMatchObject({ scope: "scores" });
  });

  it("accepting an invite without practice, or declining one with it, creates no assignment", async () => {
    const plain = await backend.data.createCoachInvite(clinicianId, { athleteName: "Jordan Lee", contact: "jordan@example.com" });
    const withPractice = await backend.data.createCoachInvite(clinicianId, { athleteName: "Sam", contact: "sam@example.com", practice: "weekly-open-check" });
    await backend.auth.signOut();
    const jordan = await signUp("jordan@example.com", "Jordan Lee", "athlete");
    await backend.data.respondToCoachInvite(jordan, plain.code, { accept: true, scope: "curves" });
    await backend.data.respondToCoachInvite(jordan, withPractice.code, { accept: false });
    expect(await backend.data.listAssignments(jordan)).toEqual([]);
  });

  it("an older coach account with no kind: no kind, profession or scope in the lookup", async () => {
    await backend.auth.signOut();
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    const { code } = await backend.data.createCoachInvite(DEMO_COACH.uid, { athleteName: "Jordan Lee", contact: "jordan@example.com" });
    // No kind, so no templates to set practice from.
    await refused(backend.data.createCoachInvite(DEMO_COACH.uid, { athleteName: "Sam", contact: "sam@example.com", practice: "between-visits" }), "invalid-input");
    expect(await backend.data.getCoachInvite(code)).toMatchObject({ coachKind: null, coachProfession: null, scopeRequested: null, practice: null });
  });
});
