// The goal's own onboarding questions (Train, Focus, Calm) and the plan step:
// the options as people see them, each track's defaults, and the checks the
// adapter runs before storing them. Spec: planning/v1/02-onboarding-and-tailoring.md
// §3.2–3.4 and §7.

import { goalOf } from "./preferences";
import type {
  BreathGoal,
  CalmDetails,
  CalmHope,
  CalmTime,
  DayPart,
  FocusDetails,
  FocusStressor,
  GoalDetails,
  ReminderPreferences,
  TrainDetails,
  TrainSport,
  TrainWant,
  UserPreferences,
  Weekday,
} from "./types";

type Option<T extends string> = { id: T; label: string };

export const WEEKDAYS: Option<Weekday>[] = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];
const ALL_DAYS = WEEKDAYS.map((d) => d.id);

export const DAY_PARTS: Option<DayPart>[] = [
  { id: "morning", label: "Morning" },
  { id: "midday", label: "Midday" },
  { id: "evening", label: "Evening" },
];

export const TRAIN_SPORTS: Option<TrainSport>[] = [
  { id: "running", label: "Running" },
  { id: "cycling", label: "Cycling" },
  { id: "swimming", label: "Swimming" },
  { id: "team", label: "Team sport" },
  { id: "combat", label: "Combat sport" },
  { id: "strength", label: "Strength" },
  { id: "climbing", label: "Climbing" },
  { id: "performing", label: "Performing (music, voice, stage)" },
  { id: "other", label: "Something else" },
];

export const TRAIN_WANTS: Option<TrainWant>[] = [
  { id: "calm-before", label: "Calm before competition" },
  { id: "recovery", label: "Recovery after training" },
  { id: "control", label: "Control under effort" },
  { id: "longer-breaths", label: "Longer, steadier breaths" },
];
export const MAX_TRAIN_WANTS = 2;
export const MAX_SPORT_OTHER = 60;

export const FOCUS_STRESSORS: Option<FocusStressor>[] = [
  { id: "exams", label: "Exams and tests" },
  { id: "presentations", label: "Presentations" },
  { id: "studying", label: "Studying and focus" },
  { id: "sleep", label: "Falling asleep" },
];
export const MAX_EXAM_DATES = 5;

export const CALM_HOPES: Option<CalmHope>[] = [
  { id: "less-stress", label: "Less stress" },
  { id: "sleep", label: "Better sleep" },
  { id: "habit", label: "A daily habit" },
  { id: "curious", label: "Curious about my breathing" },
];

export const CALM_TIMES: Option<CalmTime>[] = [
  { id: "morning", label: "Morning" },
  { id: "lunch", label: "Lunch" },
  { id: "evening", label: "Evening" },
  { id: "bedtime", label: "Bedtime" },
];

/** The plan step's choices. */
export const SESSIONS_A_WEEK = [2, 3, 4, 5, 6, 7];
export const DAILY_MINUTES = [3, 5, 10, 15, 20];
export const MAX_DAILY_MINUTES = 120;

/** What each track's answers look like before anything is picked; also what "Skip" stores. */
export function defaultTrainDetails(): TrainDetails {
  return { sport: null, wants: [], trainingDays: [], trainingTime: null };
}
export function defaultFocusDetails(): FocusDetails {
  return { stressors: [], examDates: [], studyTimes: [], classTimes: [], moodCheckins: true };
}
export function defaultCalmDetails(): CalmDetails {
  return { hopes: [], bestTime: null };
}

export type TrackDetails = TrainDetails | FocusDetails | CalmDetails;

export function defaultDetails(goal: "train"): TrainDetails;
export function defaultDetails(goal: "focus"): FocusDetails;
export function defaultDetails(goal: "calm"): CalmDetails;
export function defaultDetails(goal: BreathGoal): TrackDetails;
export function defaultDetails(goal: BreathGoal): TrackDetails {
  if (goal === "train") return defaultTrainDetails();
  if (goal === "focus") return defaultFocusDetails();
  return defaultCalmDetails();
}

