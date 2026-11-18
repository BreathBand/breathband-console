import { beforeEach, describe, expect, it } from "vitest";
import { BackendError, type Backend } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";
import { DEMO_ATHLETE, DEMO_COACH, DEMO_PASSWORD, generateWaveform } from "./seed";

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
    await expectCode(backend.auth.signUp({ ...base, email: DEMO_COACH.email }), "email-in-use");
    await expectCode(
      backend.auth.signUp({ ...base, email: "a@b.co", password: "short" }),
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
