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

/** Scores as the legacy app computes them on the review screen (0–100). Scoring version "legacy-v1". */
export interface SessionScores {
  overall: number;
  depth: number;
  timing: number;
}

/** One value for the inhale transition (trough → peak) and one for the exhale (peak → trough). */
export interface InhaleExhale {
  inhale: number;
  exhale: number;
}

/**
 * Per-transition scores on the 1–10 scale (scoring version "transition-v1",
 * approved 16 Nov 2026). Timing and depth are each scored for the inhale and
 * the exhale; `total` is the Total Breath Score, the mean of the timing and
 * depth means. Whole numbers, or one decimal where averaging produces it.
 */
export interface TransitionScores {
  total: number;
  timing: InhaleExhale;
  depth: InhaleExhale;
  /** Complex scoring only. Shown, but not part of `total`. */
  smoothness: InhaleExhale | null;
}

/**
 * Which formula produced a session's `scores`. Bump (add a new value) when the
 * app's scoring changes, so old sessions can be told apart and rescored.
 */
export const SCORING_VERSIONS = {
  legacy: "legacy-v1",
  transition: "transition-v1",
} as const;

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
  /**
   * Null for open sessions (no pacer to score against). The shape follows
   * `scoringVersion`: SessionScores for "legacy-v1", TransitionScores for
   * "transition-v1".
   */
  scores: SessionScores | TransitionScores | null;
  scoringVersion: string;
  /** Null when fewer than 3 breaths were detected. */
  respirationRateBpm: number | null;
  note: string;
  /** Cloud Storage path: waveforms/{athleteId}/{id}.json.gz */
  waveformPath: string;
  /** App build that recorded the session, e.g. "1.0.0+43". */
  appVersion: string;
  /** Set when the session was recorded as part of a coach's live group session. */
  groupSessionId?: string | null;
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
 * What a coach may see. "scores": session list, scores and notes.
 * "curves": all of that plus the breathing signal. The athlete chooses, and
 * can change it at any time.
 */
export type ShareScope = "scores" | "curves";

/**
 * Grants a coach read access to one athlete's data.
 * Firestore: coachLinks/{coachId}_{athleteId}
 */
export interface CoachLink {
  coachId: string;
  athleteId: string;
  scope: ShareScope;
  /** ISO 8601 */
  createdAt: string;
  /** What this coach is aiming for with this athlete. Absent → DEFAULT_TARGETS. The athlete can see them. */
  targets?: AthleteTargets | null;
}

/**
 * A coach's goals for one athlete. Sessions outside them are highlighted on
 * the charts and can raise a flag (see AlertRules).
 */
export interface AthleteTargets {
  /** Total Breath Score to reach on paced sessions, 1–10. */
  score: number;
  /** Breathing rate range for open sessions, breaths per minute. */
  rateLow: number;
  rateHigh: number;
  sessionsPerWeek: number;
}

/** 12–16 br/min is the typical resting range shown everywhere in the app. */
export const DEFAULT_TARGETS: AthleteTargets = { score: 7, rateLow: 12, rateHigh: 16, sessionsPerWeek: 4 };

/**
 * A one-time code an athlete gives their coach. Redeemed server-side
 * (a Cloud Function in production), never read directly by clients.
 * Firestore: invites/{code}
 */
export interface Invite {
  code: string;
  athleteId: string;
  /** The scope the coach link starts with. */
  scope: ShareScope;
  /** ISO 8601 */
  expiresAt: string;
}

/**
 * Practice a coach sets for an athlete: "Paced 5-5, 5 minutes, 4 times by
 * Friday". Sessions count toward it by matching mode, pacer and length inside
 * the window (see lib/domain/assignments.ts), so the app doesn't have to tag
 * sessions for the console to show progress.
 *
 * Firestore: users/{athleteId}/assignments/{id}
 */
export interface Assignment {
  id: string;
  coachId: string;
  athleteId: string;
  /** ISO 8601 */
  createdAt: string;
  mode: SessionMode;
  /** Null for open sessions. */
  pacerHalfCycleSec: 2 | 5 | null;
  /** Minimum length of a session that counts. */
  durationSec: number;
  /** How many sessions to complete. */
  target: number;
  /** ISO 8601. Sessions after this don't count. */
  dueAt: string;
  note: string;
  cancelled: boolean;
}

