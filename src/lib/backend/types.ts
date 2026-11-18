import type {
  CoachLink,
  Invite,
  SessionSummary,
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
}

export interface AuthService {
  currentUser(): AuthUser | null;
  /** Calls back immediately with the current state, then on every change. Returns an unsubscribe function. */
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<AuthUser>;
  /** Creates the account and its UserProfile. */
  signUp(input: SignUpInput): Promise<AuthUser>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
}

export interface ListSessionsOptions {
  limit?: number;
  /** Return sessions that started before this ISO timestamp (for paging). */
  before?: string;
}

export interface DataService {
  getProfile(uid: string): Promise<UserProfile | null>;

  /** Newest first. Throws BackendError("permission-denied") if the caller can't read this athlete. */
  listSessions(athleteId: string, options?: ListSessionsOptions): Promise<SessionSummary[]>;
  getSession(athleteId: string, sessionId: string): Promise<SessionSummary | null>;
  getWaveform(session: SessionSummary): Promise<Waveform>;
  /** Athletes only, on their own sessions. */
  updateSessionNote(athleteId: string, sessionId: string, note: string): Promise<void>;

  /** Athletes the signed-in coach is linked to. */
  listAthletes(coachId: string): Promise<UserProfile[]>;
  /** Coaches linked to the signed-in athlete. */
  listCoaches(athleteId: string): Promise<UserProfile[]>;
  createInvite(athleteId: string): Promise<Invite>;
  redeemInvite(coachId: string, code: string): Promise<CoachLink>;
  revokeCoach(athleteId: string, coachId: string): Promise<void>;

  joinWaitlist(entry: WaitlistEntry): Promise<void>;
}

export interface Backend {
  /** Shown in the UI when not "firebase", so demo data is never mistaken for real data. */
  kind: "local" | "firebase";
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
