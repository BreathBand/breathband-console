import { beforeEach, describe, expect, it } from "vitest";
import { BackendError, type Backend } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";
import { DEFAULT_ALERTS } from "@/lib/domain/types";
import { DEMO_ATHLETE, DEMO_COACH, DEMO_PASSWORD, generateWaveform } from "./seed";
import { currentConsents } from "@/lib/domain/consent";

// Sign-up needs the consents and a 16+ birth year since T-0103.
const ADULT = { consents: currentConsents(), birthYear: 1990 };

// These tests pin down the behaviour every adapter must have. When the
// Firebase adapter lands, run the same cases against the emulators.

const NOW = new Date("2026-11-18T12:00:00.000Z");

let backend: Backend;

beforeEach(() => {
  backend = createLocalBackend({
    store: memoryStore(createSeededDb(NOW)),
    latencyMs: 0,
    now: () => NOW,
  });
});

const expectCode = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(BackendError);
  await expect(promise).rejects.toMatchObject({ code });
};

describe("auth", () => {
  it("signs in the demo athlete and notifies listeners", async () => {
    const seen: (string | null)[] = [];
    backend.auth.onAuthStateChanged((u) => seen.push(u?.uid ?? null));
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    expect(seen).toEqual([null, DEMO_ATHLETE.uid]);
    expect(backend.auth.currentUser()?.uid).toBe(DEMO_ATHLETE.uid);
  });

  it("rejects a wrong password", async () => {
    await expectCode(backend.auth.signIn(DEMO_ATHLETE.email, "nope"), "invalid-credentials");
  });

  it("signs up a new athlete with an empty history", async () => {
    const user = await backend.auth.signUp({
      ...ADULT,
      email: "New@Example.com",
      password: "long-enough",
      displayName: "New Person",
      role: "athlete",
    });
    expect(user.email).toBe("new@example.com");
    expect(await backend.data.listSessions(user.uid)).toEqual([]);
  });

  it("refuses duplicate emails and short passwords", async () => {
    const base = { password: "long-enough", displayName: "X", role: "athlete" as const };
    await expectCode(backend.auth.signUp({ ...ADULT, ...base, email: DEMO_COACH.email }), "email-in-use");
    await expectCode(
      backend.auth.signUp({ ...ADULT, ...base, email: "a@b.co", password: "short" }),
      "weak-password",
    );
  });
});

describe("access rules", () => {
  it("requires sign-in", async () => {
    await expectCode(backend.data.listSessions(DEMO_ATHLETE.uid), "not-signed-in");
  });

  it("lets an athlete read their own sessions, newest first", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    const sessions = await backend.data.listSessions(DEMO_ATHLETE.uid);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].startedAt >= sessions[1].startedAt).toBe(true);
  });

  it("lets a linked coach read but not write", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    const [first] = await backend.data.listSessions(DEMO_ATHLETE.uid, { limit: 1 });
    expect(first).toBeDefined();
    await expectCode(
      backend.data.updateSessionNote(DEMO_ATHLETE.uid, first.id, "hi"),
      "permission-denied",
    );
  });

  it("blocks an unlinked user", async () => {
    await backend.auth.signUp({
      ...ADULT,
      email: "stranger@example.com",
      password: "long-enough",
      displayName: "Stranger",
      role: "coach",
    });
    await expectCode(backend.data.listSessions(DEMO_ATHLETE.uid), "permission-denied");
  });
});

describe("coach invites", () => {
  it("links a coach through a one-time code, and the athlete can revoke it", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    const invite = await backend.data.createInvite(DEMO_ATHLETE.uid);
    expect(invite.code).toMatch(/^[A-Z2-9]{8}$/);

    const coach = await backend.auth.signUp({
      ...ADULT,
      email: "coach2@example.com",
      password: "long-enough",
      displayName: "Coach Two",
      role: "coach",
    });
    await backend.data.redeemInvite(coach.uid, invite.code.toLowerCase());
    expect(await backend.data.listAthletes(coach.uid)).toHaveLength(1);
    await expectCode(backend.data.redeemInvite(coach.uid, invite.code), "invite-invalid");

    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    await backend.data.revokeCoach(DEMO_ATHLETE.uid, coach.uid);
    await backend.auth.signIn("coach2@example.com", "long-enough");
    await expectCode(backend.data.listSessions(DEMO_ATHLETE.uid), "permission-denied");
  });
});

