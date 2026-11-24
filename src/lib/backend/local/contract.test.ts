import { describe, expect, it } from "vitest";
import { SCORING_VERSIONS, type PacedDetails, type SessionSummary, type Waveform } from "@/lib/domain/types";
import { BackendError } from "../types";
import { createSeededDb, memoryStore } from "./db";
import { createLocalBackend } from "./index";
import { DEMO_ATHLETE, DEMO_PASSWORD, generateWaveform } from "./seed";
import { checkSessionContract } from "./validate";

const NOW = new Date("2026-11-24T12:00:00.000Z");

const summary = (fields: Partial<SessionSummary> = {}): SessionSummary => ({
  id: "c-open",
  athleteId: DEMO_ATHLETE.uid,
  startedAt: "2026-11-24T08:00:00.000Z",
  durationSec: 240,
  mode: "open",
  pacerHalfCycleSec: null,
  scores: null,
  scoringVersion: SCORING_VERSIONS.transition,
  respirationRateBpm: 14,
  note: "",
  waveformPath: `waveforms/${DEMO_ATHLETE.uid}/c-open.json.gz`,
  appVersion: "1.2.0+60",
  ...fields,
});

const pacedSummary = (fields: Partial<SessionSummary> = {}) =>
  summary({
    id: "c-paced",
    mode: "paced",
    pacerHalfCycleSec: 5,
    scores: { total: 7, timing: { inhale: 7, exhale: 7 }, depth: { inhale: 7, exhale: 7 }, smoothness: null },
    waveformPath: `waveforms/${DEMO_ATHLETE.uid}/c-paced.json.gz`,
    ...fields,
  });

const waveform = (fields: Partial<Waveform> = {}): Waveform => ({
  sampleIntervalMs: 50,
  user: [0, 1, 2, 1, 0],
  pacer: null,
  markers: [],
  calibration: { min: 0, max: 4 },
  ...fields,
});

const details = (histogram: Partial<PacedDetails["histogram"]> = {}): PacedDetails => ({
  onTargetPct: { timing: 72.5, depth: 64 },
  direction: { timing: { inhale: 0.25, exhale: -0.5 }, depth: { inhale: null, exhale: 0.75 } },
  histogram: { timing: [0, 1, 3, 9, 8, 4, 1, 0], depth: [1, 2, 4, 7, 7, 3, 2, 0], missedOrDouble: 2, ...histogram },
  missed: 1,
  double: 1,
  transitions: 26,
});

const rejectsWith = (field: string, run: () => void) => {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(BackendError);
  expect(caught).toMatchObject({ code: "invalid-input" });
  expect((caught as Error).message).toContain(field);
};

describe("checkSessionContract", () => {
  it("accepts an open waveform with 2 markers", () => {
    expect(() => checkSessionContract(summary(), waveform({ markers: [10, 40] }))).not.toThrow();
  });

  it("rejects an open waveform with 3 markers", () => {
    rejectsWith("markers", () => checkSessionContract(summary(), waveform({ markers: [10, 40, 80] })));
  });

  it("accepts a paced waveform with 3 markers", () => {
    expect(() =>
      checkSessionContract(pacedSummary(), waveform({ pacer: [0, 1, 2, 1, 0], markers: [10, 40, 80] })),
    ).not.toThrow();
  });

  it("rejects a calibration with 2 peaks", () => {
    rejectsWith("calibration.peaks", () =>
      checkSessionContract(summary(), waveform({ calibration: { min: 0, max: 4, peaks: [3.9, 3.8] } })),
    );
  });

  it("rejects a calibration with 4 troughs", () => {
    rejectsWith("calibration.troughs", () =>
      checkSessionContract(summary(), waveform({ calibration: { min: 0, max: 4, troughs: [0.1, 0.2, 0.3, 0.4] } })),
    );
  });

  it("rejects a 7-bin histogram", () => {
    const paced = details({ timing: [0, 1, 3, 9, 8, 4, 1] });
    rejectsWith("paced.histogram.timing", () => checkSessionContract(pacedSummary({ paced }), waveform()));
  });

  it("rejects an unknown skill level", () => {
    const skillLevel = "elite" as unknown as SessionSummary["skillLevel"];
    rejectsWith("skillLevel", () => checkSessionContract(summary({ skillLevel }), waveform()));
  });

  it("accepts every seeded session with its generated waveform", () => {
    const sessions = Object.values(createSeededDb(NOW).sessions).flat();
    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions) {
      expect(() => checkSessionContract(session, generateWaveform(session))).not.toThrow();
    }
  });
});

describe("new contract fields in the local adapter", () => {
  const calibration = { min: 1.2, max: 3.4, a100: 2.2, midline: 2.3, peaks: [3.4, 3.35, 3.3], troughs: [1.2, 1.25, 1.3] };

  const open = summary({
    id: "c-open-new",
    skillLevel: "advanced",
    scoringVersion: SCORING_VERSIONS.methodC,
    paced: null,
    waveformPath: `waveforms/${DEMO_ATHLETE.uid}/c-open-new.json.gz`,
  });
  const openWave = waveform({ units: "pct-max", calibration, markers: [1, 3] });
  const paced = pacedSummary({
    id: "c-paced-new",
    skillLevel: "advanced",
    scoringVersion: SCORING_VERSIONS.methodC,
    paced: details(),
    waveformPath: `waveforms/${DEMO_ATHLETE.uid}/c-paced-new.json.gz`,
  });
  const pacedWave = waveform({ units: "pct-max", calibration, pacer: [0, 1, 2, 1, 0], markers: [0, 1, 2, 4] });

  const signedIn = async () => {
    const db = createSeededDb(NOW);
    db.sessions[DEMO_ATHLETE.uid] = [paced, open, ...db.sessions[DEMO_ATHLETE.uid]];
    db.recordedWaveforms[open.waveformPath] = openWave;
    db.recordedWaveforms[paced.waveformPath] = pacedWave;
    const backend = createLocalBackend({ store: memoryStore(db), latencyMs: 0, now: () => NOW });
    await backend.auth.signIn(DEMO_ATHLETE.email, DEMO_PASSWORD);
    return { backend, db };
  };

  it("stores sessions that pass the contract check", () => {
    expect(() => checkSessionContract(open, openWave)).not.toThrow();
    expect(() => checkSessionContract(paced, pacedWave)).not.toThrow();
  });

  it("reads open and paced sessions with every new field back unchanged", async () => {
    const { backend } = await signedIn();
    for (const [stored, storedWave] of [
      [open, openWave],
      [paced, pacedWave],
    ] as const) {
      const read = await backend.data.getSession(DEMO_ATHLETE.uid, stored.id);
      expect(read).toEqual(stored);
      expect(await backend.data.getWaveform(read!)).toEqual(storedWave);
    }
  });

  it("reads a seeded legacy session with none of the new keys", async () => {
    const { backend, db } = await signedIn();
    const legacy = Object.values(db.sessions)
      .flat()
      .find((s) => s.athleteId === DEMO_ATHLETE.uid && s.scoringVersion === SCORING_VERSIONS.legacy);
    expect(legacy).toBeDefined();
    const read = await backend.data.getSession(DEMO_ATHLETE.uid, legacy!.id);
    expect(read).toEqual(legacy);
    expect(read).not.toHaveProperty("skillLevel");
    expect(read).not.toHaveProperty("paced");
    const wave = await backend.data.getWaveform(read!);
    expect(wave).not.toHaveProperty("units");
    for (const key of ["a100", "midline", "peaks", "troughs"]) {
      expect(wave.calibration).not.toHaveProperty(key);
    }
  });
});
