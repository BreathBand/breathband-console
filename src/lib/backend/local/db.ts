import type {
  AlertRules,
  Assignment,
  CoachInvite,
  CoachLink,
  GroupSession,
  Invite,
  MoodCheckin,
  SessionComment,
  SessionSummary,
  Squad,
  UserPreferences,
  UserProfile,
  WaitlistEntry,
  Waveform,
} from "@/lib/domain/types";
import { defaultPreferences } from "@/lib/domain/preferences";
import {
  DEMO_ATHLETE,
  DEMO_COACH,
  DEMO_FOCUS,
  DEMO_NEW_PEOPLE,
  DEMO_PASSWORD,
  DEMO_RECORDERS,
  DEMO_TEAM,
  seedCoaching,
  seedMoodCheckins,
  seedProfessionals,
  seedProfiles,
  seedSessions,
} from "./seed";

// The local adapter's "database": one JSON document, persisted to
// localStorage in the browser and kept in memory everywhere else (tests,
// prerendering). Development only — passwords are stored in plain text.

export interface LocalAccount {
  password: string;
  profile: UserProfile;
}

// Bump when the seed or the shape changes. A browser holding the version before is
// migrated in place (`migrateDb`), so sessions recorded there survive; anything
// older, or unreadable, reseeds.
const DB_VERSION = 10;

export interface LocalDb {
  version: typeof DB_VERSION;
  accounts: Record<string, LocalAccount>;
  sessions: Record<string, SessionSummary[]>;
  coachLinks: CoachLink[];
  invites: Invite[];
  /** By athlete id, newest first. */
  assignments: Record<string, Assignment[]>;
  /** By athlete id, oldest first. */
  comments: Record<string, SessionComment[]>;
  /** By coach id: "athleteId/sessionId" keys of sessions the coach has opened. */
  seen: Record<string, string[]>;
  /** By "coachId_athleteId". */
  coachNotes: Record<string, string>;
  /** By coach id. */
  squads: Record<string, Squad[]>;
  /** By coach id; missing → DEFAULT_ALERTS. */
  alertRules: Record<string, AlertRules>;
  /** Newest first. */
  coachInvites: CoachInvite[];
  /** Newest first. */
  groupSessions: GroupSession[];
  /** By athlete id, newest first: mood check-ins around sessions (Focus, J6). */
  moodCheckins: Record<string, MoodCheckin[]>;
  /** Signals saved by group sessions, by waveformPath. Other sessions' signals are generated from the seed. */
  recordedWaveforms: Record<string, Waveform>;
  waitlist: (WaitlistEntry & { createdAt: string })[];
  currentUid: string | null;
}

export const STORAGE_KEY = "breathband-console:local-db";

export function createSeededDb(now = new Date()): LocalDb {
  // Lena's squad, then the people the demo plan adds: Maya, Ana with her clients, Chris with his class.
  const team = [DEMO_ATHLETE, ...DEMO_TEAM];
  const sessions = Object.fromEntries(DEMO_RECORDERS.map((p) => [p.uid, seedSessions(p.uid, now)]));
  const lena = seedCoaching(Object.fromEntries(team.map((a) => [a.uid, sessions[a.uid]])), now);
  const pros = seedProfessionals(sessions, now);
  return {
    version: DB_VERSION,
    accounts: Object.fromEntries(seedProfiles(sessions, now).map((profile) => [profile.uid, { password: DEMO_PASSWORD, profile }])),
    sessions,
    coachLinks: [
      // Priya shares scores only, so the console has a "curves not shared" case to show.
      ...team.map((a): CoachLink => ({
        coachId: DEMO_COACH.uid,
        athleteId: a.uid,
        scope: a.uid === "demo-athlete-3" ? "scores" : "curves",
        createdAt: a.createdAt,
        // Alex is chasing a higher score before a meet.
        targets: a.uid === DEMO_ATHLETE.uid ? { score: 8, rateLow: 12, rateHigh: 16, sessionsPerWeek: 4 } : null,
      })),
      ...pros.coachLinks,
    ],
    invites: [],
    assignments: { ...lena.assignments, ...pros.assignments },
    comments: { ...lena.comments, ...pros.comments },
    seen: { ...lena.seen, ...pros.seen },
    coachNotes: { ...lena.coachNotes, ...pros.coachNotes },
    squads: { ...lena.squads, ...pros.squads },
    coachInvites: [...lena.coachInvites, ...pros.coachInvites].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    alertRules: {},
    groupSessions: [],
    moodCheckins: seedMoodCheckins(sessions, now),
    recordedWaveforms: {},
    waitlist: [],
    currentUid: null,
  };
}