describe("sharing scope", () => {
  it("hides the breathing signal from a scores-only coach, and the athlete can change it", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    const [session] = await backend.data.listSessions(DEMO_ATHLETE.uid, { limit: 1 });
    await backend.data.getWaveform(session);

    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    await backend.data.setCoachScope(DEMO_ATHLETE.uid, DEMO_COACH.uid, "scores");
    expect(await backend.data.getCoachLink(DEMO_COACH.uid, DEMO_ATHLETE.uid)).toMatchObject({ scope: "scores" });

    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    expect(await backend.data.listSessions(DEMO_ATHLETE.uid, { limit: 1 })).toHaveLength(1);
    await expectCode(backend.data.getWaveform(session), "permission-denied");
    await expectCode(backend.data.setCoachScope(DEMO_ATHLETE.uid, DEMO_COACH.uid, "curves"), "permission-denied");
  });

  it("starts a redeemed link with the invite's scope", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    const invite = await backend.data.createInvite(DEMO_ATHLETE.uid, "scores");
    const coach = await backend.auth.signUp({ ...ADULT, email: "c3@example.com", password: "long-enough", displayName: "C", role: "coach" });
    expect(await backend.data.redeemInvite(coach.uid, invite.code)).toMatchObject({ scope: "scores" });
  });
});

describe("assignments", () => {
  const input = {
    athleteId: DEMO_ATHLETE.uid,
    mode: "paced" as const,
    pacerHalfCycleSec: 5 as const,
    durationSec: 300,
    target: 3,
    dueAt: "2026-11-25T22:00:00.000Z",
    note: "  Slow exhales.  ",
  };

  it("lets a linked coach set practice that the athlete can read", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    const created = await backend.data.createAssignment(DEMO_COACH.uid, input);
    expect(created).toMatchObject({ coachId: DEMO_COACH.uid, note: "Slow exhales.", cancelled: false });

    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    const list = await backend.data.listAssignments(DEMO_ATHLETE.uid);
    expect(list[0].id).toBe(created.id);
    await expectCode(backend.data.cancelAssignment(DEMO_ATHLETE.uid, created.id), "permission-denied");
    await expectCode(backend.data.createAssignment(DEMO_ATHLETE.uid, input), "permission-denied");

    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    await backend.data.cancelAssignment(DEMO_ATHLETE.uid, created.id);
    expect((await backend.data.listAssignments(DEMO_ATHLETE.uid))[0].cancelled).toBe(true);
  });

  it("refuses unlinked coaches and nonsense plans", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    await expectCode(backend.data.createAssignment(DEMO_COACH.uid, { ...input, target: 0 }), "invalid-input");
    await expectCode(backend.data.createAssignment(DEMO_COACH.uid, { ...input, pacerHalfCycleSec: null }), "invalid-input");
    await expectCode(backend.data.createAssignment(DEMO_COACH.uid, { ...input, dueAt: "2026-11-01T00:00:00.000Z" }), "invalid-input");

    const stranger = await backend.auth.signUp({ ...ADULT, email: "s@example.com", password: "long-enough", displayName: "S", role: "coach" });
    await expectCode(backend.data.createAssignment(stranger.uid, input), "permission-denied");
  });
});

