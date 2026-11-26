import { afterEach, describe, expect, it, vi } from "vitest";
import { SCORING_VERSIONS, type SessionSummary } from "@/lib/domain/types";
import { defaultPreferences } from "@/lib/domain/preferences";
import { browserStore, createSeededDb, migrateDb, STORAGE_KEY, type LocalDb } from "./db";
import { DEMO_CALM, DEMO_CLIENT, DEMO_CLINICIAN, DEMO_COACH, DEMO_EDUCATOR, DEMO_FOCUS, DEMO_NEW_PEOPLE } from "./seed";

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

    expect(after.version).toBe(10);
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

/**
 * The version-9 shape (before T-0127): today's seed without the demo plan's new
 * people or anything naming them, Hana still "Maya Chen", Sam still on Train with
 * no check-ins, and Lena's unanswered invite still for Jordan Lee.
 */
function v9Db() {
  const db = structuredClone(createSeededDb(NOW)) as Omit<LocalDb, "version"> & { version: number };
  const added = new Set(DEMO_NEW_PEOPLE.map((p) => p.uid));
  for (const part of [db.accounts, db.sessions, db.moodCheckins, db.assignments, db.comments, db.seen, db.squads]) {
    for (const uid of added) delete part[uid];
  }
  db.coachLinks = db.coachLinks.filter((l) => !added.has(l.coachId) && !added.has(l.athleteId));
  db.coachInvites = db.coachInvites.filter((i) => !added.has(i.coachId));
  for (const key of Object.keys(db.coachNotes)) if (key.split("_").some((uid) => added.has(uid))) delete db.coachNotes[key];
  const hana = db.accounts[MAYA].profile;
  Object.assign(hana, { email: "maya@demo.local", displayName: "Maya Chen" });
  for (const c of Object.values(db.comments).flat()) if (c.authorId === MAYA) c.authorName = "Maya Chen";
  db.accounts[DEMO_FOCUS.uid].profile.preferences = { ...defaultPreferences("train", "beginner"), onboardedAt: "2026-09-08T09:00:00.000Z" };
  delete db.moodCheckins[DEMO_FOCUS.uid];
  const pending = db.coachInvites.find((i) => i.coachId === DEMO_COACH.uid && i.status === "pending")!;
  Object.assign(pending, { code: "JRDN7K2Q", athleteName: "Jordan Lee" });
  db.version = 9;
  return db;
}

