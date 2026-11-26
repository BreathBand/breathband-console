import { beforeEach, describe, expect, it } from "vitest";
import { SCORING_VERSIONS, type MoodScore, type SessionSummary, type Waveform } from "@/lib/domain/types";
import type { NewSession } from "../types";
import type { DataContractHarness, Person } from "./data.harness";
import { refusal } from "./data.harness";

// The mood check-in section of the shared adapter suite (Focus, J6): the mood
// before and after one of the person's own sessions, private to them, linked
// professionals included. Run by contract/data.local.test.ts and http/data.http.test.ts.

const session: NewSession = {
  startedAt: "2026-11-24T08:00:00.000Z",
  durationSec: 240,
  mode: "open",
  pacerHalfCycleSec: null,
  scores: null,
  scoringVersion: SCORING_VERSIONS.transition,
  respirationRateBpm: 14,
  note: "",
  appVersion: "web",
  source: "web",
};

const signal: Waveform = { sampleIntervalMs: 50, user: [0, 1, 0, -1, 0], pacer: null, markers: [], calibration: { min: -1, max: 1 } };

export function describeMoodContract(adapter: string, setup: () => DataContractHarness | Promise<DataContractHarness>) {
  describe(`DataService contract, mood check-ins: ${adapter}`, () => {
    let h: DataContractHarness;
    let ana: Person;
    let saved: SessionSummary;

    beforeEach(async () => {
      h = await setup();
      ana = await h.person();
      saved = await ana.backend.data.saveSession(ana.uid, session, signal);
    });

    it("stores the mood before and after with the session, the before one at its start, newest first", async () => {
      const stored = await ana.backend.data.saveMoodCheckins(ana.uid, saved.id, { before: 2, after: 4 });
      expect(stored.map((c) => [c.phase, c.mood])).toEqual([["after", 4], ["before", 2]]);
      expect(stored.every((c) => c.athleteId === ana.uid && c.sessionId === saved.id && c.id)).toBe(true);
      expect(stored[1].createdAt).toBe(session.startedAt);
      expect(Date.now() - Date.parse(stored[0].createdAt)).toBeLessThan(60_000);
      expect(await ana.backend.data.listMoodCheckins(ana.uid)).toEqual(stored);
      expect(await ana.backend.data.listMoodCheckins(ana.uid, { limit: 1 })).toEqual([stored[0]]);
    });

    it("replaces what the session had, and stores nothing for a phase left out", async () => {
      await ana.backend.data.saveMoodCheckins(ana.uid, saved.id, { before: 2, after: 4 });
      const stored = await ana.backend.data.saveMoodCheckins(ana.uid, saved.id, { before: 3, after: null });
      expect(stored).toMatchObject([{ phase: "before", mood: 3 }]);
      expect(await ana.backend.data.listMoodCheckins(ana.uid)).toEqual(stored);
      expect(await ana.backend.data.saveMoodCheckins(ana.uid, saved.id, { before: null, after: null })).toEqual([]);
      expect(await ana.backend.data.listMoodCheckins(ana.uid)).toEqual([]);
    });

    it.each<[string, unknown]>([
      ["0", 0],
      ["6", 6],
      ["2.5", 2.5],
      ["a word", "good"],
    ])("refuses a mood of %s", async (_, mood) => {
      await refusal(ana.backend.data.saveMoodCheckins(ana.uid, saved.id, { before: mood as MoodScore, after: 4 }), "invalid-input");
      expect(await ana.backend.data.listMoodCheckins(ana.uid)).toEqual([]);
    });

    it("needs one of the person's own sessions", async () => {
      await refusal(ana.backend.data.saveMoodCheckins(ana.uid, "no-such-session", { before: 3, after: 4 }), "not-found");
      const ben = await h.person();
      const bens = await ben.backend.data.saveSession(ben.uid, session, signal);
      await refusal(ana.backend.data.saveMoodCheckins(ana.uid, bens.id, { before: 3, after: 4 }), "not-found");
    });

    it("keeps check-ins from everyone else, a linked professional included", async () => {
      await ana.backend.data.saveMoodCheckins(ana.uid, saved.id, { before: 2, after: 4 });
      const cara = await h.person("coach");
      await h.link(cara.uid, ana.uid, "curves");
      await refusal(cara.backend.data.listMoodCheckins(ana.uid), "permission-denied");
      await refusal(cara.backend.data.saveMoodCheckins(ana.uid, saved.id, { before: 1, after: 1 }), "permission-denied");
      await refusal(h.signedOut().data.listMoodCheckins(ana.uid), "not-signed-in");
      expect((await ana.backend.data.listMoodCheckins(ana.uid)).map((c) => c.mood)).toEqual([4, 2]);
    });

    it("keeps the check-ins when the session is deleted, no longer pointing at it", async () => {
      await ana.backend.data.saveMoodCheckins(ana.uid, saved.id, { before: 2, after: 4 });
      await ana.backend.data.deleteSession(ana.uid, saved.id);
      expect((await ana.backend.data.listMoodCheckins(ana.uid)).map((c) => [c.phase, c.sessionId])).toEqual([["after", null], ["before", null]]);
    });
  });
}