export interface DbStore {
  read(): LocalDb;
  write(db: LocalDb): void;
}

export function memoryStore(initial: LocalDb = createSeededDb()): DbStore {
  let db = structuredClone(initial);
  return {
    read: () => db,
    write: (next) => {
      db = next;
    },
  };
}

type StoredDb = Omit<LocalDb, "version" | "moodCheckins"> & { version?: unknown; moodCheckins?: LocalDb["moodCheckins"] };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Sessions the seed placed (source "app", no group session): never one recorded or joined in this browser. */
const seededOnly = (sessions: LocalDb["sessions"]) =>
  Object.fromEntries(Object.entries(sessions).map(([uid, list]) => [uid, list.filter((s) => s.source === "app" && !s.groupSessionId)]));

/**
 * A stored database at the current version, upgrading the two versions before
 * in place; null when it's older or unknown (the caller reseeds).
 *
 * 8 → 9 (T-0119) adds `moodCheckins`: empty for everyone, except the demo
 * people's seeded check-ins, placed on their seeded sessions only.
 *
 * 9 → 10 (T-0127) adds the demo plan's people (`addDemoPeople`). Accounts,
 * sessions and everything else recorded in this browser are kept as they are.
 */
export function migrateDb(stored: unknown, now = new Date()): LocalDb | null {
  if (!isRecord(stored)) return null;
  const db = stored as StoredDb;
  if (db.version === DB_VERSION) return db as LocalDb;
  if (db.version !== 8 && db.version !== 9) return null;
  if (!isRecord(db.sessions) || !Object.values(db.sessions).every(Array.isArray)) return null;
  // 8 → 9 seeds only what v9 seeded (Hana's check-ins); Sam's come with his move to Focus in 9 → 10.
  const v9Moods = (): LocalDb["moodCheckins"] => {
    const hana = seedMoodCheckins(seededOnly(db.sessions), now)["demo-athlete-4"];
    return hana ? { "demo-athlete-4": hana } : {};
  };
  const v9 = db.version === 8 ? { ...db, version: 9, moodCheckins: db.moodCheckins ?? v9Moods() } : db;
  return addDemoPeople(v9, now);
}

/** Sam's preferences as the v9 seed made them (Train, before T-0127 moved him to Focus). */
const V9_SAM_PREFERENCES: UserPreferences = { ...defaultPreferences("train", "beginner"), onboardedAt: "2026-09-08T09:00:00.000Z" };

const withoutGamification = (p: UserPreferences): Omit<UserPreferences, "gamification"> => {
  const rest = { ...p };
  delete rest.gamification;
  return rest;
};

