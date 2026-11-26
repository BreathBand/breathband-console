import { beforeEach, describe, expect, it } from "vitest";
import { SCORING_VERSIONS, type Waveform } from "@/lib/domain/types";
import type { NewSession } from "../types";
import type { DataContractHarness, Person } from "./data.harness";
import { refusal } from "./data.harness";

// The sessions and waveforms section of the shared adapter suite: list, get,
// save, note, delete, and who may read the signal. Run by
// contract/data.local.test.ts and http/data.http.test.ts.

const openSession = (fields: Partial<NewSession> = {}): NewSession => ({
  startedAt: "2026-11-24T08:00:00.000Z",
  durationSec: 240,
  mode: "open",
  pacerHalfCycleSec: null,
  scores: null,
  scoringVersion: SCORING_VERSIONS.transition,
  respirationRateBpm: 14,
  note: "  felt calm  ",
  appVersion: "web",
  source: "web",
  ...fields,
});

const pacedSession = (fields: Partial<NewSession> = {}): NewSession =>
  openSession({
    mode: "paced",
    pacerHalfCycleSec: 5,
    scores: { total: 7, timing: { inhale: 7, exhale: 7 }, depth: { inhale: 7, exhale: 7 }, smoothness: null },
    skillLevel: "intermediate",
    ...fields,
  });

const signal = (fields: Partial<Waveform> = {}): Waveform => ({
  sampleIntervalMs: 50,
  user: [0, 0.5, 1, 0.5, 0, -0.5, -1, -0.5],
  pacer: null,
  markers: [2],
  calibration: { min: -1, max: 1, a100: 1, midline: 0 },
  ...fields,
});

