import { beforeEach, describe, expect, it } from "vitest";
import { ageGateProblem, consentsProblem, PRO_CONSENT_KINDS } from "@/lib/domain/consent";
import { goalPlanProblem } from "@/lib/domain/goal-questions";
import { earnedMilestones, gamificationProblem, mechanicsOf, newMilestones, streakOf } from "@/lib/domain/habit";
import { onboardingProblem } from "@/lib/domain/onboarding";
import { preferencesProblem } from "@/lib/domain/preferences";
import { proProblem } from "@/lib/domain/pro-profile";
import { templatesFor } from "@/lib/domain/pro-templates";
import { proTermsProblem } from "@/lib/domain/pro-terms";
import { programProgress } from "@/lib/domain/programs";
import type { Backend } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";
import {
  DEMO_CALM,
  DEMO_CLASS,
  DEMO_CLIENT,
  DEMO_CLIENTS,
  DEMO_CLINICIAN,
  DEMO_COACH,
  DEMO_EDUCATOR,
  DEMO_FOCUS,
  DEMO_PASSWORD,
  DEMO_PEOPLE,
  nextExamDay,
} from "./seed";

// The demo plan's people (planning/v1/05, "The people in the demo"; T-0127): one
// seeded person per track, each signing in with the demo password and reading
// their data through the local adapter, as the screens do.

const NOW = new Date("2026-11-26T12:00:00.000Z");
const DAY = 86_400_000;

let backend: Backend;

beforeEach(() => {
  backend = createLocalBackend({ store: memoryStore(createSeededDb(NOW)), latencyMs: 0, now: () => NOW });
});

async function signInAs(email: string) {
  await backend.auth.signIn(email, DEMO_PASSWORD);
}

const profileOf = async (uid: string) => (await backend.data.getProfile(uid))!;

describe("every demo person", () => {
  it("has a unique uid and email and signs in with the demo password", async () => {
    const db = createSeededDb(NOW);
    const people = Object.values(db.accounts).map((a) => a.profile);
    expect(people.map((p) => p.uid).sort()).toEqual(DEMO_PEOPLE.map((p) => p.uid).sort());
    expect(new Set(people.map((p) => p.email.toLowerCase())).size).toBe(people.length);
    for (const p of [DEMO_CALM, DEMO_CLINICIAN, DEMO_CLIENT, DEMO_EDUCATOR, DEMO_FOCUS]) {
      await signInAs(p.email);
      expect(backend.auth.currentUser()?.uid, p.displayName).toBe(p.uid);
      await backend.auth.signOut();
    }
  });

  it("has preferences, consents, age and professional details the validators accept", () => {
    for (const { profile } of Object.values(createSeededDb(NOW).accounts)) {
      const p = profile.preferences;
      if (p) {
        const problem = preferencesProblem(p) ?? goalPlanProblem(p) ?? onboardingProblem(p.onboarding) ?? gamificationProblem(p.gamification);
        expect(problem, profile.displayName).toBeNull();
      }
      if (profile.birthYear !== undefined) expect(ageGateProblem(profile.birthYear, NOW), profile.displayName).toBeNull();
      if (profile.consents) expect(consentsProblem(profile.consents), profile.displayName).toBeNull();
      if (profile.proKind) {
        expect(proProblem(profile.proKind, profile.proProfile), profile.displayName).toBeNull();
        const pro = (profile.consents ?? []).filter((c) => (PRO_CONSENT_KINDS as string[]).includes(c.kind));
        expect(proTermsProblem(profile.proKind, pro), profile.displayName).toBeNull();
      }
    }
  });
});

describe("Maya (Calm)", () => {
  it("has ten days in a row, the ring and streak on, one milestone waiting and Foundations under way", async () => {
    await signInAs(DEMO_CALM.email);
    const maya = await profileOf(DEMO_CALM.uid);
    expect(maya).toMatchObject({ displayName: "Maya Brooks", email: "maya@demo.local", role: "athlete" });
    expect(maya.preferences?.goal).toBe("calm");
    expect(mechanicsOf(maya.preferences)).toEqual({ ring: true, streak: true, milestones: true });

    const sessions = await backend.data.listSessions(DEMO_CALM.uid);
    expect(sessions).toHaveLength(10);
    expect(Date.parse(sessions.at(-1)!.startedAt)).toBeGreaterThan(NOW.getTime() - 11 * DAY);
    expect(streakOf(sessions, NOW)).toMatchObject({ days: 10, state: "active", doneToday: false });

    const g = maya.preferences?.gamification;
    expect(newMilestones(earnedMilestones(sessions, NOW, g), g)).toEqual(["streak-7"]);
    expect(g?.program?.id).toBe("foundations");
    const progress = programProgress(g!.program!, sessions, NOW);
    expect(progress.done).toBe(10);
    expect(progress.next?.day).toBe(11);
  });
});

describe("Sam (Focus)", () => {
  it("is on Focus with an exam on the coming 15 December and mood check-ins", async () => {
    await signInAs(DEMO_FOCUS.email);
    const sam = await profileOf(DEMO_FOCUS.uid);
    expect(sam.preferences?.goal).toBe("focus");
    expect(sam.preferences?.goalDetails?.focus).toMatchObject({ examDates: ["2026-12-15"], moodCheckins: true });
    const moods = await backend.data.listMoodCheckins(DEMO_FOCUS.uid);
    expect(moods.length).toBeGreaterThanOrEqual(8);
    const sessionIds = new Set((await backend.data.listSessions(DEMO_FOCUS.uid)).map((s) => s.id));
    expect(moods.every((m) => m.sessionId !== null && sessionIds.has(m.sessionId))).toBe(true);
    // Still one of Lena's athletes.
    expect((await backend.data.listCoaches(DEMO_FOCUS.uid)).map((c) => c.uid)).toEqual([DEMO_COACH.uid]);
  });

  it("keeps the exam ahead whatever day the seed is made", () => {
    expect(nextExamDay(new Date(2026, 10, 26))).toBe("2026-12-15");
    expect(nextExamDay(new Date(2026, 11, 15))).toBe("2026-12-15");
    expect(nextExamDay(new Date(2026, 11, 16))).toBe("2027-12-15");
  });
});

