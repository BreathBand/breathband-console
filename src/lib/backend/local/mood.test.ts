import { beforeEach, describe, expect, it } from "vitest";
import { moodPairs } from "@/lib/domain/mood";
import { SCORING_VERSIONS, type Waveform } from "@/lib/domain/types";
import { BackendError, type Backend, type NewSession } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";
import { DEMO_ATHLETE, DEMO_COACH, DEMO_PASSWORD, DEMO_TEAM } from "./seed";

// Mood check-ins (J6): stored beside the athlete's own session, private to them,
// mirroring users/{uid}/moodCheckins in firebase/firestore.rules.

const NOW = new Date("2026-11-26T12:00:00.000Z");
const MAYA = DEMO_TEAM.find((p) => p.uid === "demo-athlete-4")!;

let backend: Backend;

beforeEach(() => {
  backend = createLocalBackend({ store: memoryStore(createSeededDb(NOW)), latencyMs: 0, now: () => NOW });
});

const expectCode = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(BackendError);
  await expect(promise).rejects.toMatchObject({ code });
};

const waveform: Waveform = {
  sampleIntervalMs: 50,
  units: "pct-max",
  user: [0, 1, 2, 3, 2, 1, 0],
  pacer: [0, 1, 2, 3, 2, 1, 0],
  markers: [],
  calibration: { min: 1600, max: 2500, a100: 900, midline: 2050 },
};

const session: NewSession = {
  startedAt: "2026-11-26T11:50:00.000Z",
  durationSec: 300,
  mode: "paced",
  pacerHalfCycleSec: 5,
  scores: { total: 8.5, timing: { inhale: 9, exhale: 8 }, depth: { inhale: 9, exhale: 8 }, smoothness: null },
  scoringVersion: SCORING_VERSIONS.methodC,
  respirationRateBpm: 6,
  note: "",
  appVersion: "web",
  skillLevel: "intermediate",
  source: "web",
};

describe("saveMoodCheckins", () => {
  it("stores the mood before and after with the session it was taken around", async () => {
    await backend.auth.signIn(MAYA.email, DEMO_PASSWORD);
    const saved = await backend.data.saveSession(MAYA.uid, session, waveform);
    const stored = await backend.data.saveMoodCheckins(MAYA.uid, saved.id, { before: 2, after: 4 });

    expect(stored).toHaveLength(2);
    expect(stored.every((c) => c.sessionId === saved.id && c.athleteId === MAYA.uid)).toBe(true);
    expect(stored.find((c) => c.phase === "before")).toMatchObject({ mood: 2, createdAt: session.startedAt });
    expect(stored.find((c) => c.phase === "after")).toMatchObject({ mood: 4, createdAt: NOW.toISOString() });

    const listed = await backend.data.listMoodCheckins(MAYA.uid);
    expect(listed.filter((c) => c.sessionId === saved.id).map((c) => c.phase)).toEqual(["after", "before"]);
    expect(moodPairs(listed).find((p) => p.sessionId === saved.id)).toMatchObject({ before: 2, after: 4, change: 2 });
  });

  it("replaces the session's check-ins, and stores only the phases given", async () => {
    await backend.auth.signIn(MAYA.email, DEMO_PASSWORD);
    const saved = await backend.data.saveSession(MAYA.uid, session, waveform);
    await backend.data.saveMoodCheckins(MAYA.uid, saved.id, { before: 2, after: 4 });
    const again = await backend.data.saveMoodCheckins(MAYA.uid, saved.id, { before: 3, after: null });

    expect(again).toEqual([expect.objectContaining({ phase: "before", mood: 3 })]);
    const forSession = (await backend.data.listMoodCheckins(MAYA.uid)).filter((c) => c.sessionId === saved.id);
    expect(forSession).toEqual([expect.objectContaining({ phase: "before", mood: 3 })]);
  });

  it("takes only 1 to 5", async () => {
    await backend.auth.signIn(MAYA.email, DEMO_PASSWORD);
    const saved = await backend.data.saveSession(MAYA.uid, session, waveform);
    await expectCode(backend.data.saveMoodCheckins(MAYA.uid, saved.id, { before: 0 as never, after: 4 }), "invalid-input");
    await expectCode(backend.data.saveMoodCheckins(MAYA.uid, saved.id, { before: 3, after: 6 as never }), "invalid-input");
  });

  it("needs one of the person's own sessions", async () => {
    await backend.auth.signIn(MAYA.email, DEMO_PASSWORD);
    await expectCode(backend.data.saveMoodCheckins(MAYA.uid, "s-nope", { before: 3, after: 4 }), "not-found");
    const alexSession = (await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD), await backend.data.listSessions(DEMO_ATHLETE.uid))[0];
    await backend.auth.signIn(MAYA.email, DEMO_PASSWORD);
    await expectCode(backend.data.saveMoodCheckins(DEMO_ATHLETE.uid, alexSession.id, { before: 3, after: 4 }), "permission-denied");
  });

  it("leaves the check-ins unlinked when the session is deleted", async () => {
    await backend.auth.signIn(MAYA.email, DEMO_PASSWORD);
    const saved = await backend.data.saveSession(MAYA.uid, session, waveform);
    await backend.data.saveMoodCheckins(MAYA.uid, saved.id, { before: 2, after: 4 });
    await backend.data.deleteSession(MAYA.uid, saved.id);

    const listed = await backend.data.listMoodCheckins(MAYA.uid);
    expect(listed.filter((c) => c.sessionId === saved.id)).toEqual([]);
    expect(listed.filter((c) => c.sessionId === null)).toHaveLength(2);
    expect(moodPairs(listed).some((p) => p.sessionId === saved.id)).toBe(false);
  });
});

describe("listMoodCheckins", () => {
  it("is private: a linked coach can't read them", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    await expectCode(backend.data.listMoodCheckins(MAYA.uid), "permission-denied");
  });

  it("needs a signed-in person", async () => {
    await expectCode(backend.data.listMoodCheckins(MAYA.uid), "not-signed-in");
  });

  it("holds the demo's Focus check-ins: Maya's last two weeks, paired with her sessions", async () => {
    await backend.auth.signIn(MAYA.email, DEMO_PASSWORD);
    const sessions = new Set((await backend.data.listSessions(MAYA.uid)).map((s) => s.id));
    const pairs = moodPairs(await backend.data.listMoodCheckins(MAYA.uid));
    expect(pairs.length).toBeGreaterThanOrEqual(3);
    expect(pairs.every((p) => sessions.has(p.sessionId))).toBe(true);
    expect(pairs.every((p) => Date.parse(p.at) > NOW.getTime() - 14 * 86_400_000)).toBe(true);

    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    expect(await backend.data.listMoodCheckins(DEMO_ATHLETE.uid)).toEqual([]);
  });
});