describe("comments", () => {
  it("threads comments from the athlete and their coach, and only authors delete", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    const [session] = await backend.data.listSessions(DEMO_ATHLETE.uid, { limit: 1 });
    const mine = await backend.data.addComment(DEMO_ATHLETE.uid, session.id, { kind: "comment", text: " Nice work " });
    expect(mine).toMatchObject({ authorRole: "coach", authorName: DEMO_COACH.displayName, text: "Nice work" });
    const kudos = await backend.data.addComment(DEMO_ATHLETE.uid, session.id, { kind: "kudos", text: "" });
    expect((await backend.data.addComment(DEMO_ATHLETE.uid, session.id, { kind: "kudos", text: "" })).id).toBe(kudos.id);
    await expectCode(backend.data.addComment(DEMO_ATHLETE.uid, session.id, { kind: "comment", text: "  " }), "invalid-input");

    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    await backend.data.addComment(DEMO_ATHLETE.uid, session.id, { kind: "comment", text: "Thanks!" });
    const thread = await backend.data.listComments(DEMO_ATHLETE.uid, session.id);
    expect(thread.map((c) => c.authorRole)).toEqual(["coach", "coach", "athlete"]);
    await expectCode(backend.data.deleteComment(DEMO_ATHLETE.uid, session.id, mine.id), "permission-denied");

    const stranger = await backend.auth.signUp({ ...ADULT, email: "s@example.com", password: "long-enough", displayName: "S", role: "coach" });
    await expectCode(backend.data.listComments(DEMO_ATHLETE.uid), "permission-denied");
    await expectCode(backend.data.addComment(DEMO_ATHLETE.uid, session.id, { kind: "kudos", text: "" }), "permission-denied");
    expect(stranger.uid).toBeTruthy();
  });
});

describe("coach working data", () => {
  it("keeps seen sessions and notes private to the coach", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    await backend.data.markSessionSeen(DEMO_COACH.uid, DEMO_ATHLETE.uid, "s024");
    await backend.data.markSessionSeen(DEMO_COACH.uid, DEMO_ATHLETE.uid, "s024");
    const seen = await backend.data.listSeenSessions(DEMO_COACH.uid);
    expect(seen.filter((k) => k === `${DEMO_ATHLETE.uid}/s024`)).toHaveLength(1);

    await backend.data.saveCoachNote(DEMO_COACH.uid, DEMO_ATHLETE.uid, "Rushes inhales.");
    expect(await backend.data.getCoachNote(DEMO_COACH.uid, DEMO_ATHLETE.uid)).toBe("Rushes inhales.");

    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    await expectCode(backend.data.getCoachNote(DEMO_COACH.uid, DEMO_ATHLETE.uid), "permission-denied");
    await expectCode(backend.data.listSeenSessions(DEMO_COACH.uid), "permission-denied");
  });

  it("updates the signed-in user's own name only", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    expect(await backend.data.updateProfile(DEMO_COACH.uid, { displayName: "  Dr. Lena Vos " })).toMatchObject({
      displayName: "Dr. Lena Vos",
      role: "coach",
    });
    await expectCode(backend.data.updateProfile(DEMO_ATHLETE.uid, { displayName: "X" }), "permission-denied");
    await expectCode(backend.data.updateProfile(DEMO_COACH.uid, { displayName: " " }), "invalid-input");
  });
});