/**
 * A comment or a kudos on one session, by the athlete or a linked coach.
 * Firestore: users/{athleteId}/sessions/{sessionId}/comments/{id}
 */
export interface SessionComment {
  id: string;
  athleteId: string;
  sessionId: string;
  authorId: string;
  /** Copied at write time so a thread renders without a profile lookup per comment. */
  authorName: string;
  authorRole: Role;
  /** A kudos has no text and is shown as a mark on the session. */
  kind: "comment" | "kudos";
  text: string;
  /** ISO 8601 */
  createdAt: string;
}

/** Firestore: waitlist/{autoId} */
export interface WaitlistEntry {
  email: string;
  /** Where the sign-up came from, e.g. "hero" or "footer". */
  source: string;
}

export type PacerHalfCycle = 2 | 5;

/**
 * A live session one coach runs for several athletes at once ("Group, live"
 * in the session-modes spec): everyone follows the same pacer, which the host
 * controls, and the host sees each athlete's breathing lined up in time.
 *
 * The live signal travels over a realtime channel and isn't stored here.
 * When the session ends, each athlete's app saves an ordinary paced
 * SessionSummary with `groupSessionId` set, listed in `results`.
 *
 * Firestore: groupSessions/{id}
 */
export interface GroupSession {
  id: string;
  hostId: string;
  hostName: string;
  title: string;
  /** Everyone invited, 2–30. */
  athleteIds: string[];
  /** The pacer at the start; later switches are in `pacerChanges`. */
  pacerHalfCycleSec: PacerHalfCycle;
  /** Planned length. The host can end early. */
  durationSec: number;
  status: "lobby" | "live" | "ended" | "cancelled";
  /** ISO 8601 */
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  /** Seconds after the start at which the host switched the pacer. */
  pacerChanges: { atSec: number; pacerHalfCycleSec: PacerHalfCycle }[];
  /** Seconds after the start where the host dropped a marker. */
  markers: number[];
  /** athleteId → the id of the session that athlete saved (users/{athleteId}/sessions/{id}). */
  results: Record<string, string>;
  /** Mean Total Breath Score of everyone who took part; null until the session ends. */
  groupAverage: number | null;
}

/**
 * A coach's own grouping of athletes ("Sprinters", "Juniors", a class), for
 * filtering the roster and dashboard and starting group sessions. Private to
 * the coach. Firestore: coaches/{coachId}/squads/{id}
 */
export interface Squad {
  id: string;
  name: string;
  athleteIds: string[];
  /** ISO 8601 */
  createdAt: string;
}

/**
 * When an athlete shows up under "Needs a look". Each rule can be switched
 * off (null / false). Firestore: coaches/{coachId}/settings/alerts
 */
export interface AlertRules {
  /** Days without a session. */
  missedDays: number | null;
  /** Points the latest score falls below the average of the five before it. */
  scoreDrop: number | null;
  /** How many of the last five scored sessions fall under the athlete's score target. */
  belowTarget: number | null;
  /** Scores falling steadily over the last three weeks. */
  trendingDown: boolean;
  /** An open session with a breathing rate outside the target range. */
  rateOutOfRange: boolean;
  /** Practice falling behind its pace. */
  practiceBehind: boolean;
}

export const DEFAULT_ALERTS: AlertRules = {
  missedDays: 3,
  scoreDrop: 2,
  belowTarget: 4,
  trendingDown: true,
  rateOutOfRange: true,
  practiceBehind: true,
};

/**
 * A coach asking an athlete to share (the reverse of Invite): sent as a link
 * by text or email. Nothing is shared until the athlete opens it, sees exactly
 * what the coach will see, chooses the scope and accepts.
 * Firestore: coachInvites/{code}; accepted by a Cloud Function.
 */
export interface CoachInvite {
  code: string;
  coachId: string;
  coachName: string;
  /** Who the coach meant it for, as they typed it. */
  athleteName: string;
  /** Email or phone number it was sent to; shown to the coach only. */
  contact: string;
  /** ISO 8601 */
  createdAt: string;
  expiresAt: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  /** Set once accepted. */
  athleteId: string | null;
}
