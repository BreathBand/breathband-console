import type {
  AlertRules,
  Assignment,
  AthleteTargets,
  ClinicianProfession,
  CoachInvite,
  ConsentRecord,
  CoachLink,
  EducatorRole,
  GroupSession,
  PacerHalfCycle,
  Invite,
  ProKind,
  SessionComment,
  SessionSummary,
  ShareScope,
  Squad,
  UserProfile,
  WaitlistEntry,
  Waveform,
} from "@/lib/domain/types";

// The seam between the UI and whatever stores the data. Pages and components
// only ever use these interfaces (through useBackend()), so moving from the
// local adapter to Firebase — or to an API on Cloud Run — means writing one
// new adapter, not touching screens.
//
// The method shapes deliberately mirror Firebase semantics (auth state
// listener, permission errors, per-athlete session collections) so the
// Firebase adapter is a thin translation.

export interface AuthUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  role: UserProfile["role"];
  /** Every kind at its current version (see lib/domain/consent); the backend stamps the time. */
  consents: Pick<ConsentRecord, "kind" | "version">[];
  /** Under 16 is refused with BackendError("under-age"). */
  birthYear: number;
}

/** What updateProfile takes. */
export type ProfileChanges = Partial<Pick<UserProfile, "displayName" | "preferences" | "proKind" | "proProfile">> & {
  /** Professionals only: the terms they agreed to at the end of onboarding. */
  proConsents?: Pick<ConsentRecord, "kind" | "version">[];
};

export interface AuthService {
  currentUser(): AuthUser | null;
  /** Calls back immediately with the current state, then on every change. Returns an unsubscribe function. */
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<AuthUser>;
  /** Creates the account and its UserProfile, with its consent records and birth year. */
  signUp(input: SignUpInput): Promise<AuthUser>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
}

export interface ListSessionsOptions {
  limit?: number;
  /** Return sessions that started before this ISO timestamp (for paging). */
  before?: string;
}

export type NewAssignment = Pick<
  Assignment,
  "athleteId" | "mode" | "pacerHalfCycleSec" | "durationSec" | "target" | "dueAt" | "note"
>;

/**
 * What a person sees when they open a professional's invite link (T-0123):
 * who's asking, in their own terms (kind and profession or role), what they
 * ask to see, the first practice set with it, and whether it can still be
 * accepted. Never the contact details. The professional's fields are absent
 * for accounts from before onboarding asked them.
 */
export type CoachInviteLookup = Pick<CoachInvite, "code" | "coachId" | "coachName" | "expiresAt" | "status" | "practice"> & {
  coachKind?: ProKind | null;
  coachProfession?: ClinicianProfession | EducatorRole | null;
  /** The professional's `proProfile.scopeRequested`; absent when they have none (lib/domain/invite-context.ts fills in their kind's). */
  scopeRequested?: ShareScope | null;
};

/** A session as the recorder hands it over: everything but what the store assigns. */
export type NewSession = Omit<SessionSummary, "id" | "athleteId" | "waveformPath">;

export type NewGroupSession =Pick<GroupSession, "title" | "athleteIds" | "pacerHalfCycleSec" | "durationSec">;

/** Where an invited athlete is: still to answer, in the session, briefly lost, or gone. */
export type Presence = "invited" | "joined" | "reconnecting" | "left";

/**
 * One tick of the live channel. `t` is seconds since the session started;
 * each sample is the athlete's breath on the pacer's scale (−1 fully out,
 * 1 fully in), or null when it isn't available: not joined, reconnecting,
 * or an athlete who shares scores only (their curve stays private).
 */
export interface LiveFrame {
  t: number;
  samples: Record<string, number | null>;
}

export interface GroupLiveHandlers {
  onPresence(presence: Record<string, Presence>): void;
  onFrame(frame: LiveFrame): void;
}

