// Domain model shared by every backend adapter.
//
// This is the contract with the Breathband Flutter app: the app writes these
// shapes, the console reads them. Change them together with the Dart models,
// and bump SCORING_VERSION when the scoring formulas change so old sessions
// can be told apart (and rescored later if needed).

import type { SkillLevel } from "@/lib/analysis/config";
import type { ProTemplateId } from "./pro-templates";

export type Role = "athlete" | "coach";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  /** ISO 8601 */
  createdAt: string;
  /** Set during onboarding and in Settings; absent until then. Shared with the app. */
  preferences?: UserPreferences | null;
  /** What the person agreed to at sign-up, one record per kind. Absent on accounts made before consents were recorded. */
  consents?: ConsentRecord[];
  /** Year of birth, asked at sign-up for the 16+ age gate. Absent on older accounts. */
  birthYear?: number;
  /** Professionals only (role "coach"): the kind of work they do. Absent until onboarding asks, and on older accounts. */
  proKind?: ProKind;
  /** Professionals only: what they told onboarding about their practice. Its `kind` matches `proKind`. */
  proProfile?: ProProfile;
}

/** The professional tracks. Every one signs up with role "coach"; this says which kind of work. */
export type ProKind = "coach" | "clinician" | "educator";

/** What a professional calls the people they work with ("patients" isn't offered in v1). */
export type PeopleTerm = "athletes" | "clients" | "students";

/** The level a coach works at; youth means 16+ only in v1. */
export type CoachLevel = "youth" | "amateur" | "collegiate" | "pro";
export type ClinicianProfession = "physiotherapist" | "respiratory-therapist" | "physician" | "psychologist" | "nurse" | "other";
export type EducatorRole = "teacher" | "counsellor" | "coach";

export type CoachUseCase = "pre-competition" | "recovery" | "control-under-effort" | "team-warm-ups";
export type ClinicianUseCase = "between-visits" | "stress-anxiety" | "injury-recovery" | "sports-medicine";
export type EducatorUseCase = "exam-stress" | "study-focus" | "class-calm";
export type ProUseCase = CoachUseCase | ClinicianUseCase | EducatorUseCase;

/**
 * A professional's practice, from onboarding (planning/v1/02 §4.1 steps 2–5).
 * Fields that don't apply to the kind are null or empty. Server: `pro_profiles`.
 */
export interface ProProfile {
  kind: ProKind;
  /** Team or club, clinic or practice, school or college; at most 80 characters. */
  organisation: string | null;
  /** A clinician's profession or an educator's role; null for a coach. */
  profession: ClinicianProfession | EducatorRole | null;
  /** A coach's sports; empty for the other kinds. */
  sports: TrainSport[];
  /** Free text when `sports` includes "other"; at most 60 characters. */
  sportOther?: string;
  /** Coach only. */
  level: CoachLevel | null;
  /** Clinician only, as typed; at most 60 characters. */
  country: string | null;
  /** What they'll use Breathband for; at least one, from their kind's list. */
  useCases: ProUseCase[];
  /** How they refer to the people they work with. Defaults by kind. */
  terminology: PeopleTerm;
  /**
   * The targets the people they invite start with (§4.1 step 7). Partial: a
   * clinician starts with no score target. Absent on profiles saved before
   * T-0118. Server: `pro_profiles.default_targets`.
   */
  defaultTargets?: Partial<AthleteTargets>;
  /** What their invites ask people to share by default. Absent on profiles saved before T-0118. */
  scopeRequested?: ShareScope;
}

/** `terms` and `privacy` share one checkbox; `breathing-data` is processing breathing data to give scores. */
export type SignUpConsentKind = "terms" | "privacy" | "breathing-data";

/**
 * Agreed at the end of professional onboarding (planning/v1/02 §4.1 step 6):
 * every professional the professional terms; a clinician also the wellness
 * acknowledgement, an educator the 16+ acknowledgement.
 */
export type ProConsentKind = "professional-terms" | "wellness-acknowledgement" | "student-age-acknowledgement";

export type ConsentKind = SignUpConsentKind | ProConsentKind;