describe("migrateDb 9 → 10", () => {
  it("adds the demo plan's people and everything that names them, as a fresh seed has them", () => {
    const after = migrateDb(v9Db(), NOW)!;
    const fresh = createSeededDb(NOW);
    expect(after.version).toBe(10);
    for (const p of DEMO_NEW_PEOPLE) expect(after.accounts[p.uid], p.displayName).toEqual(fresh.accounts[p.uid]);
    expect(after.coachLinks).toEqual(expect.arrayContaining(fresh.coachLinks));
    expect(after.coachLinks).toHaveLength(fresh.coachLinks.length);
    for (const uid of [DEMO_CLIENT.uid, DEMO_CALM.uid]) expect(after.sessions[uid]).toEqual(fresh.sessions[uid]);
    expect(after.assignments[DEMO_CLIENT.uid]).toEqual(fresh.assignments[DEMO_CLIENT.uid]);
    expect(after.comments[DEMO_CLIENT.uid]).toEqual(fresh.comments[DEMO_CLIENT.uid]);
    expect(after.seen[DEMO_CLINICIAN.uid]).toEqual(fresh.seen[DEMO_CLINICIAN.uid]);
    expect(after.squads[DEMO_EDUCATOR.uid]).toEqual(fresh.squads[DEMO_EDUCATOR.uid]);
    expect(after.coachInvites.filter((i) => i.coachId === DEMO_CLINICIAN.uid)).toEqual(fresh.coachInvites.filter((i) => i.coachId === DEMO_CLINICIAN.uid));
  });

  it("renames Lena's Maya to Hana, moves Sam to Focus with his check-ins, and frees Jordan's name on Lena's invite", () => {
    const after = migrateDb(v9Db(), NOW)!;
    const fresh = createSeededDb(NOW);
    expect(after.accounts[MAYA].profile).toMatchObject({ email: "hana@demo.local", displayName: "Hana Mori" });
    expect(Object.values(after.comments).flat().filter((c) => c.authorId === MAYA).every((c) => c.authorName === "Hana Mori")).toBe(true);
    expect(after.accounts[DEMO_CALM.uid].profile.email).toBe("maya@demo.local");
    expect(after.accounts[DEMO_FOCUS.uid].profile.preferences).toEqual(fresh.accounts[DEMO_FOCUS.uid].profile.preferences);
    expect(after.moodCheckins[DEMO_FOCUS.uid]).toEqual(fresh.moodCheckins[DEMO_FOCUS.uid]);
    const pending = after.coachInvites.filter((i) => i.coachId === DEMO_COACH.uid && i.status === "pending");
    expect(pending.map((i) => i.athleteName)).toEqual(["Ruby Hale"]);
  });

  it("keeps what was recorded and changed in this browser", () => {
    const before = v9Db();
    before.accounts["u-new"] = {
      password: "secret-pass",
      profile: { uid: "u-new", email: "new@example.com", displayName: "New Person", role: "athlete", createdAt: "2026-11-20T09:00:00.000Z" },
    };
    before.sessions["u-new"] = [recorded];
    before.recordedWaveforms[recorded.waveformPath] = { sampleIntervalMs: 50, user: [0, 1, 0], pacer: [0, 1, 0], markers: [], calibration: { min: 0, max: 1 } };
    const samsOwn = { ...recorded, id: "s-sam00001", athleteId: DEMO_FOCUS.uid, waveformPath: "waveforms/demo-athlete-2/s-sam00001.json.gz" };
    before.sessions[DEMO_FOCUS.uid] = [samsOwn, ...before.sessions[DEMO_FOCUS.uid]];
    // Hana renamed herself here: she keeps her name and email, so the new Maya can't have maya@demo.local.
    before.accounts[MAYA].profile.displayName = "Maya C.";
    before.currentUid = "u-new";

    const after = migrateDb(structuredClone(before), NOW)!;
    expect(after.accounts["u-new"]).toEqual(before.accounts["u-new"]);
    expect(after.sessions["u-new"]).toEqual([recorded]);
    expect(after.recordedWaveforms[recorded.waveformPath]).toEqual(before.recordedWaveforms[recorded.waveformPath]);
    expect(after.currentUid).toBe("u-new");
    expect(after.sessions[DEMO_FOCUS.uid][0]).toEqual(samsOwn);
    expect(after.moodCheckins[DEMO_FOCUS.uid].some((c) => c.sessionId === samsOwn.id)).toBe(false);
    expect(after.accounts[MAYA].profile).toMatchObject({ email: "maya@demo.local", displayName: "Maya C." });
    expect(after.accounts[DEMO_CALM.uid]).toBeUndefined();
    // Everyone else arrives.
    expect(after.accounts[DEMO_CLINICIAN.uid]).toBeDefined();
    expect(after.coachLinks.some((l) => l.athleteId === DEMO_CALM.uid)).toBe(false);
  });

  it("leaves a person whose email someone signed up with here, and only what names them", () => {
    const before = v9Db();
    before.accounts["u-jordan"] = {
      password: "secret-pass",
      profile: { uid: "u-jordan", email: "Jordan@demo.local", displayName: "Someone Else", role: "athlete", createdAt: "2026-11-20T09:00:00.000Z" },
    };
    const after = migrateDb(before, NOW)!;
    expect(after.accounts[DEMO_CLIENT.uid]).toBeUndefined();
    expect(after.accounts["u-jordan"].profile.displayName).toBe("Someone Else");
    expect(after.coachLinks.some((l) => l.athleteId === DEMO_CLIENT.uid)).toBe(false);
    expect(after.assignments[DEMO_CLIENT.uid]).toBeUndefined();
    expect(after.comments[DEMO_CLIENT.uid]).toBeUndefined();
    expect(after.coachNotes[`${DEMO_CLINICIAN.uid}_${DEMO_CLIENT.uid}`]).toBeUndefined();
    expect(after.coachInvites.some((i) => i.athleteId === DEMO_CLIENT.uid)).toBe(false);
    expect((after.seen[DEMO_CLINICIAN.uid] ?? []).some((k) => k.startsWith(`${DEMO_CLIENT.uid}/`))).toBe(false);
    // Ana and her other client still arrive.
    expect(after.coachLinks.some((l) => l.coachId === DEMO_CLINICIAN.uid)).toBe(true);
  });

  it("leaves Hana as Maya Chen when someone signed up here as hana@demo.local, and the new Maya out", () => {
    const before = v9Db();
    const hanaHere = { uid: "u-hana", email: "hana@demo.local", displayName: "Hana Here", role: "athlete" as const, createdAt: "2026-11-20T09:00:00.000Z" };
    before.accounts["u-hana"] = { password: "secret-pass", profile: hanaHere };
    const after = migrateDb(before, NOW)!;
    expect(after.accounts["u-hana"].profile).toEqual(hanaHere);
    expect(after.accounts[MAYA].profile).toMatchObject({ email: "maya@demo.local", displayName: "Maya Chen" });
    expect(Object.values(after.comments).flat().filter((c) => c.authorId === MAYA).every((c) => c.authorName === "Maya Chen")).toBe(true);
    // Each email still belongs to one account only, so both sign in as themselves.
    const emails = Object.values(after.accounts).map((a) => a.profile.email.toLowerCase());
    expect(new Set(emails).size).toBe(emails.length);
    expect(after.accounts[DEMO_CALM.uid]).toBeUndefined();
    expect(after.sessions[DEMO_CALM.uid]).toBeUndefined();
    // Everyone else still arrives.
    expect(after.accounts[DEMO_CLINICIAN.uid]).toBeDefined();
  });

  it("leaves Sam on Train, without seeded check-ins, when his preferences were edited here", () => {
    const before = v9Db();
    const edited = { ...before.accounts[DEMO_FOCUS.uid].profile.preferences!, dailyMinutes: 10, reminders: { enabled: true, time: "07:15", days: ["mon" as const], timeZone: "Europe/London" } };
    before.accounts[DEMO_FOCUS.uid].profile.preferences = edited;
    const after = migrateDb(structuredClone(before), NOW)!;
    expect(after.accounts[DEMO_FOCUS.uid].profile.preferences).toEqual(edited);
    expect(after.moodCheckins[DEMO_FOCUS.uid] ?? []).toEqual([]);
  });

  it("moves Sam while only what he was shown on Home changed, and keeps that", () => {
    const before = v9Db();
    const shown = { awarded: { "first-calibration": "2026-10-01T09:00:00.000Z" } };
    before.accounts[DEMO_FOCUS.uid].profile.preferences!.gamification = shown;
    const after = migrateDb(before, NOW)!;
    expect(after.accounts[DEMO_FOCUS.uid].profile.preferences?.goal).toBe("focus");
    expect(after.accounts[DEMO_FOCUS.uid].profile.preferences?.gamification).toEqual(shown);
    expect(after.moodCheckins[DEMO_FOCUS.uid].length).toBeGreaterThan(0);
  });

  it("takes a v8 database (Maya Chen, Sam on Train, no check-ins) straight to a fresh seed's v10", () => {
    const v8: Partial<ReturnType<typeof v9Db>> = v9Db();
    delete v8.moodCheckins;
    const after = migrateDb({ ...v8, version: 8 }, NOW)!;
    expect(after).toEqual({ ...createSeededDb(NOW), coachInvites: after.coachInvites });
    // Lena's invite keeps its v9 code under Ruby Hale's name (a fresh seed's is RBHL7K2Q).
    expect(after.coachInvites.find((i) => i.coachId === DEMO_COACH.uid && i.status === "pending")).toMatchObject({ code: "JRDN7K2Q", athleteName: "Ruby Hale" });
  });

  it("gives Sam no check-ins on the way from v8 when his preferences were edited", () => {
    const v8: Partial<ReturnType<typeof v9Db>> = v9Db();
    delete v8.moodCheckins;
    v8.accounts![DEMO_FOCUS.uid].profile.preferences!.dailyMinutes = 10;
    const after = migrateDb({ ...v8, version: 8 }, NOW)!;
    expect(after.accounts[DEMO_FOCUS.uid].profile.preferences?.goal).toBe("train");
    expect(after.moodCheckins[DEMO_FOCUS.uid] ?? []).toEqual([]);
    expect(after.moodCheckins[MAYA].length).toBeGreaterThan(0);
  });

  it("is a no-op the second time and reseeds a v9 database it can't extend", () => {
    const once = migrateDb(v9Db(), NOW)!;
    expect(migrateDb(once, NOW)).toBe(once);
    expect(migrateDb({ ...v9Db(), coachInvites: "broken" }, NOW)).toBeNull();
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
    expect(db.version).toBe(10);
    expect(db.sessions["u-new"]).toEqual([recorded]);
    expect(db.moodCheckins).toBeDefined();
    // Written back, so the next read is the upgraded one.
    expect(JSON.parse(storage.items.get(STORAGE_KEY)!)).toMatchObject({ version: 10, sessions: { "u-new": [recorded] } });
  });

  it("still reseeds a database older than version 8", () => {
    const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ ...withRecording(), version: 7 }) });
    vi.stubGlobal("window", { localStorage: storage });

    const db = browserStore().read();
    expect(db.version).toBe(10);
    expect(db.sessions["u-new"]).toBeUndefined();
  });
});
