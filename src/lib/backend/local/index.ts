import { ageGateProblem, CONSENT_KINDS, CONSENT_VERSIONS, consentsProblem } from "@/lib/domain/consent";
import { GROUP_SIZE, pacerAt } from "@/lib/domain/group";
import { isTransitionScores } from "@/lib/domain/scores";
import { goalPlanProblem } from "@/lib/domain/goal-questions";
import { gamificationProblem } from "@/lib/domain/habit";
import { invitePractice, practiceAssignment } from "@/lib/domain/invite-context";
import { moodsProblem } from "@/lib/domain/mood";
import { onboardingProblem } from "@/lib/domain/onboarding";
import { proProblem } from "@/lib/domain/pro-profile";
import { proTermsProblem } from "@/lib/domain/pro-terms";
import { preferencesProblem } from "@/lib/domain/preferences";
import {
  type Assignment,
  type CoachInvite,
  type CoachLink,
  type GroupSession,
  type Invite,
  type MoodCheckin,
  type SessionComment,
  type SessionSummary,
  type Squad,
  type UserProfile,
  type Waveform,
} from "@/lib/domain/types";
import {
  BackendError,
  type AccountDeletion,
  type AuthService,
  type AuthUser,
  type Backend,
  type DataService,
} from "../types";
import { browserStore, type DbStore, type LocalDb } from "./db";
import { joinOffset, LIVE_HZ, liveProfile, liveSample, presenceAt, recordGroupSession } from "./live";
import { generateWaveform } from "./seed";
import { calibrationProblem, checkSessionContract } from "./validate";
import { eventsProblem } from "@/lib/domain/events";

// Local adapter: behaves like the Firebase setup will — including the access
// rules in firebase/firestore.rules — so screens hit the same permission and
// not-found paths in development that they will in production.