export interface DataService {
  getProfile(uid: string): Promise<UserProfile | null>;
  /**
   * Own profile only: name, preferences and, for professionals (role "coach"),
   * `proKind` and `proProfile` (whose kind must match). Role and email are fixed.
   * `proConsents` records the professional terms at the end of onboarding: every
   * kind the professional's kind needs (lib/domain/pro-terms), at its current
   * version; the backend stamps the time and appends them to `consents`, once
   * (a kind already held at that version isn't added again). Sign-up's consents
   * never change.
   * Throws BackendError("permission-denied") when an athlete sends the professional fields.
   */
  updateProfile(uid: string, changes: ProfileChanges): Promise<UserProfile>;

  /** Newest first. Throws BackendError("permission-denied") if the caller can't read this athlete. */
  listSessions(athleteId: string, options?: ListSessionsOptions): Promise<SessionSummary[]>;
  getSession(athleteId: string, sessionId: string): Promise<SessionSummary | null>;
  /** The athlete, or a coach whose link has the "curves" scope. */
  getWaveform(session: SessionSummary): Promise<Waveform>;
  /** Athletes only, on their own sessions. */
  updateSessionNote(athleteId: string, sessionId: string, note: string): Promise<void>;
  /**
   * Athletes only, on their own data: stores a session recorded in the browser
   * with its signal, and returns the stored summary (with its id and waveformPath).
   */
  saveSession(athleteId: string, session: NewSession, waveform: Waveform): Promise<SessionSummary>;
  /** Athletes only, on their own sessions: removes the session, its signal and its comments. */
  deleteSession(athleteId: string, sessionId: string): Promise<void>;

  /** Athletes the signed-in coach is linked to. */
  listAthletes(coachId: string): Promise<UserProfile[]>;
  /** Coaches linked to the signed-in athlete. */
  listCoaches(athleteId: string): Promise<UserProfile[]>;
  /** The link between a coach and an athlete, readable by either of them. Null if there isn't one. */
  getCoachLink(coachId: string, athleteId: string): Promise<CoachLink | null>;
  /** Athletes only: change what a linked coach can see. */
  setCoachScope(athleteId: string, coachId: string, scope: ShareScope): Promise<void>;
  createInvite(athleteId: string, scope?: ShareScope): Promise<Invite>;
  redeemInvite(coachId: string, code: string): Promise<CoachLink>;
  revokeCoach(athleteId: string, coachId: string): Promise<void>;

  /** Practice set for an athlete, newest first. The athlete and linked coaches can read them. */
  listAssignments(athleteId: string): Promise<Assignment[]>;
  /** Linked coaches only. */
  createAssignment(coachId: string, input: NewAssignment): Promise<Assignment>;
  /** The coach who set it only. */
  cancelAssignment(athleteId: string, assignmentId: string): Promise<void>;

  /**
   * Comments and kudos on an athlete's sessions, oldest first. Pass a session
   * id for one thread; leave it out for every thread (dashboards, counts).
   */
  listComments(athleteId: string, sessionId?: string): Promise<SessionComment[]>;
  /** The athlete or a linked coach. A second kudos from the same person is a no-op. */
  addComment(
    athleteId: string,
    sessionId: string,
    input: Pick<SessionComment, "kind" | "text">,
  ): Promise<SessionComment>;
  /** Authors only. */
  deleteComment(athleteId: string, sessionId: string, commentId: string): Promise<void>;

  /** Coaches only: sessions this coach has opened, as "athleteId/sessionId" keys. */
  listSeenSessions(coachId: string): Promise<string[]>;
  markSessionSeen(coachId: string, athleteId: string, sessionId: string): Promise<void>;
  /** A coach's private notes about one athlete. The athlete can't read them. */
  getCoachNote(coachId: string, athleteId: string): Promise<string>;
  saveCoachNote(coachId: string, athleteId: string, text: string): Promise<void>;

  /** Coaches only: set this coach's targets for a linked athlete. */
  setTargets(coachId: string, athleteId: string, targets: AthleteTargets): Promise<void>;

