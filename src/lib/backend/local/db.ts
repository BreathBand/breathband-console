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
  UserProfile,
  WaitlistEntry,
  Waveform,
} from "@/lib/domain/types";
import { DEMO_ATHLETE, DEMO_COACH, DEMO_PASSWORD, DEMO_TEAM, seedCoaching, seedMoodCheckins, seedSessions } from "./seed";

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
const DB_VERSION = 9;

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
  const athletes = [DEMO_ATHLETE, ...DEMO_TEAM];
  const sessions = Object.fromEntries(athletes.map((a) => [a.uid, seedSessions(a.uid, now)]));
  return {
    version: DB_VERSION,
    accounts: Object.fromEntries(
      [...athletes, DEMO_COACH].map((profile) => [profile.uid, { password: DEMO_PASSWORD, profile }]),
    ),
    sessions,
    // Priya shares scores only, so the console has a "curves not shared" case to show.
    coachLinks: athletes.map((a) => ({
      coachId: DEMO_COACH.uid,
      athleteId: a.uid,
      scope: a.uid === "demo-athlete-3" ? "scores" : "curves",
      createdAt: a.createdAt,
      // Alex is chasing a higher score before a meet.
      targets: a.uid === DEMO_ATHLETE.uid ? { score: 8, rateLow: 12, rateHigh: 16, sessionsPerWeek: 4 } : null,
    })),
    invites: [],
    ...seedCoaching(sessions, now),
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

/**
 * A stored database at the current version, upgrading the version before in
 * place; null when it's older or unknown (the caller reseeds).
 *
 * 8 → 9 (T-0119) adds `moodCheckins`: empty for everyone, except the demo
 * people's seeded check-ins, placed on their seeded sessions only (source
 * "app", no group session), never on one recorded or joined in this browser. Accounts, sessions and everything else
 * are kept as they are.
 */
export function migrateDb(stored: unknown, now = new Date()): LocalDb | null {
  if (typeof stored !== "object" || stored === null) return null;
  const db = stored as Omit<LocalDb, "version" | "moodCheckins"> & { version?: unknown; moodCheckins?: LocalDb["moodCheckins"] };
  if (db.version === DB_VERSION) return db as LocalDb;
  if (db.version !== 8 || typeof db.sessions !== "object" || db.sessions === null) return null;
  const lists = Object.entries(db.sessions);
  if (!lists.every(([, list]) => Array.isArray(list))) return null;
  const seededSessions = Object.fromEntries(lists.map(([uid, list]) => [uid, list.filter((s) => s.source === "app" && !s.groupSessionId)]));
  return { ...db, version: DB_VERSION, moodCheckins: db.moodCheckins ?? seedMoodCheckins(seededSessions, now) };
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
