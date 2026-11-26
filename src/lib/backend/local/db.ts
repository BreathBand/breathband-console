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

// Bump when the seed or the shape changes, so browsers holding older demo data reseed.
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

export function browserStore(): DbStore {
  const fallback = memoryStore();
  const storage = typeof window === "undefined" ? null : safeLocalStorage();
  if (!storage) return fallback;

  return {
    read() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as LocalDb;
          if (parsed.version === DB_VERSION) return parsed;
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
