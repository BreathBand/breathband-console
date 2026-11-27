import { beforeEach, describe, expect, it } from "vitest";
import { SCORING_VERSIONS, type Waveform } from "@/lib/domain/types";
import type { NewSession } from "../types";
import { PASSWORD, refusal, type DataContractHarness, type Person } from "./data.harness";

// The own-account section of the shared adapter suite: deletion with its 24
// hours to change your mind, "download my data", and the access log (C10).
// Run by contract/data.local.test.ts and http/data.http.test.ts.

const DAY_MS = 86_400_000;

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

export function describeAccountContract(adapter: string, setup: () => DataContractHarness | Promise<DataContractHarness>) {
  describe(`DataService contract, own account: ${adapter}`, () => {
    let h: DataContractHarness;
    let ana: Person;

    beforeEach(async () => {
      h = await setup();
      ana = await h.person();
    });

    it("asks for the password, waits 24 hours, signs out, and can be cancelled after signing back in", async () => {
      expect(await ana.backend.data.getAccountDeletion()).toBeNull();
      await refusal(ana.backend.data.requestAccountDeletion("not the password"), "invalid-credentials");

      const deletion = await ana.backend.data.requestAccountDeletion(PASSWORD);
      expect(Date.parse(deletion.deleteAfter) - Date.parse(deletion.requestedAt)).toBe(DAY_MS);
      await refusal(ana.backend.data.getAccountDeletion(), "not-signed-in");

      await ana.backend.auth.signIn(ana.email, PASSWORD);
      expect(await ana.backend.data.getAccountDeletion()).toEqual(deletion);
      await ana.backend.data.cancelAccountDeletion();
      expect(await ana.backend.data.getAccountDeletion()).toBeNull();
      await refusal(ana.backend.data.cancelAccountDeletion(), "not-found");
    });

    it("exports the person's own data", async () => {
      const saved = await ana.backend.data.saveSession(ana.uid, session, signal);
      const data = await ana.backend.data.exportMyData();
      expect(Date.parse(String(data.exportedAt))).not.toBeNaN();
      expect(JSON.stringify(data)).toContain(ana.email);
      expect(JSON.stringify(data)).toContain(saved.id);
    });

    it("keeps calibrations with their band, answers the newest, and only to the person", async () => {
      expect(await ana.backend.data.getLatestCalibration(ana.uid)).toBeNull();
      await ana.backend.data.saveCalibration(ana.uid, { a100: 120, midline: 512, source: "simulated", bandName: "Simulated band" });
      const newest = await ana.backend.data.saveCalibration(ana.uid, { a100: 140, midline: 500, source: "bluetooth", bandName: "BreathBand" });
      expect(newest).toMatchObject({ a100: 140, midline: 500, source: "bluetooth", bandName: "BreathBand" });
      expect(Date.parse(newest.at)).not.toBeNaN();
      expect(await ana.backend.data.getLatestCalibration(ana.uid)).toEqual(newest);

      await refusal(ana.backend.data.saveCalibration(ana.uid, { a100: 0, midline: 500, source: "bluetooth", bandName: null }), "invalid-input");
      const cara = await h.person("coach");
      await h.link(cara.uid, ana.uid, "curves");
      await refusal(cara.backend.data.getLatestCalibration(ana.uid), "permission-denied");
      await refusal(cara.backend.data.saveCalibration(ana.uid, { a100: 100, midline: 0, source: "bluetooth", bandName: null }), "permission-denied");
    });

    it("takes product events from the list, with flat properties only", async () => {
      const at = new Date().toISOString();
      await ana.backend.data.trackEvents([{ name: "onboarding_step_viewed", props: { track: "calm", step: "goal" }, at }]);
      await refusal(ana.backend.data.trackEvents([{ name: "breath_samples" as never, at }]), "invalid-input");
      await refusal(ana.backend.data.trackEvents([{ name: "session_saved", props: { samples: [1, 2, 3] as never }, at }]), "invalid-input");
      await refusal(ana.backend.data.trackEvents([]), "invalid-input");
      await refusal(h.signedOut().data.trackEvents([{ name: "session_saved", at }]), "not-signed-in");
    });

    it("logs a professional opening a session, never the person's own, newest first", async () => {
      const cara = await h.person("coach");
      await h.link(cara.uid, ana.uid, "scores");
      const first = await ana.backend.data.saveSession(ana.uid, session, signal);
      const second = await ana.backend.data.saveSession(ana.uid, { ...session, startedAt: "2026-11-25T08:00:00.000Z" }, signal);

      await ana.backend.data.getSession(ana.uid, first.id);
      expect(await ana.backend.data.listAccessLog()).toEqual([]);

      await cara.backend.data.getSession(ana.uid, first.id);
      await cara.backend.data.getSession(ana.uid, second.id);
      const log = await ana.backend.data.listAccessLog();
      expect(log.map((e) => [e.viewerId, e.viewerName, e.sessionId])).toEqual([
        [cara.uid, "Cara Coach", second.id],
        [cara.uid, "Cara Coach", first.id],
      ]);
      for (const entry of log) expect(Date.parse(entry.at)).not.toBeNaN();
      expect(await cara.backend.data.listAccessLog()).toEqual([]);
    });
  });
}