describe("Ana Ruiz (clinician)", () => {
  it("is a physiotherapist with her pro profile and the professional consents, wellness acknowledgement included", async () => {
    await signInAs(DEMO_CLINICIAN.email);
    const ana = await profileOf(DEMO_CLINICIAN.uid);
    expect(ana).toMatchObject({ role: "coach", proKind: "clinician" });
    expect(ana.proProfile).toMatchObject({ kind: "clinician", profession: "physiotherapist", terminology: "clients", useCases: ["between-visits"] });
    expect(ana.proProfile?.scopeRequested).toBeDefined();
    expect(ana.consents?.map((c) => c.kind)).toEqual(expect.arrayContaining(["professional-terms", "wellness-acknowledgement"]));
  });

  it("has two clients on her between-visits plan", async () => {
    await signInAs(DEMO_CLINICIAN.email);
    const clients = await backend.data.listAthletes(DEMO_CLINICIAN.uid);
    expect(clients.map((c) => c.displayName).sort()).toEqual(DEMO_CLIENTS.map((c) => c.displayName).sort());
    for (const client of DEMO_CLIENTS) {
      const plan = await backend.data.listAssignments(client.uid);
      expect(plan.filter((a) => a.coachId === DEMO_CLINICIAN.uid && !a.cancelled), client.displayName).toHaveLength(1);
    }
  });
});

describe("Jordan Lee (Ana's client)", () => {
  it("came through Ana's accepted invite and shares what she asks for", async () => {
    await signInAs(DEMO_CLINICIAN.email);
    const invites = await backend.data.listCoachInvites(DEMO_CLINICIAN.uid);
    const jordans = invites.filter((i) => i.athleteId === DEMO_CLIENT.uid);
    expect(jordans).toHaveLength(1);
    expect(jordans[0]).toMatchObject({ status: "accepted", athleteName: "Jordan Lee", coachName: "Ana Ruiz" });
    const link = await backend.data.getCoachLink(DEMO_CLINICIAN.uid, DEMO_CLIENT.uid);
    expect(link?.scope).toBe(DEMO_CLINICIAN.proProfile?.scopeRequested);
    // The link follows the invite.
    expect(Date.parse(link!.createdAt)).toBeGreaterThan(Date.parse(jordans[0].createdAt));
  });

  it("follows an assignment from Ana's templates and has three weeks of plan sessions", async () => {
    await signInAs(DEMO_CLIENT.email);
    expect((await backend.data.listCoaches(DEMO_CLIENT.uid)).map((c) => c.uid)).toEqual([DEMO_CLINICIAN.uid]);
    const [assignment] = await backend.data.listAssignments(DEMO_CLIENT.uid);
    const template = templatesFor("clinician").find((t) => t.id === "between-visits")!;
    expect(assignment).toMatchObject({
      coachId: DEMO_CLINICIAN.uid,
      mode: template.mode,
      pacerHalfCycleSec: template.pacerHalfCycleSec,
      durationSec: template.durationSec,
      cancelled: false,
    });
    expect(Date.parse(assignment.dueAt)).toBeGreaterThan(NOW.getTime());

    const sessions = await backend.data.listSessions(DEMO_CLIENT.uid);
    expect(sessions.length).toBeGreaterThanOrEqual(15);
    expect(Date.parse(sessions.at(-1)!.startedAt)).toBeGreaterThan(NOW.getTime() - 22 * DAY);
    expect(sessions.every((s) => s.mode === "paced" && s.pacerHalfCycleSec === 5)).toBe(true);
    // Ana's comment on one of them, and Jordan's reply.
    const thread = await backend.data.listComments(DEMO_CLIENT.uid);
    expect(thread.map((c) => c.authorId)).toEqual(expect.arrayContaining([DEMO_CLINICIAN.uid, DEMO_CLIENT.uid]));
  });
});

describe("Chris Park (educator)", () => {
  it("is a school counsellor with the educator consents and a class of six students, each 16 or over", async () => {
    await signInAs(DEMO_EDUCATOR.email);
    const chris = await profileOf(DEMO_EDUCATOR.uid);
    expect(chris).toMatchObject({ role: "coach", proKind: "educator" });
    expect(chris.proProfile).toMatchObject({ kind: "educator", profession: "counsellor", terminology: "students" });
    expect(chris.consents?.map((c) => c.kind)).toEqual(expect.arrayContaining(["professional-terms", "student-age-acknowledgement"]));

    const students = await backend.data.listAthletes(DEMO_EDUCATOR.uid);
    expect(students).toHaveLength(6);
    expect(students.map((s) => s.uid).sort()).toEqual(DEMO_CLASS.map((s) => s.uid).sort());
    for (const s of DEMO_CLASS) {
      expect(s.birthYear, s.displayName).toBeDefined();
      expect(ageGateProblem(s.birthYear!, NOW), s.displayName).toBeNull();
      expect((await backend.data.listSessions(s.uid)).length, s.displayName).toBeGreaterThan(0);
    }
    const [squad] = await backend.data.listSquads(DEMO_EDUCATOR.uid);
    expect(squad.athleteIds.slice().sort()).toEqual(DEMO_CLASS.map((s) => s.uid).sort());
  });
});