describe("group sessions", () => {
  const team = ["demo-athlete", "demo-athlete-2", "demo-athlete-3"];
  const input = { title: "Squad", athleteIds: team, pacerHalfCycleSec: 5 as const, durationSec: 300 };

  // A clock the test moves forward, since group sessions run in real time.
  let clock: number;
  let live: Backend;
  beforeEach(async () => {
    clock = NOW.getTime();
    live = createLocalBackend({ store: memoryStore(createSeededDb(NOW)), latencyMs: 0, now: () => new Date(clock) });
    await live.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
  });

  it("runs lobby → live → ended, and each athlete who took part gets a scored paced session", async () => {
    const group = await live.data.createGroupSession(DEMO_COACH.uid, input);
    expect(group).toMatchObject({ status: "lobby", hostName: DEMO_COACH.displayName, athleteIds: team });

    clock += 10_000; // everyone has joined the lobby
    await live.data.startGroupSession(group.id);
    clock += 60_000;
    await live.data.setGroupPacer(group.id, 2);
    await live.data.addGroupMarker(group.id);
    clock += 60_000;
    const ended = await live.data.endGroupSession(group.id);

    expect(ended.status).toBe("ended");
    expect(ended.pacerChanges).toEqual([{ atSec: 60, pacerHalfCycleSec: 2 }]);
    expect(Object.keys(ended.results).sort()).toEqual(team);
    expect(ended.groupAverage).toBeGreaterThanOrEqual(1);

    const [saved] = await live.data.listSessions("demo-athlete", { limit: 1 });
    expect(saved).toMatchObject({ id: ended.results["demo-athlete"], groupSessionId: group.id, mode: "paced", durationSec: 120 });
    const waveform = await live.data.getWaveform(saved);
    expect(waveform.user).toHaveLength(1200);
    expect(waveform.markers).toEqual([600]);
  });

  it("streams presence and frames to the host, with scores-only athletes' curves left out", async () => {
    const group = await live.data.createGroupSession(DEMO_COACH.uid, input);
    clock += 10_000;
    await live.data.startGroupSession(group.id);
    clock += 3_000;
    const frames: { t: number; samples: Record<string, number | null> }[] = [];
    const presence: Record<string, string>[] = [];
    const stop = live.data.watchGroupLive(group.id, { onPresence: (p) => presence.push(p), onFrame: (f) => frames.push(f) });
    stop();
    expect(presence[0]).toEqual({ "demo-athlete": "joined", "demo-athlete-2": "joined", "demo-athlete-3": "joined" });
    expect(frames.at(-1)!.t).toBe(3);
    expect(typeof frames.at(-1)!.samples["demo-athlete"]).toBe("number");
    // Priya shares scores only.
    expect(frames.at(-1)!.samples["demo-athlete-3"]).toBeNull();
  });

  it("keeps group sessions to the host and invited athletes, and the host to linked athletes", async () => {
    await expectCode(live.data.createGroupSession(DEMO_COACH.uid, { ...input, athleteIds: ["demo-athlete"] }), "invalid-input");
    await expectCode(live.data.createGroupSession(DEMO_COACH.uid, { ...input, athleteIds: [...team, "stranger"] }), "permission-denied");
    const group = await live.data.createGroupSession(DEMO_COACH.uid, input);

    await live.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    expect((await live.data.getGroupSession(group.id))?.title).toBe("Squad");
    expect(await live.data.listGroupSessions(DEMO_ATHLETE.uid)).toHaveLength(1);
    await expectCode(live.data.startGroupSession(group.id), "permission-denied");
    expect(() => live.data.watchGroupLive(group.id, { onPresence() {}, onFrame() {} })).toThrow(BackendError);

    await live.auth.signUp({ ...ADULT, email: "x@example.com", password: "long-enough", displayName: "X", role: "athlete" });
    await expectCode(live.data.getGroupSession(group.id), "permission-denied");
  });

  it("discards sessions under 30 seconds", async () => {
    const group = await live.data.createGroupSession(DEMO_COACH.uid, input);
    clock += 10_000;
    await live.data.startGroupSession(group.id);
    clock += 20_000;
    const ended = await live.data.endGroupSession(group.id);
    expect(ended).toMatchObject({ status: "ended", results: {}, groupAverage: null });
  });
});

