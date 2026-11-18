// Domain model shared by every backend adapter.
//
// This is the contract with the Breathband Flutter app: the app writes these
// shapes, the console reads them. Change them together with the Dart models,
// and bump SCORING_VERSION when the scoring formulas change so old sessions
// can be told apart (and rescored later if needed).

export type Role = "athlete" | "coach";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  /** ISO 8601 */
  createdAt: string;
}

export type SessionMode = "paced" | "open";

/** Scores as the legacy app computes them on the review screen (0–100). */
export interface SessionScores {
  overall: number;
  depth: number;
  timing: number;
}

export const SCORING_VERSION = "legacy-v1";

/**
 * One recorded session. Small enough to list and query; the raw signal lives
 * separately in a Waveform blob referenced by `waveformPath`.
 *
 * Firestore: users/{athleteId}/sessions/{id}
 */
export interface SessionSummary {
  id: string;
  athleteId: string;
  /** ISO 8601 */
  startedAt: string;
  durationSec: number;
  mode: SessionMode;
  /** Length of one inhale or exhale in a paced session; null for open sessions. */
  pacerHalfCycleSec: 2 | 5 | null;
  /** Null for open sessions (no pacer to score against). */
  scores: SessionScores | null;
  scoringVersion: string;
  /** Null when fewer than 3 breaths were detected. */
  respirationRateBpm: number | null;
  note: string;
  /** Cloud Storage path: waveforms/{athleteId}/{id}.json.gz */
  waveformPath: string;
  /** App build that recorded the session, e.g. "1.0.0+43". */
  appVersion: string;
}

/** The raw signal for one session. Cloud Storage: `SessionSummary.waveformPath`. */
export interface Waveform {
  /** The legacy app samples every 50 ms. */
  sampleIntervalMs: number;
  /** User signal, already sign-flipped the way the app displays it. */
  user: number[];
  /** Pacer signal at the same sample indices; null for open sessions. */
  pacer: number[] | null;
  /** Sample indices where the user tapped the marker button. */
  markers: number[];
  /** Highest and lowest readings from the deep-breath calibration. */
  calibration: { min: number; max: number };
}

/**
 * Grants a coach read access to one athlete's data.
 * Firestore: coachLinks/{coachId}_{athleteId}
 */
export interface CoachLink {
  coachId: string;
  athleteId: string;
  /** ISO 8601 */
  createdAt: string;
}

/**
 * A one-time code an athlete gives their coach. Redeemed server-side
 * (a Cloud Function in production), never read directly by clients.
 * Firestore: invites/{code}
 */
export interface Invite {
  code: string;
  athleteId: string;
  /** ISO 8601 */
  expiresAt: string;
}

/** Firestore: waitlist/{autoId} */
export interface WaitlistEntry {
  email: string;
  /** Where the sign-up came from, e.g. "hero" or "footer". */
  source: string;
}
