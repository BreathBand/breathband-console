// The habit mechanics (planning/v1/01 §3.8, J1–J3): the daily ring, the streak
// with its rest day, and milestones. Pure and computed from sessions, so the
// same numbers reach Home, the results line and the session review. Only what
// can't be computed is stored, in `preferences.gamification`: which mechanics
// are on and which milestones have already been shown.

import { planDefaults } from "./goal-questions";
import { PROGRAM_IDS, programProgress } from "./programs";
import { isTransitionScores } from "./scores";
import type { BreathGoal, GamificationPreferences, MilestoneKey, SessionSummary, UserPreferences } from "./types";

const DAY = 86_400_000;

/** A local calendar day as a whole number, so day arithmetic ignores clock changes. */
function dayNumber(d: Date): number {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

// ---------------------------------------------------------------- ring

/** The ring's goal when there's no goal to take it from (gamification: "default 5"). */
export const DEFAULT_DAILY_MINUTES = 5;

/** Minutes a day that close the ring: the person's own, else their goal's default session length, else 5. */
export function dailyMinutesOf(prefs: Pick<UserPreferences, "goal" | "dailyMinutes"> | null | undefined): number {
  if (prefs?.dailyMinutes) return prefs.dailyMinutes;
  return prefs ? planDefaults(prefs.goal, undefined, "UTC").dailyMinutes : DEFAULT_DAILY_MINUTES;
}

export interface Ring {
  /** Minutes that close it. */
  goalMinutes: number;
  /** Today's sessions, in whole minutes done (rounded down, so "5 of 5" means closed). */
  minutes: number;
  /** 0 to 1. */
  fraction: number;
  closed: boolean;
}

/** Today's minutes against the daily goal. */
export function ringOf(sessions: Pick<SessionSummary, "startedAt" | "durationSec">[], now: Date, goalMinutes: number): Ring {
  const today = dayNumber(now);
  const seconds = sessions.filter((s) => dayNumber(new Date(s.startedAt)) === today).reduce((sum, s) => sum + Math.max(0, s.durationSec), 0);
  const goal = Math.max(1, goalMinutes) * 60;
  return { goalMinutes: goal / 60, minutes: Math.floor(seconds / 60), fraction: Math.min(1, seconds / goal), closed: seconds >= goal };
}

// ---------------------------------------------------------------- streak

/** A missed day keeps the streak going when no other rest day fell in the 7 days before it. */
export const REST_DAY_EVERY = 7;

export interface Streak {
  /** Days with a session in the current run; rest days hold it but don't add to it. */
  days: number;
  /**
   * `active`: the run is alive (today's done, or there's still today).
   * `paused`: a run ended; shown kindly, never as lost.
   * `none`: no sessions yet.
   */
  state: "active" | "paused" | "none";
  doneToday: boolean;
  /** Rest days the current run has leaned on. */
  restDays: number;
  /** The longest run so far, for the milestones. */
  best: number;
}

/**
 * Days in a row with at least one session, walked forward the way the person
 * lived them: a single missed day is a rest day when there was no other rest
 * day in the 7 days before it; two missed days in a row, or a second rest day
 * inside 7 days, pause the streak. Today doesn't count against it until it's over.
 */
export function streakOf(sessions: Pick<SessionSummary, "startedAt">[], now: Date): Streak {
  const today = dayNumber(now);
  const active = new Set(sessions.map((s) => dayNumber(new Date(s.startedAt))).filter((d) => d <= today));
  if (active.size === 0) return { days: 0, state: "none", doneToday: false, restDays: 0, best: 0 };
  let run = 0;
  let rests = 0;
  let lastRest = -Infinity;
  let best = 0;
  for (let d = Math.min(...active); d <= today; d++) {
    if (active.has(d)) {
      run++;
      best = Math.max(best, run);
    } else if (d < today && run > 0) {
      if (d - lastRest >= REST_DAY_EVERY) {
        lastRest = d;
        rests++;
      } else {
        run = 0;
        rests = 0;
        lastRest = -Infinity;
      }
    }
  }
  return { days: run, state: run > 0 ? "active" : "paused", doneToday: active.has(today), restDays: rests, best };
}

/** The streak's length alone, as Home, the results line and the session review show it. */
export function streakDays(sessions: Pick<SessionSummary, "startedAt">[], now: Date): number {
  return streakOf(sessions, now).days;
}

// ---------------------------------------------------------------- milestones

export interface Milestone {
  key: MilestoneKey;
  title: string;
  line: string;
}

/** In the order they're shown (01 §3.8). */
export const MILESTONES: Milestone[] = [
  { key: "first-calibration", title: "First calibration", line: "Your band knows your range now." },
  { key: "first-paced", title: "First paced session", line: "You breathed along with the pacer." },
  { key: "streak-7", title: "Seven days in a row", line: "A week of showing up." },
  { key: "streak-30", title: "Thirty days in a row", line: "A month of showing up." },
  { key: "sessions-100", title: "100 sessions", line: "A hundred sessions recorded." },
  { key: "first-9", title: "First 9 or above", line: "A Total Breath Score of 9 or more." },
  { key: "first-program", title: "First program finished", line: "Every session of a program, done." },
];

export const MILESTONE_KEYS = MILESTONES.map((m) => m.key);

/**
 * Milestones the sessions have earned. Every session starts with a
 * calibration, so the first session is the first calibration. "First program"
 * is earned when every day of the program the person enrolled in is done.
 */
export function earnedMilestones(
  sessions: Pick<SessionSummary, "startedAt" | "mode" | "scores">[],
  now: Date,
  g?: GamificationPreferences,
): MilestoneKey[] {
  const past = sessions.filter((s) => Date.parse(s.startedAt) <= now.getTime());
  const best = streakOf(past, now).best;
  const earned: Record<MilestoneKey, boolean> = {
    "first-calibration": past.length > 0,
    "first-paced": past.some((s) => s.mode === "paced"),
    "streak-7": best >= 7,
    "streak-30": best >= 30,
    "sessions-100": past.length >= 100,
    "first-9": past.some((s) => isTransitionScores(s.scores) && s.scores.total >= 9),
    "first-program": g?.program ? programProgress(g.program, past, now).finishedAt !== null : false,
  };
  return MILESTONE_KEYS.filter((k) => earned[k]);
}

/** Earned and not yet shown: what to show now, once. */
export function newMilestones(earned: MilestoneKey[], g: GamificationPreferences | undefined): MilestoneKey[] {
  return earned.filter((k) => !g?.awarded?.[k]);
}

/** The gamification preferences with these milestones marked as shown, so they never show again. */
export function award(g: GamificationPreferences | undefined, keys: MilestoneKey[], now: Date): GamificationPreferences {
  const awarded = { ...g?.awarded };
  for (const k of keys) awarded[k] ??= now.toISOString();
  return { ...g, awarded };
}

// ---------------------------------------------------------------- which are on

export type Mechanic = "ring" | "streak" | "milestones";
export type Mechanics = Record<Mechanic, boolean>;

/**
 * What each goal turns on (02 §5.1, Gamification row): Train and Focus the
 * ring and streak, Calm those and milestones. A clinician's client gets
 * milestones only ("no streak pressure").
 */
export const MECHANIC_DEFAULTS: Record<BreathGoal | "none" | "clinician", Mechanics> = {
  train: { ring: true, streak: true, milestones: false },
  focus: { ring: true, streak: true, milestones: false },
  calm: { ring: true, streak: true, milestones: true },
  none: { ring: true, streak: true, milestones: false },
  clinician: { ring: false, streak: false, milestones: true },
};

/** The person's own switches over their goal's defaults. */
export function mechanicsOf(prefs: Pick<UserPreferences, "goal" | "gamification"> | null | undefined, clinicianClient = false): Mechanics {
  const base = MECHANIC_DEFAULTS[clinicianClient ? "clinician" : (prefs?.goal ?? "none")];
  const g = prefs?.gamification;
  return { ring: g?.ring ?? base.ring, streak: g?.streak ?? base.streak, milestones: g?.milestones ?? base.milestones };
}

// ---------------------------------------------------------------- checks

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Why `preferences.gamification` can't be stored, or null when it's fine (or absent). */
export function gamificationProblem(g: unknown): string | null {
  if (g === undefined) return null;
  if (!isObject(g)) return "gamification: an object";
  for (const key of Object.keys(g)) {
    if (!["ring", "streak", "milestones", "awarded", "program"].includes(key)) return `gamification: unknown "${key}"`;
  }
  for (const key of ["ring", "streak", "milestones"] as const) {
    if (g[key] !== undefined && typeof g[key] !== "boolean") return `gamification.${key}: true or false`;
  }
  if (g.awarded !== undefined) {
    if (!isObject(g.awarded)) return "gamification.awarded: an object";
    for (const [key, at] of Object.entries(g.awarded)) {
      if (!(MILESTONE_KEYS as string[]).includes(key)) return `gamification.awarded: unknown milestone "${key}"`;
      if (typeof at !== "string" || Number.isNaN(Date.parse(at))) return `gamification.awarded.${key}: an ISO date`;
    }
  }
  if (g.program !== undefined) {
    const p = g.program;
    if (!isObject(p)) return "gamification.program: an object";
    for (const key of Object.keys(p)) {
      if (!["id", "startedAt"].includes(key)) return `gamification.program: unknown "${key}"`;
    }
    if (!(PROGRAM_IDS as unknown[]).includes(p.id)) return "gamification.program.id: a known program";
    if (typeof p.startedAt !== "string" || Number.isNaN(Date.parse(p.startedAt))) return "gamification.program.startedAt: an ISO date";
  }
  return null;
}