/** The plan step's answers: how often, how long a day, and when to remind. */
export interface Plan {
  sessionsPerWeek: number;
  dailyMinutes: number;
  reminders: ReminderPreferences;
}

const DAY_PART_TIME: Record<DayPart, string> = { morning: "08:00", midday: "12:30", evening: "18:30" };
const CALM_TIME: Record<CalmTime, string> = { morning: "08:00", lunch: "12:30", evening: "18:30", bedtime: "21:30" };

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** The reminder time each track's answers suggest; 08:00 for Train and Calm and 18:30 for Focus when unanswered. */
function suggestedTime(goal: BreathGoal, details: TrackDetails | undefined): string {
  if (goal === "train") {
    const t = (details as TrainDetails | undefined)?.trainingTime;
    return t ? DAY_PART_TIME[t] : "08:00";
  }
  if (goal === "focus") {
    // Outside class: the first study time that isn't a class time, else any free part of the day.
    const d = details as FocusDetails | undefined;
    const classes = new Set(d?.classTimes ?? []);
    const study = (d?.studyTimes ?? []).find((t) => !classes.has(t));
    if (study) return DAY_PART_TIME[study];
    const free = (["evening", "morning", "midday"] as const).find((t) => !classes.has(t));
    return DAY_PART_TIME[free ?? "evening"];
  }
  const t = (details as CalmDetails | undefined)?.bestTime;
  return t ? CALM_TIME[t] : "08:00";
}

/**
 * What the plan step starts from: the track's weekly goal and session length
 * (Train 5 a week and 10 minutes, Focus 4 and 3, Calm 7 and 3), with Train's
 * training days setting both the week and the reminder days.
 */
export function planDefaults(goal: BreathGoal, details?: TrackDetails, timeZone: string = localTimeZone()): Plan {
  const g = goalOf(goal);
  const trainingDays = goal === "train" ? ((details as TrainDetails | undefined)?.trainingDays ?? []) : [];
  const days = trainingDays.length ? ALL_DAYS.filter((d) => trainingDays.includes(d)) : [...ALL_DAYS];
  const sessionsPerWeek = trainingDays.length ? Math.min(7, Math.max(2, trainingDays.length)) : g.sessionsPerWeek;
  return {
    sessionsPerWeek,
    dailyMinutes: Math.max(1, Math.round(g.session.durationSec / 60)),
    reminders: { enabled: true, time: suggestedTime(goal, details), days, timeZone },
  };
}

/**
 * The preferences onboarding saves: the goal's answers (its defaults when the
 * questions were skipped, `null`) and the plan (its defaults when skipped).
 * Only the current goal's answers are written.
 */
export function withOnboardingAnswers(prefs: UserPreferences, details: TrackDetails | null, plan: Plan | null): UserPreferences {
  const answers = details ?? defaultDetails(prefs.goal);
  const p = plan ?? planDefaults(prefs.goal, answers);
  const goalDetails: GoalDetails = { [prefs.goal]: structuredClone(answers) };
  return { ...prefs, goalDetails, sessionsPerWeek: p.sessionsPerWeek, dailyMinutes: p.dailyMinutes, reminders: structuredClone(p.reminders) };
}

// ---------------------------------------------------------------- checks

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function listProblem<T extends string>(field: string, value: unknown, options: Option<T>[], max = options.length): string | null {
  if (!Array.isArray(value)) return `${field}: a list`;
  const ids = new Set<string>(options.map((o) => o.id));
  for (const v of value) if (typeof v !== "string" || !ids.has(v)) return `${field}: unknown "${String(v)}"`;
  if (new Set(value).size !== value.length) return `${field}: no repeats`;
  if (value.length > max) return `${field}: at most ${max}`;
  return null;
}

