import type {
  CoachLink,
  Invite,
  SessionSummary,
  UserProfile,
  WaitlistEntry,
} from "@/lib/domain/types";
import { DEMO_ATHLETE, DEMO_COACH, DEMO_PASSWORD, seedSessions } from "./seed";

// The local adapter's "database": one JSON document, persisted to
// localStorage in the browser and kept in memory everywhere else (tests,
// prerendering). Development only — passwords are stored in plain text.

export interface LocalAccount {
  password: string;
  profile: UserProfile;
}

export interface LocalDb {
  version: 1;
  accounts: Record<string, LocalAccount>;
  sessions: Record<string, SessionSummary[]>;
  coachLinks: CoachLink[];
  invites: Invite[];
  waitlist: (WaitlistEntry & { createdAt: string })[];
  currentUid: string | null;
}

export const STORAGE_KEY = "breathband-console:local-db";

export function createSeededDb(now = new Date()): LocalDb {
  return {
    version: 1,
    accounts: {
      [DEMO_ATHLETE.uid]: { password: DEMO_PASSWORD, profile: DEMO_ATHLETE },
      [DEMO_COACH.uid]: { password: DEMO_PASSWORD, profile: DEMO_COACH },
    },
    sessions: { [DEMO_ATHLETE.uid]: seedSessions(DEMO_ATHLETE.uid, now) },
    coachLinks: [
      { coachId: DEMO_COACH.uid, athleteId: DEMO_ATHLETE.uid, createdAt: DEMO_COACH.createdAt },
    ],
    invites: [],
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
          if (parsed.version === 1) return parsed;
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
