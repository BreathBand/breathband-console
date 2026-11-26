import { beforeEach, describe, expect, it } from "vitest";
import { SCORING_VERSIONS, type Waveform } from "@/lib/domain/types";
import { BackendError, type Backend, type NewSession } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";
import { DEMO_ATHLETE, DEMO_COACH, DEMO_PASSWORD } from "./seed";

const NOW = new Date("2026-11-24T12:00:00.000Z");

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
  startedAt: "2026-11-24T11:55:00.000Z",
  durationSec: 300,
  mode: "paced",
  pacerHalfCycleSec: 5,
  scores: { total: 8.5, timing: { inhale: 9, exhale: 8 }, depth: { inhale: 9, exhale: 8 }, smoothness: null },
  scoringVersion: SCORING_VERSIONS.methodC,
  respirationRateBpm: 6,
  note: "  First web session  ",
  appVersion: "web",
  skillLevel: "intermediate",
  source: "web",
};

describe("saveSession", () => {
  it("stores the athlete's own session first in the list, with its signal", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    const saved = await backend.data.saveSession(DEMO_ATHLETE.uid, session, waveform);
    expect(saved.athleteId).toBe(DEMO_ATHLETE.uid);
    expect(saved.waveformPath).toBe(`waveforms/${DEMO_ATHLETE.uid}/${saved.id}.json.gz`);
    expect(saved.note).toBe("First web session");
    const [first] = await backend.data.listSessions(DEMO_ATHLETE.uid, { limit: 1 });
    expect(first.id).toBe(saved.id);
    expect(await backend.data.getWaveform(saved)).toEqual(waveform);
  });

  it("lets a linked coach with the curves scope read the saved session and its signal", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    const saved = await backend.data.saveSession(DEMO_ATHLETE.uid, session, waveform);
    await backend.auth.signOut();
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    expect(await backend.data.getSession(DEMO_ATHLETE.uid, saved.id)).toEqual(saved);
    expect((await backend.data.getWaveform(saved)).user).toEqual(waveform.user);
  });

  it("refuses to save into someone else's history", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    await expectCode(backend.data.saveSession(DEMO_ATHLETE.uid, session, waveform), "permission-denied");
  });

  it("refuses an empty recording and a pacer that doesn't line up", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    await expectCode(backend.data.saveSession(DEMO_ATHLETE.uid, session, { ...waveform, user: [] }), "invalid-input");
    await expectCode(backend.data.saveSession(DEMO_ATHLETE.uid, session, { ...waveform, pacer: [1, 2] }), "invalid-input");
  });

  it("refuses an open session with more than two markers", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    const open: NewSession = { ...session, mode: "open", pacerHalfCycleSec: null, scores: null };
    await expectCode(
      backend.data.saveSession(DEMO_ATHLETE.uid, open, { ...waveform, pacer: null, markers: [1, 2, 3] }),
      "invalid-input",
    );
  });
});

describe("deleteSession", () => {
  it("removes the athlete's session, its signal and its comments", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    const saved = await backend.data.saveSession(DEMO_ATHLETE.uid, session, waveform);
    await backend.data.addComment(DEMO_ATHLETE.uid, saved.id, { kind: "comment", text: "Felt good" });
    await backend.data.deleteSession(DEMO_ATHLETE.uid, saved.id);
    expect(await backend.data.getSession(DEMO_ATHLETE.uid, saved.id)).toBeNull();
    expect(await backend.data.listComments(DEMO_ATHLETE.uid, saved.id)).toEqual([]);
  });

  it("is the athlete's alone", async () => {
    await backend.auth.signIn(DEMO_COACH.email, DEMO_PASSWORD);
    const [first] = await backend.data.listSessions(DEMO_ATHLETE.uid, { limit: 1 });
    await expectCode(backend.data.deleteSession(DEMO_ATHLETE.uid, first.id), "permission-denied");
  });

  it("reports a session that isn't there", async () => {
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    await expectCode(backend.data.deleteSession(DEMO_ATHLETE.uid, "nope"), "not-found");
  });
});