describe("coach tools", () => {
  it("lets a coach set targets the athlete can see, and nothing else on the link", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    const targets = { score: 7.5, rateLow: 10, rateHigh: 14, sessionsPerWeek: 5 };
    await backend.data.setTargets(DEMO_COACH.uid, "demo-athlete-2", targets);
    await expectCode(backend.data.setTargets(DEMO_COACH.uid, "demo-athlete-2", { ...targets, rateLow: 20 }), "invalid-input");

    await backend.auth.signIn("sam@demo.local", DEMO_PASSWORD);
    expect((await backend.data.getCoachLink(DEMO_COACH.uid, "demo-athlete-2"))?.targets).toEqual(targets);
    await expectCode(backend.data.setTargets("demo-athlete-2", "demo-athlete-2", targets), "permission-denied");
  });

  it("keeps squads to the coach's own athletes", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    const seeded = await backend.data.listSquads(DEMO_COACH.uid);
    expect(seeded.map((s) => s.name)).toEqual(["Juniors", "Sprint squad"]);
    const squad = await backend.data.saveSquad(DEMO_COACH.uid, { name: " Morning group ", athleteIds: ["demo-athlete", "demo-athlete"] });
    expect(squad).toMatchObject({ name: "Morning group", athleteIds: ["demo-athlete"] });
    await backend.data.saveSquad(DEMO_COACH.uid, { id: squad.id, name: "Mornings", athleteIds: [] });
    expect((await backend.data.listSquads(DEMO_COACH.uid)).find((s) => s.id === squad.id)?.name).toBe("Mornings");
    await expectCode(backend.data.saveSquad(DEMO_COACH.uid, { name: "X", athleteIds: ["stranger"] }), "permission-denied");
    await backend.data.deleteSquad(DEMO_COACH.uid, squad.id);
    expect(await backend.data.listSquads(DEMO_COACH.uid)).toHaveLength(2);
  });

  it("stores alert rules per coach, with defaults until changed", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    expect(await backend.data.getAlertRules(DEMO_COACH.uid)).toEqual(DEFAULT_ALERTS);
    const rules = { ...DEFAULT_ALERTS, missedDays: 5, trendingDown: false };
    await backend.data.saveAlertRules(DEMO_COACH.uid, rules);
    expect(await backend.data.getAlertRules(DEMO_COACH.uid)).toEqual(rules);
    await expectCode(backend.data.saveAlertRules(DEMO_COACH.uid, { ...rules, scoreDrop: 0 }), "invalid-input");
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    await expectCode(backend.data.getAlertRules(DEMO_COACH.uid), "permission-denied");
  });

  it("links an athlete who accepts a coach's invite with the scope they choose", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    const invite = await backend.data.createCoachInvite(DEMO_COACH.uid, { athleteName: "Jo", contact: "jo@example.com" });
    await expectCode(backend.data.createCoachInvite(DEMO_COACH.uid, { athleteName: "Jo", contact: "nope" }), "invalid-input");

    const jo = await backend.auth.signUp({ ...ADULT, email: "jo@example.com", password: "long-enough", displayName: "Jo", role: "athlete" });
    const seen = await backend.data.getCoachInvite(invite.code.toLowerCase());
    expect(seen).toMatchObject({ coachName: DEMO_COACH.displayName, status: "pending" });
    expect(seen).not.toHaveProperty("contact");
    expect(await backend.data.respondToCoachInvite(jo.uid, invite.code, { accept: true, scope: "scores" })).toMatchObject({
      coachId: DEMO_COACH.uid,
      athleteId: jo.uid,
      scope: "scores",
    });
    await expectCode(backend.data.respondToCoachInvite(jo.uid, invite.code, { accept: false }), "invite-invalid");

    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    expect((await backend.data.listAthletes(DEMO_COACH.uid)).some((a) => a.uid === jo.uid)).toBe(true);
    expect((await backend.data.listCoachInvites(DEMO_COACH.uid)).find((i) => i.code === invite.code)?.status).toBe("accepted");
  });

  it("refuses revoked invites and coaches answering invites", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    const invite = await backend.data.createCoachInvite(DEMO_COACH.uid, { athleteName: "Kim", contact: "+1 555 0100" });
    await expectCode(backend.data.respondToCoachInvite(DEMO_COACH.uid, invite.code, { accept: false }), "permission-denied");
    await backend.data.revokeCoachInvite(DEMO_COACH.uid, invite.code);
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    await expectCode(backend.data.respondToCoachInvite(DEMO_ATHLETE.uid, invite.code, { accept: true, scope: "curves" }), "invite-invalid");
  });
});

describe("waitlist", () => {
  it("accepts a valid email once and rejects garbage", async () => {
    await backend.data.joinWaitlist({ email: "fan@example.com", source: "hero" });
    await backend.data.joinWaitlist({ email: "FAN@example.com", source: "footer" });
    await expectCode(backend.data.joinWaitlist({ email: "nope", source: "hero" }), "invalid-email");
  });
});

describe("seed data", () => {
  it("is deterministic and waveforms match session length", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    const [session] = await backend.data.listSessions(DEMO_ATHLETE.uid, { limit: 1 });
    const a = generateWaveform(session);
    const b = await backend.data.getWaveform(session);
    expect(b).toEqual(a);
    expect(a.user).toHaveLength((session.durationSec * 1000) / a.sampleIntervalMs);
    expect(a.pacer === null).toBe(session.mode === "open");
  });
});