  /** The coach's squads, by name. */
  listSquads(coachId: string): Promise<Squad[]>;
  /** Creates (no id) or replaces a squad. Only linked athletes can be in it. */
  saveSquad(coachId: string, squad: Pick<Squad, "name" | "athleteIds"> & { id?: string }): Promise<Squad>;
  deleteSquad(coachId: string, squadId: string): Promise<void>;

  /** The coach's "Needs a look" rules; DEFAULT_ALERTS until they change them. */
  getAlertRules(coachId: string): Promise<AlertRules>;
  saveAlertRules(coachId: string, rules: AlertRules): Promise<void>;

  /**
   * Coaches only: a link to send an athlete, valid for 14 days. `practice`, if
   * given, is one of the professional's kind's session or plan templates
   * (lib/domain/invite-context.ts `invitePracticeChoices`); anything else is
   * "invalid-input".
   */
  createCoachInvite(coachId: string, input: Pick<CoachInvite, "athleteName" | "contact" | "practice">): Promise<CoachInvite>;
  /** The coach's invites, newest first. */
  listCoachInvites(coachId: string): Promise<CoachInvite[]>;
  revokeCoachInvite(coachId: string, code: string): Promise<void>;
  /**
   * What an athlete sees when they open the link: who's asking, and whether
   * it can still be accepted. Leaves out the contact details.
   */
  getCoachInvite(code: string): Promise<CoachInviteLookup | null>;
  /**
   * Athletes only: accept (choosing what to share) or decline. Accepting
   * creates the CoachLink and, when the invite carries practice, the
   * Assignment it describes (set by the professional, due from today).
   */
  respondToCoachInvite(
    athleteId: string,
    code: string,
    answer: { accept: true; scope: ShareScope } | { accept: false },
  ): Promise<CoachLink | null>;

  /** Coaches only, for athletes linked to them. Opens in the lobby. */
  createGroupSession(hostId: string, input: NewGroupSession): Promise<GroupSession>;
  /** The host and invited athletes. */
  getGroupSession(id: string): Promise<GroupSession | null>;
  /** Group sessions the user hosted or was invited to, newest first. */
  listGroupSessions(uid: string): Promise<GroupSession[]>;
  /** Host only. Lobby → live. */
  startGroupSession(id: string): Promise<GroupSession>;
  /** Host only, while live: switch everyone's pacer from now on. */
  setGroupPacer(id: string, pacerHalfCycleSec: PacerHalfCycle): Promise<GroupSession>;
  /** Host only, while live: mark this moment on everyone's session. */
  addGroupMarker(id: string): Promise<GroupSession>;
  /**
   * Host only. Live → ended. Each athlete who took part saves a paced session
   * with `groupSessionId` set; sessions under 30 s are discarded.
   */
  endGroupSession(id: string): Promise<GroupSession>;
  /** Host only, from the lobby. */
  cancelGroupSession(id: string): Promise<void>;
  /**
   * Host only: presence and live breathing for every athlete in the session,
   * about ten frames a second while it's live. Returns an unsubscribe function.
   */
  watchGroupLive(id: string, handlers: GroupLiveHandlers): () => void;

  joinWaitlist(entry: WaitlistEntry): Promise<void>;
}

export interface Backend {
  /** Shown in the UI when not "firebase", so demo data is never mistaken for real data. */
  kind: "local" | "firebase" | "http";
  auth: AuthService;
  data: DataService;
}

export type BackendErrorCode =
  | "invalid-credentials"
  | "email-in-use"
  | "weak-password"
  | "invalid-email"
  | "not-signed-in"
  | "permission-denied"
  | "not-found"
  | "invite-invalid"
  | "invalid-input"
  | "under-age"
  | "unavailable";

export class BackendError extends Error {
  constructor(
    public readonly code: BackendErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "BackendError";
  }
}