export function describeSessionsContract(adapter: string, setup: () => DataContractHarness | Promise<DataContractHarness>) {
  describe(`DataService contract, sessions and waveforms: ${adapter}`, () => {
    let h: DataContractHarness;
    let ana: Person;

    beforeEach(async () => {
      h = await setup();
      ana = await h.person();
    });

    const save = (fields: Partial<NewSession> = {}, waveform = signal()) => ana.backend.data.saveSession(ana.uid, openSession(fields), waveform);

    describe("saveSession, listSessions, getSession", () => {
      it("starts a new account with no sessions", async () => {
        expect(await ana.backend.data.listSessions(ana.uid)).toEqual([]);
      });

      it("stores a session with its id, owner and waveformPath, the note trimmed", async () => {
        const input = pacedSession();
        const saved = await ana.backend.data.saveSession(ana.uid, input, signal({ pacer: signal().user }));
        expect(saved).toMatchObject({ ...input, athleteId: ana.uid, note: "felt calm" });
        expect(saved.id).toEqual(expect.any(String));
        expect(saved.waveformPath).toBe(`waveforms/${ana.uid}/${saved.id}.json.gz`);
        expect(await ana.backend.data.getSession(ana.uid, saved.id)).toEqual(saved);
      });

      it("lists newest first, with a limit and a before cursor", async () => {
        const older = await save({ startedAt: "2026-11-20T08:00:00.000Z" });
        const newest = await save({ startedAt: "2026-11-24T08:00:00.000Z" });
        const middle = await save({ startedAt: "2026-11-22T08:00:00.000Z" });
        const ids = (list: { id: string }[]) => list.map((s) => s.id);
        expect(ids(await ana.backend.data.listSessions(ana.uid))).toEqual([newest.id, middle.id, older.id]);
        expect(ids(await ana.backend.data.listSessions(ana.uid, { limit: 2 }))).toEqual([newest.id, middle.id]);
        expect(ids(await ana.backend.data.listSessions(ana.uid, { before: middle.startedAt }))).toEqual([older.id]);
      });

      it("answers null for a session that isn't there", async () => {
        expect(await ana.backend.data.getSession(ana.uid, "no-such-session")).toBeNull();
      });

      it.each<[string, Partial<NewSession>, Partial<Waveform>]>([
        ["an empty recording", {}, { user: [] }],
        ["a zero-length session", { durationSec: 0 }, {}],
        ["a pacer signal of another length", { mode: "paced", pacerHalfCycleSec: 5 }, { pacer: [0, 1] }],
        ["three markers on an open session", {}, { markers: [1, 3, 5] }],
        ["calibration peaks that aren't three", {}, { calibration: { min: -1, max: 1, peaks: [1, 2] } }],
      ])("refuses %s and stores nothing", async (_, fields, waveform) => {
        await refusal(save(fields, signal(waveform)), "invalid-input");
        expect(await ana.backend.data.listSessions(ana.uid)).toEqual([]);
      });

      it("lets only the athlete save to their own sessions", async () => {
        const cara = await h.person("coach");
        await h.link(cara.uid, ana.uid, "curves");
        await refusal(cara.backend.data.saveSession(ana.uid, openSession(), signal()), "permission-denied");
        expect(await ana.backend.data.listSessions(ana.uid)).toEqual([]);
      });
    });

    describe("updateSessionNote and deleteSession", () => {
      it("changes the note", async () => {
        const saved = await save();
        await ana.backend.data.updateSessionNote(ana.uid, saved.id, "legs heavy");
        expect(await ana.backend.data.getSession(ana.uid, saved.id)).toMatchObject({ note: "legs heavy" });
      });

      it("removes the session", async () => {
        const kept = await save({ startedAt: "2026-11-20T08:00:00.000Z" });
        const removed = await save();
        await ana.backend.data.deleteSession(ana.uid, removed.id);
        expect(await ana.backend.data.getSession(ana.uid, removed.id)).toBeNull();
        expect((await ana.backend.data.listSessions(ana.uid)).map((s) => s.id)).toEqual([kept.id]);
      });

      it("says not-found for a session that isn't there", async () => {
        await refusal(ana.backend.data.updateSessionNote(ana.uid, "no-such-session", "x"), "not-found");
        await refusal(ana.backend.data.deleteSession(ana.uid, "no-such-session"), "not-found");
      });

      it("refuses a linked coach both, whatever the scope", async () => {
        const saved = await save();
        const cara = await h.person("coach");
        await h.link(cara.uid, ana.uid, "curves");
        await refusal(cara.backend.data.updateSessionNote(ana.uid, saved.id, "coach was here"), "permission-denied");
        await refusal(cara.backend.data.deleteSession(ana.uid, saved.id), "permission-denied");
        expect(await ana.backend.data.getSession(ana.uid, saved.id)).toMatchObject({ note: "felt calm" });
      });
    });

    describe("who reads what", () => {
      it("needs someone signed in", async () => {
        const saved = await save();
        const nobody = h.signedOut().data;
        await refusal(nobody.listSessions(ana.uid), "not-signed-in");
        await refusal(nobody.getSession(ana.uid, saved.id), "not-signed-in");
        await refusal(nobody.getWaveform(saved), "not-signed-in");
      });

      it("refuses everything to someone with no link", async () => {
        const saved = await save();
        const stranger = await h.person();
        await refusal(stranger.backend.data.listSessions(ana.uid), "permission-denied");
        await refusal(stranger.backend.data.getSession(ana.uid, saved.id), "permission-denied");
        await refusal(stranger.backend.data.getWaveform(saved), "permission-denied");
      });

      it("gives the athlete back the signal exactly as saved", async () => {
        const waveform = signal({ units: "pct-max", markers: [1, 4] });
        const saved = await save({}, waveform);
        expect(await ana.backend.data.getWaveform(saved)).toEqual(waveform);
      });

      it("shows a scores-only coach the sessions but not the curves, until the athlete shares curves", async () => {
        const waveform = signal();
        const saved = await save({}, waveform);
        const cara = await h.person("coach");
        await h.link(cara.uid, ana.uid, "scores");

        expect((await cara.backend.data.listSessions(ana.uid)).map((s) => s.id)).toEqual([saved.id]);
        expect(await cara.backend.data.getSession(ana.uid, saved.id)).toEqual(saved);
        await refusal(cara.backend.data.getWaveform(saved), "permission-denied");

        await h.link(cara.uid, ana.uid, "curves");
        expect(await cara.backend.data.getWaveform(saved)).toEqual(waveform);
      });

      it("denies a coach everything once the link is revoked", async () => {
        const saved = await save();
        const cara = await h.person("coach");
        await h.link(cara.uid, ana.uid, "curves");
        expect(await cara.backend.data.getWaveform(saved)).toEqual(signal());

        await h.link(cara.uid, ana.uid, null);
        await refusal(cara.backend.data.listSessions(ana.uid), "permission-denied");
        await refusal(cara.backend.data.getSession(ana.uid, saved.id), "permission-denied");
        await refusal(cara.backend.data.getWaveform(saved), "permission-denied");
      });
    });
  });
}