/** One agreement, kept as a legal record: which document, which version of it, and when. */
export interface ConsentRecord {
  kind: ConsentKind;
  version: string;
  /** ISO 8601 */
  acceptedAt: string;
}

/** Why someone breathes with Breathband; the site's Train / Focus / Calm. Sets defaults, never scoring. */
export type BreathGoal = "train" | "focus" | "calm";

/** What a new session starts with, in the app and on the web. */
export interface SessionPreferences {
  mode: SessionMode;
  pacerHalfCycleSec: PacerHalfCycle;
  /** Seconds; 0 means "until I stop" (open sessions only). */
  durationSec: number;
  view: "circle" | "line";
  sound: boolean;
}

/**
 * A person's choices that personalise Breathband: their goal, how experienced
 * they are (which sets how close to the pacer counts as on target), their
 * session defaults and a weekly goal. Firestore: users/{uid}.preferences.
 */
export interface UserPreferences {
  goal: BreathGoal;
  skillLevel: SkillLevel;
  session: SessionPreferences;
  /** The athlete's own target; a coach's target for them wins where one is set. */
  sessionsPerWeek: number;
  /** ISO 8601; null until onboarding is finished. */
  onboardedAt: string | null;
  /** Answers to the goal's own onboarding questions, kept per track. Absent until asked. */
  goalDetails?: GoalDetails;
  /** Minutes a day that fill the daily ring. Absent on older profiles: the goal's default applies. */
  dailyMinutes?: number;
  /** When to remind. Stored only for now: nothing sends reminders yet. */
  reminders?: ReminderPreferences;
  /** What the person chose at onboarding's band step. Absent until chosen (skipped, or older profiles). */
  onboarding?: OnboardingChoices;
  /** The habit mechanics: which are on, and the milestones already shown. Absent on older profiles: the goal's defaults apply. */
  gamification?: GamificationPreferences;
}

/** Milestones (planning/v1/01 §3.8), each shown once. */
export type MilestoneKey = "first-calibration" | "first-paced" | "streak-7" | "streak-30" | "sessions-100" | "first-9" | "first-program";

/**
 * The habit mechanics a person has on (Settings, J7), each defaulting from the
 * goal when absent, and the milestones already shown to them.
 */
export interface GamificationPreferences {
  /** The daily ring: minutes today against `dailyMinutes`. */
  ring?: boolean;
  /** Days in a row, with one rest day per rolling 7 days. */
  streak?: boolean;
  milestones?: boolean;
  /** Milestones already shown, with when (ISO 8601). A milestone in here is never shown again. */
  awarded?: Partial<Record<MilestoneKey, string>>;
}

/**
 * How the person will breathe with Breathband: the band over Web Bluetooth,
 * the phone app, no band yet, or the simulated band (demos and trying it out).
 */
export type BandRoute = "bluetooth" | "app" | "none" | "simulated";

export interface OnboardingChoices {
  bandRoute: BandRoute;
  /** Sample-data mode: a made-up person's sessions, labelled "Sample". Only with "none". */
  sampleData: boolean;
}

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
/** A rough time of day, for training, study and class times. */
export type DayPart = "morning" | "midday" | "evening";

export type TrainSport = "running" | "cycling" | "swimming" | "team" | "combat" | "strength" | "climbing" | "performing" | "other";
export type TrainWant = "calm-before" | "recovery" | "control" | "longer-breaths";
export type FocusStressor = "exams" | "presentations" | "studying" | "sleep";
export type CalmHope = "less-stress" | "sleep" | "habit" | "curious";
export type CalmTime = "morning" | "lunch" | "evening" | "bedtime";

/** Train (athlete, performer): what they do, what they want from it, and when they train. */
export interface TrainDetails {
  sport: TrainSport | null;
  /** Free text when `sport` is "other"; at most 60 characters. */
  sportOther?: string;
  /** Up to two. */
  wants: TrainWant[];
  trainingDays: Weekday[];
  trainingTime: DayPart | null;
}

