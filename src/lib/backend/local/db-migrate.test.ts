import { afterEach, describe, expect, it, vi } from "vitest";
import { SCORING_VERSIONS, type SessionSummary } from "@/lib/domain/types";
import { browserStore, createSeededDb, migrateDb, STORAGE_KEY } from "./db";

// A browser holding the version-8 database (before mood check-ins, T-0119) keeps
// everything recorded in it: the upgrade adds `moodCheckins` instead of reseeding.

const NOW = new Date("2026-11-26T12:00:00.000Z");
const MAYA = "demo-athlete-4";

/** The version-8 shape: today's seed without `moodCheckins`. */
function v8Db() {
  const db: Partial<ReturnType<typeof createSeededDb>> = createSeededDb(NOW);
  delete db.moodCheckins;
  return { ...(db as Omit<ReturnType<typeof createSeededDb>, "moodCheckins">), version: 8 as const };
}

/** A session recorded in this browser, by a person who signed up here. */
const recorded: SessionSummary = {
  id: "s-rec12345",
  athleteId: "u-new",
  startedAt: "2026-11-26T11:00:00.000Z",
  durationSec: 300,
  mode: "paced",
  pacerHalfCycleSec: 5,
  scores: { total: 7.5, timing: { inhale: 8, exhale: 7 }, depth: { inhale: 8, exhale: 7 }, smoothness: null },
  scoringVersion: SCORING_VERSIONS.methodC,
  respirationRateBpm: 6,
  note: "Recorded with my band",
  waveformPath: "waveforms/u-new/s-rec12345.json.gz",
  appVersion: "web",
  source: "web",
};

function withRecording() {
  const db = v8Db();
  db.accounts["u-new"] = {
    password: "secret-pass",
    profile: { uid: "u-new", email: "new@example.com", displayName: "New Person", role: "athlete", createdAt: "2026-11-20T09:00:00.000Z" },
  };
  db.sessions["u-new"] = [recorded];
  db.recordedWaveforms[recorded.waveformPath] = { sampleIntervalMs: 50, user: [0, 1, 0], pacer: [0, 1, 0], markers: [], calibration: { min: 0, max: 1 } };
  // Maya recorded one in this browser too: no seeded mood may land on it.
  // And joined a group session here: its result has no `source` and must get no seeded mood either.
  const groupResult: SessionSummary = { ...recorded, id: "s-group001", athleteId: MAYA, groupSessionId: "g-1", waveformPath: "waveforms/demo-athlete-4/s-group001.json.gz" };
  delete groupResult.source;
  db.sessions[MAYA] = [
    { ...recorded, id: "s-maya0001", athleteId: MAYA, waveformPath: "waveforms/demo-athlete-4/s-maya0001.json.gz" },
    groupResult,
    ...db.sessions[MAYA],
  ];
  db.currentUid = "u-new";
  return db;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("migrateDb 8 → 9", () => {
  it("keeps a session recorded in this browser, with its account and signal, and adds moodCheckins", () => {
    const before = withRecording();
    const after = migrateDb(structuredClone(before), NOW)!;

    expect(after.version).toBe(9);
    expect(after.sessions["u-new"]).toEqual([recorded]);
    expect(after.accounts["u-new"]).toEqual(before.accounts["u-new"]);
    expect(after.recordedWaveforms[recorded.waveformPath]).toEqual(before.recordedWaveforms[recorded.waveformPath]);
    expect(after.currentUid).toBe("u-new");
    expect(after.moodCheckins["u-new"] ?? []).toEqual([]);
    // The demo's Focus person keeps her seeded check-ins, on seeded sessions only.
    expect(after.moodCheckins[MAYA].length).toBeGreaterThan(0);
    expect(after.moodCheckins[MAYA].some((c) => c.sessionId === "s-maya0001")).toBe(false);
    expect(after.moodCheckins[MAYA].some((c) => c.sessionId === "s-group001")).toBe(false);
    expect(after.sessions[MAYA].some((s) => s.id === "s-group001")).toBe(true);
    const seededIds = new Set(after.sessions[MAYA].filter((s) => s.source === "app" && !s.groupSessionId).map((s) => s.id));
    expect(after.moodCheckins[MAYA].every((c) => c.sessionId !== null && seededIds.has(c.sessionId))).toBe(true);
  });

  it("leaves the current version alone and gives up on older or unknown ones", () => {
    const current = createSeededDb(NOW);
    expect(migrateDb(current, NOW)).toBe(current);
    expect(migrateDb({ ...v8Db(), version: 7 }, NOW)).toBeNull();
    expect(migrateDb({ version: "x" }, NOW)).toBeNull();
    expect(migrateDb(null, NOW)).toBeNull();
    expect(migrateDb({ ...v8Db(), sessions: { [MAYA]: "not a list" } }, NOW)).toBeNull();
  });
});

describe("browserStore", () => {
  function fakeStorage(initial: Record<string, string>) {
    const items = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => void items.set(k, v),
      removeItem: (k: string) => void items.delete(k),
      items,
    };
  }

  it("upgrades a stored version-8 database in place: the recorded session survives", () => {
    const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify(withRecording()) });
    vi.stubGlobal("window", { localStorage: storage });

    const db = browserStore().read();
    expect(db.version).toBe(9);
    expect(db.sessions["u-new"]).toEqual([recorded]);
    expect(db.moodCheckins).toBeDefined();
    // Written back, so the next read is the upgraded one.
    expect(JSON.parse(storage.items.get(STORAGE_KEY)!)).toMatchObject({ version: 9, sessions: { "u-new": [recorded] } });
  });

  it("still reseeds a database older than version 8", () => {
    const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ ...withRecording(), version: 7 }) });
    vi.stubGlobal("window", { localStorage: storage });

    const db = browserStore().read();
    expect(db.version).toBe(9);
    expect(db.sessions["u-new"]).toBeUndefined();
  });
});