function oneOfProblem<T extends string>(field: string, value: unknown, options: Option<T>[]): string | null {
  if (value === null) return null;
  return options.some((o) => o.id === value) ? null : `${field}: unknown "${String(value)}"`;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDay = (v: unknown) => typeof v === "string" && ISO_DAY.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function trainProblem(d: unknown): string | null {
  if (!isObject(d)) return "goalDetails.train: an object";
  const f = "goalDetails.train";
  if (d.sport !== null && !TRAIN_SPORTS.some((o) => o.id === d.sport)) return `${f}.sport: unknown "${String(d.sport)}"`;
  if (d.sportOther !== undefined) {
    if (d.sport !== "other") return `${f}.sportOther: only with sport "other"`;
    if (typeof d.sportOther !== "string" || d.sportOther.length > MAX_SPORT_OTHER) return `${f}.sportOther: text up to ${MAX_SPORT_OTHER} characters`;
  }
  return (
    listProblem(`${f}.wants`, d.wants, TRAIN_WANTS, MAX_TRAIN_WANTS) ??
    listProblem(`${f}.trainingDays`, d.trainingDays, WEEKDAYS) ??
    oneOfProblem(`${f}.trainingTime`, d.trainingTime, DAY_PARTS)
  );
}

function focusProblem(d: unknown): string | null {
  if (!isObject(d)) return "goalDetails.focus: an object";
  const f = "goalDetails.focus";
  const listed = listProblem(`${f}.stressors`, d.stressors, FOCUS_STRESSORS);
  if (listed) return listed;
  if (!Array.isArray(d.examDates) || !d.examDates.every(isIsoDay)) return `${f}.examDates: a list of YYYY-MM-DD dates`;
  if (d.examDates.length > MAX_EXAM_DATES) return `${f}.examDates: at most ${MAX_EXAM_DATES}`;
  if (new Set(d.examDates).size !== d.examDates.length) return `${f}.examDates: no repeats`;
  return (
    listProblem(`${f}.studyTimes`, d.studyTimes, DAY_PARTS) ??
    listProblem(`${f}.classTimes`, d.classTimes, DAY_PARTS) ??
    (typeof d.moodCheckins === "boolean" ? null : `${f}.moodCheckins: true or false`)
  );
}

function calmProblem(d: unknown): string | null {
  if (!isObject(d)) return "goalDetails.calm: an object";
  return listProblem("goalDetails.calm.hopes", d.hopes, CALM_HOPES) ?? oneOfProblem("goalDetails.calm.bestTime", d.bestTime, CALM_TIMES);
}

/** Why the onboarding answers on a preferences object can't be stored, or null when they're fine (or absent). */
export function goalPlanProblem(p: Pick<UserPreferences, "goalDetails" | "dailyMinutes" | "reminders">): string | null {
  if (p.goalDetails !== undefined) {
    const g: unknown = p.goalDetails;
    if (!isObject(g)) return "goalDetails: an object";
    for (const key of Object.keys(g)) if (!["train", "focus", "calm"].includes(key)) return `goalDetails: unknown track "${key}"`;
    const problem =
      (g.train !== undefined ? trainProblem(g.train) : null) ??
      (g.focus !== undefined ? focusProblem(g.focus) : null) ??
      (g.calm !== undefined ? calmProblem(g.calm) : null);
    if (problem) return problem;
  }
  if (p.dailyMinutes !== undefined) {
    if (!Number.isInteger(p.dailyMinutes) || p.dailyMinutes < 1 || p.dailyMinutes > MAX_DAILY_MINUTES) return `dailyMinutes: 1 to ${MAX_DAILY_MINUTES}`;
  }
  if (p.reminders !== undefined) {
    const r: unknown = p.reminders;
    if (!isObject(r)) return "reminders: an object";
    if (typeof r.enabled !== "boolean") return "reminders.enabled: true or false";
    if (typeof r.time !== "string" || !HH_MM.test(r.time)) return "reminders.time: HH:MM, 24-hour";
    const days = listProblem("reminders.days", r.days, WEEKDAYS);
    if (days) return days;
    if (r.enabled && (r.days as unknown[]).length === 0) return "reminders.days: at least one day when reminders are on";
    if (typeof r.timeZone !== "string" || !r.timeZone || r.timeZone.length > 64) return "reminders.timeZone: an IANA time zone name";
  }
  return null;
}