const LATENCY_MS = 150;
const INVITE_TTL_MS = 7 * 86_400_000;
const COACH_INVITE_TTL_MS = 14 * 86_400_000;
/** As server/jobs/deletion.ts: an account is deleted 24 hours after the request. */
const DELETION_DELAY_MS = 86_400_000;
/** The browser keeps the newest product events only: they're for looking at in development. */
const MAX_LOCAL_EVENTS = 1000;
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

  const deletionOf = (db: LocalDb, uid: string): AccountDeletion | null => {
    const requestedAt = db.accountDeletions?.[uid];
    return requestedAt ? { requestedAt, deleteAfter: new Date(Date.parse(requestedAt) + DELETION_DELAY_MS).toISOString() } : null;
  };

  /** What server/jobs/deletion.ts does 24 hours after the request: the account and everything it owns go. */
  const purge = (db: LocalDb, uid: string) => {
    delete db.accounts[uid];
    delete db.sessions[uid];
    delete db.assignments[uid];
    delete db.comments[uid];
    delete db.seen[uid];
    delete db.squads[uid];
    delete db.alertRules[uid];
    delete db.moodCheckins[uid];
    delete db.accountDeletions?.[uid];
    delete db.calibrations?.[uid];
    db.events = (db.events ?? []).filter((e) => e.uid !== uid);
    db.coachLinks = db.coachLinks.filter((l) => l.coachId !== uid && l.athleteId !== uid);
    db.invites = db.invites.filter((i) => i.athleteId !== uid);
    db.coachInvites = db.coachInvites.filter((i) => i.coachId !== uid);
    db.accessLog = (db.accessLog ?? []).filter((e) => e.athleteId !== uid && e.viewerId !== uid);
    for (const key of Object.keys(db.coachNotes)) if (key.split("_").includes(uid)) delete db.coachNotes[key];
  };

  const findLink = (db: LocalDb, coachId: string, athleteId: string) =>
    db.coachLinks.find((l) => l.coachId === coachId && l.athleteId === athleteId);
  const isLinked = (db: LocalDb, coachId: string, athleteId: string) => Boolean(findLink(db, coachId, athleteId));

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

  const profileOf = (uid: string) => {
    const profile = store.read().accounts[uid]?.profile;
    if (!profile) throw new BackendError("not-found");
    return profile;
  };

  const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

  // Bumped on every group-session write, so live watchers re-read only when something changed.
  let groupVersion = 0;

  /** Seconds since a group session started, capped at its planned length. */
  const elapsed = (g: GroupSession) =>
    g.startedAt ? Math.min(g.durationSec, Math.max(0, (now().getTime() - Date.parse(g.startedAt)) / 1000)) : 0;

  /** Host-only change to a group session in one of the allowed states. Mirrors firestore.rules. */
  const changeGroup = (id: string, from: GroupSession["status"][], fn: (g: GroupSession, db: LocalDb) => void) => {
    const user = requireUser();
    const existing = store.read().groupSessions.find((g) => g.id === id);
    if (!existing) throw new BackendError("not-found");
    if (existing.hostId !== user.uid) throw new BackendError("permission-denied");
    if (!from.includes(existing.status)) throw new BackendError("invalid-input");
    let updated = existing;
    mutate((db) => {
      const g = db.groupSessions.find((x) => x.id === id)!;
      fn(g, db);
      updated = g;
    });
    groupVersion++;
    return updated;
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
      const due = account && deletionOf(store.read(), account.profile.uid);
      if (account && due && Date.parse(due.deleteAfter) <= now().getTime()) {
        mutate((db) => purge(db, account.profile.uid));
        throw new BackendError("invalid-credentials");
      }
      if (!account || account.password !== password) {
        throw new BackendError("invalid-credentials");
      }
      mutate((db) => {
        db.currentUid = account.profile.uid;
      });
      emit();
      return toAuthUser(account.profile);
    },

    async signUp({ email, password, displayName, role, consents, birthYear }) {
      await delay();
      const normalized = email.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(normalized)) throw new BackendError("invalid-email");
      if (password.length < 8) throw new BackendError("weak-password");
      // Mirrors the users/{uid} create rule in firebase/firestore.rules.
      const tooYoung = ageGateProblem(birthYear, now());
      if (tooYoung) {
        throw tooYoung.code === "under-age"
          ? new BackendError("under-age", tooYoung.message)
          : new BackendError("invalid-input", `birthYear: ${tooYoung.message}`);
      }
      const missing = consentsProblem(consents);
      if (missing) throw new BackendError("invalid-input", missing);
      const taken = Object.values(store.read().accounts).some(
        (a) => a.profile.email.toLowerCase() === normalized,
      );
      if (taken) throw new BackendError("email-in-use");

      const createdAt = now().toISOString();
      const profile: UserProfile = {
        uid: `local-${crypto.randomUUID()}`,
        email: normalized,
        displayName: displayName.trim(),
        role,
        createdAt,
        consents: CONSENT_KINDS.map((kind) => ({ kind, version: CONSENT_VERSIONS[kind], acceptedAt: createdAt })),
        birthYear,
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

    async sendVerificationEmail() {
      // Local accounts are confirmed from the start, and there's no email to send.
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
      const profile = db.accounts[uid]?.profile ?? null;
      if (!profile || uid === self.uid) return profile;
      // As the API does: the other side of a link never sees birth year or consents.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { birthYear, consents, ...shared } = profile;
      return shared;
    },

    async updateProfile(uid, { displayName, preferences, proKind, proProfile, proConsents }) {
      await delay();
      assertIsSelf(uid);
      const name = displayName?.trim();
      if (displayName !== undefined && !name) throw new BackendError("invalid-input", "displayName: empty");
      if (preferences) {
        const problem =
          preferencesProblem(preferences) ??
          goalPlanProblem(preferences) ??
          onboardingProblem(preferences.onboarding) ??
          gamificationProblem(preferences.gamification);
        if (problem) throw new BackendError("invalid-input", problem);
      }
      if (proKind !== undefined || proProfile !== undefined || proConsents !== undefined) {
        // Mirrors the users/{uid} update rule: professionals only, and the profile's kind matches.
        const current = profileOf(uid);
        if (current.role !== "coach") throw new BackendError("permission-denied", "proKind, proProfile, proConsents: professionals only");
        // An explicit null (untyped callers) is checked like any other value, never read as "keep".
        const kind = proKind !== undefined ? proKind : current.proKind;
        const problem = proProblem(kind, proProfile !== undefined ? proProfile : current.proProfile);
        if (problem) throw new BackendError("invalid-input", problem);
        if (proConsents !== undefined) {
          // The terms belong to a kind of work, so there has to be one.
          if (!kind) throw new BackendError("invalid-input", "proConsents: needs proKind");
          const terms = proTermsProblem(kind, proConsents);
          if (terms) throw new BackendError("invalid-input", terms);
        }
      }
      const stampedAt = now().toISOString();
      mutate((db) => {
        const profile = db.accounts[uid].profile;
        if (name) profile.displayName = name.slice(0, 80);
        if (preferences !== undefined) profile.preferences = preferences ? structuredClone(preferences) : null;
        if (proKind !== undefined) profile.proKind = proKind;
        if (proProfile !== undefined) profile.proProfile = structuredClone(proProfile);
        if (proConsents) {
          // Appended after sign-up's records, never replacing them; a kind already held at this version isn't added twice.
          const held = profile.consents ?? [];
          const fresh = proConsents.filter((c) => !held.some((h) => h.kind === c.kind && h.version === c.version));
          if (fresh.length) profile.consents = [...held, ...fresh.map((c) => ({ kind: c.kind, version: c.version, acceptedAt: stampedAt }))];
        }
      });
      const profile = profileOf(uid);
      emit();
      return profile;
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
      const session = (store.read().sessions[athleteId] ?? []).find((s) => s.id === sessionId) ?? null;
      const viewerId = requireUser().uid;
      if (session && viewerId !== athleteId) {
        mutate((db) => {
          db.accessLog = [...(db.accessLog ?? []), { viewerId, athleteId, sessionId, at: now().toISOString() }];
        });
      }
      return session;
    },

    // Mirrors storage.rules: coaches need the "curves" scope for the signal.
    async getWaveform(session) {
      await delay();
      assertCanRead(session.athleteId);
      const user = requireUser();
      if (user.uid !== session.athleteId && findLink(store.read(), user.uid, session.athleteId)?.scope !== "curves") {
        throw new BackendError("permission-denied");
      }
      return store.read().recordedWaveforms[session.waveformPath] ?? generateWaveform(session);
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

    // Mirrors firestore.rules (create: isSelf, athleteId == uid) and storage.rules (own waveform, < 5 MB).
    async saveSession(athleteId, session, waveform) {
      await delay();
      assertIsSelf(athleteId);
      if (!(session.durationSec > 0) || waveform.user.length === 0) throw new BackendError("invalid-input", "empty recording");
      if (waveform.pacer && waveform.pacer.length !== waveform.user.length) {
        throw new BackendError("invalid-input", "pacer and user signals differ in length");
      }
      const id = newId("s");
      const saved: SessionSummary = {
        ...session,
        id,
        athleteId,
        waveformPath: `waveforms/${athleteId}/${id}.json.gz`,
        note: session.note.trim().slice(0, 2000),
      };
      checkSessionContract(saved, waveform);
      if (JSON.stringify(waveform).length > 5 * 1024 * 1024) throw new BackendError("invalid-input", "signal over 5 MB");
      mutate((db) => {
        db.sessions[athleteId] = [saved, ...(db.sessions[athleteId] ?? [])].sort((a, b) =>
          b.startedAt.localeCompare(a.startedAt),
        );
        db.recordedWaveforms[saved.waveformPath] = waveform;
      });
      return saved;
    },

    async deleteSession(athleteId, sessionId) {
      await delay();
      assertIsSelf(athleteId);
      let found = false;
      mutate((db) => {
        const session = db.sessions[athleteId]?.find((s) => s.id === sessionId);
        if (!session) return;
        found = true;
        db.sessions[athleteId] = db.sessions[athleteId].filter((s) => s.id !== sessionId);
        delete db.recordedWaveforms[session.waveformPath];
        db.comments[athleteId] = (db.comments[athleteId] ?? []).filter((c) => c.sessionId !== sessionId);
        for (const coachId of Object.keys(db.seen)) {
          db.seen[coachId] = db.seen[coachId].filter((key) => key !== `${athleteId}/${sessionId}`);
        }
        // Mirrors the server's `on delete set null` (and the moodCheckins update rule): the check-ins stay, unlinked.
        for (const c of db.moodCheckins[athleteId] ?? []) {
          if (c.sessionId === sessionId) c.sessionId = null;
        }
      });
      if (!found) throw new BackendError("not-found");
    },

    // Mirrors firestore.rules users/{uid}/moodCheckins: the person's own, on one of their sessions, 1–5.
    async saveMoodCheckins(athleteId, sessionId, moods) {
      await delay();
      assertIsSelf(athleteId);
      const problem = moodsProblem(moods);
      if (problem) throw new BackendError("invalid-input", problem);
      const session = (store.read().sessions[athleteId] ?? []).find((s) => s.id === sessionId);
      if (!session) throw new BackendError("not-found");
      // The before check-in was taken as the session began; the after one is stored now.
      const at = { before: session.startedAt, after: now().toISOString() };
      const saved: MoodCheckin[] = (["after", "before"] as const).flatMap((phase) => {
        const mood = moods[phase];
        return mood === null ? [] : [{ id: newId("m"), athleteId, sessionId, phase, mood, createdAt: at[phase] }];
      });
      mutate((db) => {
        const others = (db.moodCheckins[athleteId] ?? []).filter((c) => c.sessionId !== sessionId);
        db.moodCheckins[athleteId] = [...saved, ...others].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
      return saved;
    },

    async listMoodCheckins(athleteId, { limit = 200 } = {}) {
      await delay();
      assertIsSelf(athleteId);
      return (store.read().moodCheckins[athleteId] ?? []).slice(0, limit);
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

    async getCoachLink(coachId, athleteId) {
      await delay();
      const user = requireUser();
      if (user.uid !== coachId && user.uid !== athleteId) throw new BackendError("permission-denied");
      return findLink(store.read(), coachId, athleteId) ?? null;
    },

    async setCoachScope(athleteId, coachId, scope) {
      await delay();
      assertIsSelf(athleteId);
      let found = false;
      mutate((db) => {
        const link = findLink(db, coachId, athleteId);
        if (link) {
          link.scope = scope;
          found = true;
        }
      });
      if (!found) throw new BackendError("not-found");
    },

    async createInvite(athleteId, scope = "curves") {
      await delay();
      assertIsSelf(athleteId);
      const invite: Invite = {
        code: inviteCode(),
        athleteId,
        scope,
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
      if (!invite || invite.expiresAt < now().toISOString() || invite.athleteId === coachId || db.accounts[coachId]?.profile.role !== "coach") {
        throw new BackendError("invite-invalid");
      }
      const link: CoachLink = {
        coachId,
        athleteId: invite.athleteId,
        scope: invite.scope,
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

    async listAssignments(athleteId) {
      await delay();
      assertCanRead(athleteId);
      return store.read().assignments[athleteId] ?? [];
    },

    async createAssignment(coachId, input) {
      await delay();
      assertIsSelf(coachId);
      if (!isLinked(store.read(), coachId, input.athleteId)) throw new BackendError("permission-denied");
      if (
        !Number.isInteger(input.target) ||
        input.target < 1 ||
        input.target > 30 ||
        input.durationSec < 60 ||
        (input.mode === "paced") !== (input.pacerHalfCycleSec !== null) ||
        input.dueAt <= now().toISOString()
      ) {
        throw new BackendError("invalid-input");
      }
      const assignment: Assignment = {
        ...input,
        note: input.note.trim().slice(0, 500),
        id: newId("a"),
        coachId,
        createdAt: now().toISOString(),
        cancelled: false,
      };
      mutate((db) => {
        db.assignments[input.athleteId] = [assignment, ...(db.assignments[input.athleteId] ?? [])];
      });
      return assignment;
    },

    async cancelAssignment(athleteId, assignmentId) {
      await delay();
      const user = requireUser();
      const existing = store.read().assignments[athleteId]?.find((a) => a.id === assignmentId);
      if (!existing) throw new BackendError("not-found");
      if (existing.coachId !== user.uid) throw new BackendError("permission-denied");
      mutate((db) => {
        db.assignments[athleteId].find((a) => a.id === assignmentId)!.cancelled = true;
      });
    },

    async listComments(athleteId, sessionId) {
      await delay();
      assertCanRead(athleteId);
      const all = store.read().comments[athleteId] ?? [];
      return sessionId ? all.filter((c) => c.sessionId === sessionId) : all;
    },

    async addComment(athleteId, sessionId, { kind, text }) {
      await delay();
      assertCanRead(athleteId);
      const author = profileOf(requireUser().uid);
      const db = store.read();
      if (!db.sessions[athleteId]?.some((s) => s.id === sessionId)) throw new BackendError("not-found");
      const body = kind === "kudos" ? "" : text.trim().slice(0, 1000);
      if (kind === "comment" && !body) throw new BackendError("invalid-input");
      if (kind === "kudos") {
        const existing = (db.comments[athleteId] ?? []).find(
          (c) => c.sessionId === sessionId && c.kind === "kudos" && c.authorId === author.uid,
        );
        if (existing) return existing;
      }
      const comment: SessionComment = {
        id: newId("c"),
        athleteId,
        sessionId,
        authorId: author.uid,
        authorName: author.displayName,
        authorRole: author.role,
        kind,
        text: body,
        createdAt: now().toISOString(),
      };
      mutate((d) => {
        d.comments[athleteId] = [...(d.comments[athleteId] ?? []), comment];
      });
      return comment;
    },

    async deleteComment(athleteId, sessionId, commentId) {
      await delay();
      const user = requireUser();
      const existing = store.read().comments[athleteId]?.find((c) => c.id === commentId && c.sessionId === sessionId);
      if (!existing) throw new BackendError("not-found");
      if (existing.authorId !== user.uid) throw new BackendError("permission-denied");
      mutate((db) => {
        db.comments[athleteId] = db.comments[athleteId].filter((c) => c.id !== commentId);
      });
    },

    async listSeenSessions(coachId) {
      await delay();
      assertIsSelf(coachId);
      return store.read().seen[coachId] ?? [];
    },

    async markSessionSeen(coachId, athleteId, sessionId) {
      // No artificial delay: this runs in the background when a review opens.
      assertIsSelf(coachId);
      const key = `${athleteId}/${sessionId}`;
      if (store.read().seen[coachId]?.includes(key)) return;
      mutate((db) => {
        db.seen[coachId] = [...(db.seen[coachId] ?? []), key];
      });
    },

    async getCoachNote(coachId, athleteId) {
      await delay();
      assertIsSelf(coachId);
      return store.read().coachNotes[`${coachId}_${athleteId}`] ?? "";
    },

    async saveCoachNote(coachId, athleteId, text) {
      await delay();
      assertIsSelf(coachId);
      if (!isLinked(store.read(), coachId, athleteId)) throw new BackendError("permission-denied");
      mutate((db) => {
        db.coachNotes[`${coachId}_${athleteId}`] = text.slice(0, 5000);
      });
    },

    async setTargets(coachId, athleteId, targets) {
      await delay();
      assertIsSelf(coachId);
      const { score, rateLow, rateHigh, sessionsPerWeek } = targets;
      if (
        !(score >= 1 && score <= 10) ||
        !(rateLow >= 4 && rateHigh <= 40 && rateLow < rateHigh) ||
        !Number.isInteger(sessionsPerWeek) ||
        sessionsPerWeek < 1 ||
        sessionsPerWeek > 21
      ) {
        throw new BackendError("invalid-input");
      }
      let found = false;
      mutate((db) => {
        const link = findLink(db, coachId, athleteId);
        if (link) {
          link.targets = { score, rateLow, rateHigh, sessionsPerWeek };
          found = true;
        }
      });
      if (!found) throw new BackendError("permission-denied");
    },

    async listSquads(coachId) {
      await delay();
      assertIsSelf(coachId);
      return [...(store.read().squads[coachId] ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    },

    async saveSquad(coachId, { id, name, athleteIds }) {
      await delay();
      assertIsSelf(coachId);
      const db = store.read();
      const clean = name.trim().slice(0, 40);
      const members = [...new Set(athleteIds)];
      if (!clean) throw new BackendError("invalid-input");
      if (members.some((a) => !isLinked(db, coachId, a))) throw new BackendError("permission-denied");
      const existing = id ? db.squads[coachId]?.find((s) => s.id === id) : undefined;
      if (id && !existing) throw new BackendError("not-found");
      const squad: Squad = {
        id: existing?.id ?? newId("q"),
        name: clean,
        athleteIds: members,
        createdAt: existing?.createdAt ?? now().toISOString(),
      };
      mutate((d) => {
        d.squads[coachId] = [...(d.squads[coachId] ?? []).filter((s) => s.id !== squad.id), squad];
      });
      return squad;
    },

    async deleteSquad(coachId, squadId) {
      await delay();
      assertIsSelf(coachId);
      mutate((db) => {
        db.squads[coachId] = (db.squads[coachId] ?? []).filter((s) => s.id !== squadId);
      });
    },

    async getAlertRules(coachId) {
      await delay();
      assertIsSelf(coachId);
      return store.read().alertRules[coachId] ?? null;
    },

    async saveAlertRules(coachId, rules) {
      await delay();
      assertIsSelf(coachId);
      const positive = (n: number | null, max: number) => n === null || (n > 0 && n <= max);
      if (!positive(rules.missedDays, 60) || !positive(rules.scoreDrop, 9) || !positive(rules.belowTarget, 5)) {
        throw new BackendError("invalid-input");
      }
      mutate((db) => {
        db.alertRules[coachId] = { ...rules };
      });
    },

    async createCoachInvite(coachId, { athleteName, contact, practice }) {
      await delay();
      assertIsSelf(coachId);
      const coach = profileOf(coachId);
      if (coach.role !== "coach") throw new BackendError("permission-denied");
      const name = athleteName.trim().slice(0, 80);
      const to = contact.trim().slice(0, 120);
      if (!name || !(EMAIL_PATTERN.test(to) || /^\+?[\d\s()-]{7,}$/.test(to))) throw new BackendError("invalid-input");
      // Practice set with the invite must be one of the professional's kind's session or plan templates.
      const template = practice == null ? null : invitePractice(coach.proKind ?? coach.proProfile?.kind, practice);
      if (practice != null && !template) throw new BackendError("invalid-input", "practice: one of your kind's session or plan templates");
      const invite: CoachInvite = {
        code: inviteCode(),
        coachId,
        coachName: coach.displayName,
        athleteName: name,
        contact: to,
        createdAt: now().toISOString(),
        expiresAt: new Date(now().getTime() + COACH_INVITE_TTL_MS).toISOString(),
        status: "pending",
        athleteId: null,
        ...(template ? { practice: template.id } : {}),
      };
      mutate((db) => {
        db.coachInvites = [invite, ...db.coachInvites];
      });
      return invite;
    },

    async listCoachInvites(coachId) {
      await delay();
      assertIsSelf(coachId);
      return store.read().coachInvites.filter((i) => i.coachId === coachId);
    },

    async revokeCoachInvite(coachId, code) {
      await delay();
      assertIsSelf(coachId);
      mutate((db) => {
        const invite = db.coachInvites.find((i) => i.code === code && i.coachId === coachId);
        if (invite?.status === "pending") invite.status = "revoked";
      });
    },

    async getCoachInvite(code) {
      await delay();
      requireUser();
      const invite = store.read().coachInvites.find((i) => i.code === code.trim().toUpperCase());
      if (!invite) return null;
      const { coachId, coachName, expiresAt, status } = invite;
      // Who's asking, in their own terms, and what they ask to see (T-0123). In production the
      // Cloud Function that serves the lookup reads these from the professional's profile.
      const coach = store.read().accounts[coachId]?.profile;
      const coachKind = coach?.proKind ?? coach?.proProfile?.kind ?? null;
      return {
        code: invite.code,
        coachId,
        coachName,
        expiresAt,
        status,
        practice: invite.practice ?? null,
        coachKind,
        coachProfession: coach?.proProfile?.profession ?? null,
        scopeRequested: coach?.proProfile?.scopeRequested ?? null,
      };
    },

    // Anyone, signed in or not (T-0129). Only a pending, unexpired invite answers, with the minimum;
    // every other code is null. In production a rate-limited endpoint serves it (the API per IP; on
    // Firebase a Cloud Function, since firestore.rules can't rate-limit a read).
    async getPublicCoachInvite(code) {
      await delay();
      const db = store.read();
      const invite = db.coachInvites.find((i) => i.code === code.trim().toUpperCase());
      if (!invite || invite.status !== "pending" || invite.expiresAt <= now().toISOString()) return null;
      const coach = db.accounts[invite.coachId]?.profile;
      return {
        coachName: invite.coachName,
        coachKind: coach?.proKind ?? coach?.proProfile?.kind ?? null,
        coachProfession: coach?.proProfile?.profession ?? null,
        scopeRequested: coach?.proProfile?.scopeRequested ?? null,
        practice: invite.practice ?? null,
      };
    },

    // In production this runs in a Cloud Function, like redeemInvite.
    async respondToCoachInvite(athleteId, code, answer) {
      await delay();
      assertIsSelf(athleteId);
      if (profileOf(athleteId).role !== "athlete") throw new BackendError("permission-denied");
      const normalized = code.trim().toUpperCase();
      const invite = store.read().coachInvites.find((i) => i.code === normalized);
      if (!invite || invite.status !== "pending" || invite.expiresAt < now().toISOString()) {
        throw new BackendError("invite-invalid");
      }
      if (!answer.accept) {
        mutate((db) => {
          db.coachInvites.find((i) => i.code === normalized)!.status = "declined";
        });
        return null;
      }
      const link: CoachLink = {
        coachId: invite.coachId,
        athleteId,
        scope: answer.scope,
        createdAt: now().toISOString(),
      };
      // Practice set with the invite becomes the person's assignment, set by the professional, due from today.
      const coach = store.read().accounts[invite.coachId]?.profile;
      const template = invitePractice(coach?.proKind ?? coach?.proProfile?.kind, invite.practice);
      const assignment: Assignment | null = template
        ? {
            ...practiceAssignment(template, now()),
            id: newId("a"),
            coachId: invite.coachId,
            athleteId,
            createdAt: now().toISOString(),
            cancelled: false,
          }
        : null;
      mutate((db) => {
        const i = db.coachInvites.find((x) => x.code === normalized)!;
        i.status = "accepted";
        i.athleteId = athleteId;
        const existing = findLink(db, invite.coachId, athleteId);
        if (existing) existing.scope = answer.scope;
        else db.coachLinks.push(link);
        if (assignment) db.assignments[athleteId] = [assignment, ...(db.assignments[athleteId] ?? [])];
      });
      return findLink(store.read(), invite.coachId, athleteId) ?? link;
    },

    async createGroupSession(hostId, { title, athleteIds, pacerHalfCycleSec, durationSec }) {
      await delay();
      assertIsSelf(hostId);
      const host = profileOf(hostId);
      const db = store.read();
      const ids = [...new Set(athleteIds)];
      if (host.role !== "coach") throw new BackendError("permission-denied");
      if (ids.some((id) => !isLinked(db, hostId, id))) throw new BackendError("permission-denied");
      if (
        ids.length < GROUP_SIZE.min ||
        ids.length > GROUP_SIZE.max ||
        ![2, 5].includes(pacerHalfCycleSec) ||
        durationSec < 60 ||
        durationSec > 1800
      ) {
        throw new BackendError("invalid-input");
      }
      const group: GroupSession = {
        id: newId("g"),
        hostId,
        hostName: host.displayName,
        title: title.trim().slice(0, 80) || "Group session",
        athleteIds: ids,
        pacerHalfCycleSec,
        durationSec,
        status: "lobby",
        createdAt: now().toISOString(),
        startedAt: null,
        endedAt: null,
        pacerChanges: [],
        markers: [],
        results: {},
        groupAverage: null,
      };
      mutate((d) => {
        d.groupSessions = [group, ...d.groupSessions];
      });
      return group;
    },

    async getGroupSession(id) {
      await delay();
      const user = requireUser();
      const group = store.read().groupSessions.find((g) => g.id === id);
      if (!group) return null;
      if (group.hostId !== user.uid && !group.athleteIds.includes(user.uid)) throw new BackendError("permission-denied");
      return group;
    },

    async listGroupSessions(uid) {
      await delay();
      assertIsSelf(uid);
      return store.read().groupSessions.filter((g) => g.hostId === uid || g.athleteIds.includes(uid));
    },

    async startGroupSession(id) {
      await delay();
      return changeGroup(id, ["lobby"], (g) => {
        g.status = "live";
        g.startedAt = now().toISOString();
      });
    },

    async setGroupPacer(id, pacerHalfCycleSec) {
      await delay();
      return changeGroup(id, ["live"], (g) => {
        if (pacerAt(g, elapsed(g)) !== pacerHalfCycleSec) {
          g.pacerChanges.push({ atSec: Math.round(elapsed(g) * 10) / 10, pacerHalfCycleSec });
        }
      });
    },

    async addGroupMarker(id) {
      await delay();
      return changeGroup(id, ["live"], (g) => {
        g.markers.push(Math.round(elapsed(g) * 10) / 10);
      });
    },

    // In production each athlete's app saves its own session and a Cloud
    // Function fills in `results` and `groupAverage`; here we play all parts.
    async endGroupSession(id) {
      await delay();
      const db = store.read();
      const current = db.groupSessions.find((g) => g.id === id);
      const recorded: { summary: SessionSummary; waveform: Waveform }[] = [];
      if (current?.status === "live") {
        const length = elapsed(current);
        for (const athleteId of current.athleteIds) {
          const profile = liveProfile(current, athleteId, db.sessions[athleteId] ?? []);
          if (joinOffset(profile, current) >= length) continue; // never joined
          const saved = recordGroupSession(profile, current, length, newId("s"));
          if (saved) recorded.push(saved);
        }
      }
      for (const { summary, waveform } of recorded) checkSessionContract(summary, waveform);
      return changeGroup(id, ["live"], (g, d) => {
        g.status = "ended";
        g.endedAt = now().toISOString();
        for (const { summary, waveform } of recorded) {
          d.sessions[summary.athleteId] = [summary, ...(d.sessions[summary.athleteId] ?? [])];
          d.recordedWaveforms[summary.waveformPath] = waveform;
          g.results[summary.athleteId] = summary.id;
        }
        const totals = recorded.flatMap(({ summary }) => (isTransitionScores(summary.scores) ? [summary.scores.total] : []));
        g.groupAverage = totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null;
      });
    },

    async cancelGroupSession(id) {
      await delay();
      await changeGroup(id, ["lobby"], (g) => {
        g.status = "cancelled";
        g.endedAt = now().toISOString();
      });
    },

    watchGroupLive(id, handlers) {
      const user = requireUser();
      const read = () => store.read().groupSessions.find((g) => g.id === id);
      let group = read();
      if (!group) throw new BackendError("not-found");
      if (group.hostId !== user.uid) throw new BackendError("permission-denied");

      const db = store.read();
      const profiles = group.athleteIds.map((a) => liveProfile(group!, a, db.sessions[a] ?? []));
      // Athletes who share scores only keep their curve private, live too.
      const hidden = new Set(group.athleteIds.filter((a) => findLink(db, user.uid, a)?.scope !== "curves"));
      let seenVersion = groupVersion;
      let lastPresence = "";
      let lastIndex = -1;

      const tick = () => {
        if (seenVersion !== groupVersion) {
          seenVersion = groupVersion;
          group = read() ?? group;
        }
        const g = group!;
        const nowMs = now().getTime();
        const presence = Object.fromEntries(profiles.map((p) => [p.athleteId, presenceAt(p, g, nowMs)]));
        const key = JSON.stringify(presence);
        if (key !== lastPresence) {
          lastPresence = key;
          handlers.onPresence(presence);
        }
        if (g.status !== "live" || !g.startedAt) return;

        const start = Date.parse(g.startedAt);
        const upTo = Math.floor(Math.min(g.durationSec, (nowMs - start) / 1000) * LIVE_HZ);
        // Catch up on frames missed while the tab was throttled, up to 40 s.
        for (let i = Math.max(lastIndex + 1, upTo - 40 * LIVE_HZ); i <= upTo; i++) {
          const t = i / LIVE_HZ;
          const samples: Record<string, number | null> = {};
          for (const p of profiles) {
            samples[p.athleteId] =
              !hidden.has(p.athleteId) && presenceAt(p, g, start + t * 1000) === "joined" ? liveSample(p, g, t) : null;
          }
          handlers.onFrame({ t, samples });
        }
        lastIndex = Math.max(lastIndex, upTo);
      };
      tick();
      const timer = setInterval(tick, 1000 / LIVE_HZ);
      return () => clearInterval(timer);
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

    async getAccountDeletion() {
      await delay();
      return deletionOf(store.read(), requireUser().uid);
    },

    async requestAccountDeletion(password) {
      await delay();
      const uid = requireUser().uid;
      if (store.read().accounts[uid]?.password !== password) throw new BackendError("invalid-credentials", "That password isn't right.");
      mutate((db) => {
        // Asking twice keeps the first request's clock, as on the API.
        db.accountDeletions = { [uid]: now().toISOString(), ...db.accountDeletions };
        db.currentUid = null;
      });
      emit();
      return deletionOf(store.read(), uid)!;
    },

    async cancelAccountDeletion() {
      await delay();
      const uid = requireUser().uid;
      if (!deletionOf(store.read(), uid)) throw new BackendError("not-found", "No deletion is waiting.");
      mutate((db) => {
        delete db.accountDeletions?.[uid];
    delete db.calibrations?.[uid];
      });
    },

    async exportMyData() {
      await delay();
      const uid = requireUser().uid;
      const db = store.read();
      const mine = <T extends { coachId?: string; athleteId?: string }>(rows: T[]) => rows.filter((r) => r.coachId === uid || r.athleteId === uid);
      return {
        exportedAt: now().toISOString(),
        profile: db.accounts[uid]?.profile ?? null,
        sessions: db.sessions[uid] ?? [],
        assignments: db.assignments[uid] ?? [],
        comments: db.comments[uid] ?? [],
        mood_checkins: db.moodCheckins[uid] ?? [],
        coach_links: mine(db.coachLinks),
        invites: db.invites.filter((i) => i.athleteId === uid),
        coach_invites: db.coachInvites.filter((i) => i.coachId === uid),
        squads: db.squads[uid] ?? [],
        alert_rules: db.alertRules[uid] ?? null,
        calibrations: (db.calibrations?.[uid] ?? []).map(({ source, bandName, at }) => ({ source, bandName, at })),
        access_log: (db.accessLog ?? []).filter((e) => e.athleteId === uid || e.viewerId === uid),
      };
    },

    async saveCalibration(uid, calibration) {
      await delay();
      assertIsSelf(uid);
      const problem = calibrationProblem(calibration);
      if (problem) throw new BackendError("invalid-input", problem);
      const { a100, midline, source, bandName } = calibration;
      const record = { a100, midline, source, bandName, at: now().toISOString() };
      mutate((db) => {
        db.calibrations = { ...db.calibrations, [uid]: [...(db.calibrations?.[uid] ?? []), record] };
      });
      return record;
    },

    async getLatestCalibration(uid) {
      await delay();
      assertIsSelf(uid);
      return store.read().calibrations?.[uid]?.at(-1) ?? null;
    },

    async trackEvents(events) {
      await delay();
      const uid = requireUser().uid;
      const problem = eventsProblem(events);
      if (problem) throw new BackendError("invalid-input", problem);
      mutate((db) => {
        db.events = [...(db.events ?? []), ...events.map((e) => ({ ...e, uid }))].slice(-MAX_LOCAL_EVENTS);
      });
    },

    async listAccessLog() {
      await delay();
      const uid = requireUser().uid;
      const db = store.read();
      return (db.accessLog ?? [])
        .filter((e) => e.athleteId === uid)
        .reverse()
        .map(({ viewerId, sessionId, at }) => ({ viewerId, viewerName: db.accounts[viewerId]?.profile.displayName ?? "Someone", sessionId, at }));
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