/** Focus (student, 16+): when stress gets in the way, exams coming up, study and class times. */
export interface FocusDetails {
  stressors: FocusStressor[];
  /** Up to five, as YYYY-MM-DD. Personal. */
  examDates: string[];
  studyTimes: DayPart[];
  classTimes: DayPart[];
  /** Mood check-in (five faces) before and after each session. */
  moodCheckins: boolean;
}

/** Calm (casual): what they hope for and when suits them. */
export interface CalmDetails {
  hopes: CalmHope[];
  bestTime: CalmTime | null;
}

/** One entry per track answered; the current goal's entry is the one that applies. */
export interface GoalDetails {
  train?: TrainDetails;
  focus?: FocusDetails;
  calm?: CalmDetails;
}

export interface ReminderPreferences {
  enabled: boolean;
  /** Local time, "HH:MM" (24-hour), in `timeZone`. */
  time: string;
  days: Weekday[];
  /** IANA name, e.g. "Europe/Amsterdam", taken from the browser when the plan is set. */
  timeZone: string;
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

export interface NullableInhaleExhale {
  inhale: number | null;
  exhale: number | null;
}

export interface DeviationHistogram {
  timing: number[];
  depth: number[];
  missedOrDouble: number;
}

export interface PacedDetails {
  onTargetPct: { timing: number; depth: number };
  direction: { timing: NullableInhaleExhale; depth: NullableInhaleExhale };
  histogram: DeviationHistogram;
  missed: number;
  double: number;
  transitions: number;
}

/** The Appendix's open-session metrics for one span of a session. */
export interface OpenSpanMetrics {
  rateBpm: number;
  /** Exhale length over inhale length (2 means 1:2). */
  ieRatio: number;
  inhaleS: number;
  exhaleS: number;
  /** Mean peak-to-trough depth, % of the calibrated maximum. */
  depthPct: number;
  inhaleDepthPct: number;
  exhaleDepthPct: number;
  /** Depth against the normal band, capped at 100. */
  depthIndex: number;
  /** Share of breaths at a normal rate (12–16 br/min). */
  normalRatePct: number;
  /** Share of breaths at a normal depth. */
  normalDepthPct: number;
}

/**
 * Open-session metrics, stored with the summary so lists and coach views can
 * show them without loading the signal. Segments split the session at the
 * event markers (none, before/after, or before/between/after).
 */
export interface OpenDetails {
  whole: OpenSpanMetrics | null;
  breaths: number;
  segments: { name: "before" | "between" | "after"; fromS: number; toS: number; breaths: number; metrics: OpenSpanMetrics | null }[];
}

/**
 * Which formula produced a session's `scores`. Bump (add a new value) when the
 * app's scoring changes, so old sessions can be told apart and rescored.
 */
export const SCORING_VERSIONS = {
  legacy: "legacy-v1",
  transition: "transition-v1",
  methodC: "method-c-v1",
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
  skillLevel?: SkillLevel;
  paced?: PacedDetails | null;
  /** Open sessions scored by the console (method-c-v1 era); absent on older sessions. */
  open?: OpenDetails | null;
  /** Where the session was recorded: the phone app, or BreathCloud in a browser. */
  source?: "app" | "web";
}

export type WaveformUnits = "raw" | "pct-max";

/** The raw signal for one session. Cloud Storage: `SessionSummary.waveformPath`. */
export interface Waveform {
  /** The legacy app samples every 50 ms. */
  sampleIntervalMs: number;
  /** User signal, already sign-flipped the way the app displays it. */
  user: number[];
  units?: WaveformUnits;
  /** Pacer signal at the same sample indices; null for open sessions. */
  pacer: number[] | null;
  /** Sample indices where the user tapped the marker button. */
  markers: number[];
  /** Highest and lowest readings from the deep-breath calibration. */
  calibration: { min: number; max: number; a100?: number; midline?: number; peaks?: number[]; troughs?: number[] };
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
  /**
   * The first practice the professional set with the invite: one of their
   * kind's session or plan templates (lib/domain/pro-templates.ts). Accepting
   * creates it as the person's Assignment, so their first session is that
   * practice (planning/v1/02 §3.5). Absent when none was chosen, and on
   * invites made before T-0123.
   */
  practice?: ProTemplateId | null;
}
