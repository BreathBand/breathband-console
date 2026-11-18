import type { CoachLink, Invite, UserProfile } from "@/lib/domain/types";
import {
  BackendError,
  type AuthService,
  type AuthUser,
  type Backend,
  type DataService,
} from "../types";
import { browserStore, type DbStore, type LocalDb } from "./db";
import { generateWaveform } from "./seed";

// Local adapter: behaves like the Firebase setup will — including the access
// rules in firebase/firestore.rules — so screens hit the same permission and
// not-found paths in development that they will in production.

const LATENCY_MS = 150;
const INVITE_TTL_MS = 7 * 86_400_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LocalBackendOptions {
  store?: DbStore;
  /** Artificial delay so loading states are visible in development. 0 in tests. */
  latencyMs?: number;
  now?: () => Date;
}

export function createLocalBackend(options: LocalBackendOptions = {}): Backend {
  const store = options.store ?? browserStore();
  const latency = options.latencyMs ?? LATENCY_MS;
  const now = options.now ?? (() => new Date());
  const listeners = new Set<(user: AuthUser | null) => void>();

  const delay = () =>
    latency > 0 ? new Promise<void>((r) => setTimeout(r, latency)) : Promise.resolve();

  const mutate = (fn: (db: LocalDb) => void) => {
    const db = structuredClone(store.read());
    fn(db);
    store.write(db);
  };

  const toAuthUser = (profile: UserProfile): AuthUser => ({
    uid: profile.uid,
    email: profile.email,
    emailVerified: true,
  });

  const currentUser = (): AuthUser | null => {
    const db = store.read();
    const account = db.currentUid ? db.accounts[db.currentUid] : undefined;
    return account ? toAuthUser(account.profile) : null;
  };

  const emit = () => {
    const user = currentUser();
    listeners.forEach((l) => l(user));
  };

  const requireUser = (): AuthUser => {
    const user = currentUser();
    if (!user) throw new BackendError("not-signed-in");
    return user;
  };

  const isLinked = (db: LocalDb, coachId: string, athleteId: string) =>
    db.coachLinks.some((l) => l.coachId === coachId && l.athleteId === athleteId);

  // Mirrors `canReadAthlete` in firebase/firestore.rules.
  const assertCanRead = (athleteId: string) => {
    const user = requireUser();
    if (user.uid !== athleteId && !isLinked(store.read(), user.uid, athleteId)) {
      throw new BackendError("permission-denied");
    }
  };

  const assertIsSelf = (uid: string) => {
    if (requireUser().uid !== uid) throw new BackendError("permission-denied");
  };

  const auth: AuthService = {
    currentUser,

    onAuthStateChanged(callback) {
      listeners.add(callback);
      callback(currentUser());
      return () => listeners.delete(callback);
    },

    async signIn(email, password) {
      await delay();
      const account = Object.values(store.read().accounts).find(
        (a) => a.profile.email.toLowerCase() === email.trim().toLowerCase(),
      );
      if (!account || account.password !== password) {
        throw new BackendError("invalid-credentials");
      }
      mutate((db) => {
        db.currentUid = account.profile.uid;
      });
      emit();
      return toAuthUser(account.profile);
    },

    async signUp({ email, password, displayName, role }) {
      await delay();
      const normalized = email.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(normalized)) throw new BackendError("invalid-email");
      if (password.length < 8) throw new BackendError("weak-password");
      const taken = Object.values(store.read().accounts).some(
        (a) => a.profile.email.toLowerCase() === normalized,
      );
      if (taken) throw new BackendError("email-in-use");

      const profile: UserProfile = {
        uid: `local-${crypto.randomUUID()}`,
        email: normalized,
        displayName: displayName.trim(),
        role,
        createdAt: now().toISOString(),
      };
      mutate((db) => {
        db.accounts[profile.uid] = { password, profile };
        db.sessions[profile.uid] = [];
        db.currentUid = profile.uid;
      });
      emit();
      return toAuthUser(profile);
    },

    async sendPasswordReset() {
      // Firebase does not reveal whether the address has an account; neither do we.
      await delay();
    },

    async signOut() {
      mutate((db) => {
        db.currentUid = null;
      });
      emit();
    },
  };

  const data: DataService = {
    async getProfile(uid) {
      await delay();
      const self = requireUser();
      const db = store.read();
      if (uid !== self.uid && !isLinked(db, self.uid, uid) && !isLinked(db, uid, self.uid)) {
        throw new BackendError("permission-denied");
      }
      return db.accounts[uid]?.profile ?? null;
    },

    async listSessions(athleteId, { limit = 50, before } = {}) {
      await delay();
      assertCanRead(athleteId);
      const all = store.read().sessions[athleteId] ?? [];
      return all.filter((s) => !before || s.startedAt < before).slice(0, limit);
    },

    async getSession(athleteId, sessionId) {
      await delay();
      assertCanRead(athleteId);
      return (store.read().sessions[athleteId] ?? []).find((s) => s.id === sessionId) ?? null;
    },

    async getWaveform(session) {
      await delay();
      assertCanRead(session.athleteId);
      return generateWaveform(session);
    },

    async updateSessionNote(athleteId, sessionId, note) {
      await delay();
      assertIsSelf(athleteId);
      let found = false;
      mutate((db) => {
        const session = db.sessions[athleteId]?.find((s) => s.id === sessionId);
        if (session) {
          session.note = note;
          found = true;
        }
      });
      if (!found) throw new BackendError("not-found");
    },

    async listAthletes(coachId) {
      await delay();
      assertIsSelf(coachId);
      const db = store.read();
      return db.coachLinks
        .filter((l) => l.coachId === coachId)
        .map((l) => db.accounts[l.athleteId]?.profile)
        .filter((p): p is UserProfile => Boolean(p));
    },

    async listCoaches(athleteId) {
      await delay();
      assertIsSelf(athleteId);
      const db = store.read();
      return db.coachLinks
        .filter((l) => l.athleteId === athleteId)
        .map((l) => db.accounts[l.coachId]?.profile)
        .filter((p): p is UserProfile => Boolean(p));
    },

    async createInvite(athleteId) {
      await delay();
      assertIsSelf(athleteId);
      const invite: Invite = {
        code: inviteCode(),
        athleteId,
        expiresAt: new Date(now().getTime() + INVITE_TTL_MS).toISOString(),
      };
      mutate((db) => {
        db.invites.push(invite);
      });
      return invite;
    },

    // In production this runs in a Cloud Function: clients can't read invites
    // or create coach links directly (see firebase/firestore.rules).
    async redeemInvite(coachId, code) {
      await delay();
      assertIsSelf(coachId);
      const normalized = code.trim().toUpperCase();
      const db = store.read();
      const invite = db.invites.find((i) => i.code === normalized);
      if (!invite || invite.expiresAt < now().toISOString() || invite.athleteId === coachId) {
        throw new BackendError("invite-invalid");
      }
      const link: CoachLink = {
        coachId,
        athleteId: invite.athleteId,
        createdAt: now().toISOString(),
      };
      mutate((d) => {
        d.invites = d.invites.filter((i) => i.code !== normalized);
        if (!isLinked(d, coachId, invite.athleteId)) d.coachLinks.push(link);
      });
      return link;
    },

    async revokeCoach(athleteId, coachId) {
      await delay();
      assertIsSelf(athleteId);
      mutate((db) => {
        db.coachLinks = db.coachLinks.filter(
          (l) => !(l.athleteId === athleteId && l.coachId === coachId),
        );
      });
    },

    async joinWaitlist({ email, source }) {
      await delay();
      const normalized = email.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(normalized)) throw new BackendError("invalid-email");
      mutate((db) => {
        if (!db.waitlist.some((w) => w.email === normalized)) {
          db.waitlist.push({ email: normalized, source, createdAt: now().toISOString() });
        }
      });
    },
  };

  return { kind: "local", auth, data };
}

/** 8 characters, no look-alikes (0/O, 1/I). */
function inviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