/** Equal as JSON, whatever the key order. */
function sameJson(a: unknown, b: unknown): boolean {
  const canon = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(canon) : isRecord(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}

/**
 * 9 → 10: the people the demo plan adds (Maya, Ana and her clients, Chris and
 * his class), with everything that names only them, unless their uid or email
 * is already taken here. Lena's "Maya Chen" becomes Hana Mori (one Maya in the
 * demo), Sam moves to Focus with his exam and check-ins, and Lena's unanswered
 * invite for Jordan Lee becomes Ruby Hale's: each only while still as seeded.
 * Null when the stored shape isn't one this can extend (the caller reseeds).
 */
function addDemoPeople(stored: StoredDb, now: Date): LocalDb | null {
  const parts = [stored.accounts, stored.assignments, stored.comments, stored.seen, stored.coachNotes, stored.squads, stored.moodCheckins];
  if (!parts.every(isRecord) || !Array.isArray(stored.coachLinks) || !Array.isArray(stored.coachInvites)) return null;
  const db = { ...structuredClone(stored), version: DB_VERSION } as LocalDb;
  const seed = createSeededDb(now);
  const seeded = (uid: string) => seed.accounts[uid].profile;

  const emailTaken = (email: string, except?: string) =>
    Object.values(db.accounts).some((a) => a.profile.uid !== except && a.profile.email.toLowerCase() === email.toLowerCase());

  // Hana: only while still the v9 seed's Maya Chen, and only when nobody here holds her new email. If she
  // stays, so does maya@demo.local, and the new Maya isn't added (her email is taken; see below).
  const hana = db.accounts["demo-athlete-4"]?.profile;
  if (hana?.email === "maya@demo.local" && hana.displayName === "Maya Chen") {
    const { email, displayName } = seeded(hana.uid);
    if (!emailTaken(email, hana.uid)) {
      Object.assign(hana, { email, displayName });
      for (const c of Object.values(db.comments).flat()) if (c.authorId === hana.uid) c.authorName = displayName;
    }
  }

  // Sam moves to Focus, with his seeded check-ins, only while his preferences are still exactly the v9
  // seed's (what he was shown on Home, `gamification`, aside, and kept). Edited in this browser: he stays as he is.
  const sam = db.accounts[DEMO_FOCUS.uid]?.profile;
  if (sam?.preferences && sameJson(withoutGamification(sam.preferences), V9_SAM_PREFERENCES)) {
    const shown = sam.preferences.gamification;
    sam.preferences = { ...structuredClone(seeded(sam.uid).preferences!), ...(shown && { gamification: shown }) };
    if (!db.moodCheckins[sam.uid]?.length) {
      const moods = seedMoodCheckins(seededOnly({ [sam.uid]: db.sessions[sam.uid] ?? [] }), now)[sam.uid];
      if (moods?.length) db.moodCheckins[sam.uid] = moods;
    }
  }

  for (const invite of db.coachInvites) {
    if (invite.coachId === DEMO_COACH.uid && invite.code === "JRDN7K2Q" && invite.status === "pending" && invite.athleteName === "Jordan Lee") {
      invite.athleteName = seed.coachInvites.find((i) => i.coachId === DEMO_COACH.uid && i.status === "pending")?.athleteName ?? invite.athleteName;
    }
  }

  const emails = new Set(Object.values(db.accounts).map((a) => a.profile.email.toLowerCase()));
  const added = new Set<string>();
  for (const { uid, email } of DEMO_NEW_PEOPLE) {
    if (db.accounts[uid] || emails.has(email.toLowerCase())) continue;
    added.add(uid);
    db.accounts[uid] = seed.accounts[uid];
    db.sessions[uid] ??= seed.sessions[uid] ?? [];
    if (seed.moodCheckins[uid]) db.moodCheckins[uid] ??= seed.moodCheckins[uid];
  }
  if (added.size === 0) return db;

  // Everything the professionals' seed holds, where everyone it names was added just now.
  const ok = (...uids: (string | null)[]) => uids.every((uid) => uid === null || added.has(uid));
  const pros = seedProfessionals(seed.sessions, now);
  db.coachLinks.push(...pros.coachLinks.filter((l) => ok(l.coachId, l.athleteId)));
  db.coachInvites = [...db.coachInvites, ...pros.coachInvites.filter((i) => ok(i.coachId, i.athleteId))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const [athleteId, list] of Object.entries(pros.assignments)) {
    const fresh = list.filter((a) => ok(a.coachId, a.athleteId));
    if (fresh.length) db.assignments[athleteId] = [...(db.assignments[athleteId] ?? []), ...fresh];
  }
  for (const [athleteId, list] of Object.entries(pros.comments)) {
    const fresh = list.filter((c) => ok(c.athleteId, c.authorId));
    if (fresh.length) db.comments[athleteId] = [...(db.comments[athleteId] ?? []), ...fresh];
  }
  for (const [coachId, keys] of Object.entries(pros.seen)) {
    if (ok(coachId)) db.seen[coachId] = keys.filter((key) => ok(key.split("/")[0]));
  }
  for (const [key, text] of Object.entries(pros.coachNotes)) {
    if (ok(...(key.split("_") as [string, string]))) db.coachNotes[key] = text;
  }
  for (const [coachId, list] of Object.entries(pros.squads)) {
    if (ok(coachId)) db.squads[coachId] = list.map((q) => ({ ...q, athleteIds: q.athleteIds.filter((uid) => ok(uid)) }));
  }
  return db;
}

export function browserStore(): DbStore {
  const fallback = memoryStore();
  const storage = typeof window === "undefined" ? null : safeLocalStorage();
  if (!storage) return fallback;

  return {
    read() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (raw) {
          const stored: unknown = JSON.parse(raw);
          const migrated = migrateDb(stored);
          if (migrated) {
            if (migrated !== stored) this.write(migrated);
            return migrated;
          }
        }
      } catch {
        // Corrupt or unreadable: fall through and reseed.
      }
      const seeded = createSeededDb();
      this.write(seeded);
      return seeded;
    },
    write(db) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(db));
      } catch {
        fallback.write(db);
      }
    },
  };
}

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Wipes local data back to the demo seed (used by the "Reset demo data" control). */
export function resetBrowserDb(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
