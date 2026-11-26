// What the athlete's Home shows for their goal (planning/v1/02 §5.1, Home row,
// and §3.5 for people who came through a professional). Pure, so the choice
// is tested without rendering; AthleteHome reads it and lays the page out.

import type { AssignmentProgress } from "@/lib/domain/coaching";
import { isTransitionScores } from "@/lib/domain/scores";
import type { BreathGoal, SessionSummary } from "@/lib/domain/types";
import { weekStart } from "../SessionsTab";

const DAY = 86_400_000;

/** The kinds of professional in v1 (02 §4). Only "coach" can be told apart today: see `professionalOf`. */
export type ProKind = "coach" | "clinician" | "educator";

export interface Professional {
  name: string;
  kind: ProKind;
}

/** How a professional is named to the person they work with. */
export const PRO_WORD: Record<ProKind, string> = {
  coach: "coach",
  clinician: "clinician",
  educator: "teacher",
};

/**
 * Places later cards fill. Each renders nothing until its data exists:
 * - `focus-mood`: mood before and after (J6)
 * - `focus-exams`: exam countdown and study-day strip (D4–D6 goal details)
 * - `calm-ring`: the daily ring (J1)
 */
export type HomeSlot = "focus-mood" | "focus-exams" | "calm-ring";

export interface HomeLayout {
  goal: BreathGoal | null;
  /** Train is dense, Calm minimal; Focus and people without a goal get the standard page. */
  density: "dense" | "standard" | "minimal";
  /** When set, this professional's card leads the page and replaces the side's "From your coach". */
  professional: Professional | null;
  /** Which week card: Train's numbers, the standard facts, or Calm's habit view. */
  week: "train" | "standard" | "habit";
  /** The score trend, over this many days; null hides it. */
  trendDays: number | null;
  /** The open-session rate bars under the trend. */
  rate: boolean;
  /** Streak shown anywhere; off for clinicians' clients ("no streak pressure"). */
  streak: boolean;
  /** Calm's one encouraging line under the greeting. */
  line: boolean;
  slots: HomeSlot[];
}

/**
 * The person's linked professional, if any. A coach link doesn't record how it
 * was made (the professional's invite or the athlete's own code) or what kind
 * of professional it is, so every link reads as a coach for now.
 * When `proKind` lands on the profile (planning/v1/02 §7), read it here.
 */
export function professionalOf(coachName: string | undefined): Professional | null {
  return coachName ? { name: coachName, kind: "coach" } : null;
}

/**
 * Whether the professional's card leads Home: a clinician's always does
 * (§5.1 "From your clinician" card first); a coach's or teacher's until the
 * first practice they set is done (§3.5 "Home leads with 'From Lena'").
 */
export function leadsWithProfessional(pro: Professional | null, plans: Pick<AssignmentProgress, "status">[]): boolean {
  if (!pro) return false;
  return pro.kind === "clinician" || !plans.some((p) => p.status === "done");
}

export function homeLayout({
  goal,
  professional,
  plans,
}: {
  goal: BreathGoal | null;
  professional: Professional | null;
  plans: Pick<AssignmentProgress, "status">[];
}): HomeLayout {
  const pro = leadsWithProfessional(professional, plans) ? professional : null;
  const streak = professional?.kind !== "clinician";
  const base = { goal, professional: pro, streak };
  switch (goal) {
    case "train":
      return {
        ...base,
        density: "dense",
        week: "train",
        trendDays: 56,
        rate: true,
        line: false,
        slots: [],
      };
    case "focus":
      return {
        ...base,
        density: "standard",
        week: "standard",
        trendDays: 14,
        rate: false,
        line: false,
        slots: ["focus-mood", "focus-exams"],
      };
    case "calm":
      return {
        ...base,
        density: "minimal",
        week: "habit",
        trendDays: null,
        rate: false,
        line: true,
        slots: ["calm-ring"],
      };
    default:
      return {
        ...base,
        density: "standard",
        week: "standard",
        trendDays: 56,
        rate: true,
        line: false,
        slots: [],
      };
  }
}

/** "last 8 weeks", "last 2 weeks", "last 10 days". */
export function trendPeriod(days: number): string {
  return days % 7 === 0 ? `last ${days / 7} ${days === 7 ? "week" : "weeks"}` : `last ${days} days`;
}

export interface TrainWeek {
  /** Sessions since Monday. */
  done: number;
  planned: number;
  /** Mean breathing rate of open sessions in the last 7 days; null without one. */
  avgRate: number | null;
  /** Mean depth sub-score (inhale and exhale) of paced sessions in the last 7 days. */
  depth: number | null;
  /** Change in that mean on the 7 days before; null when either week has none. */
  depthChange: number | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const tenth = (x: number) => Math.round(x * 10) / 10;

/** Train's week card: sessions against the plan, average rate and which way depth is going. */
export function trainWeek(sessions: SessionSummary[], now: Date, planned: number): TrainWeek {
  const t = now.getTime();
  const monday = weekStart(now).getTime();
  const within = (s: SessionSummary, from: number, to: number) => {
    const at = Date.parse(s.startedAt);
    return at > from && at <= to;
  };
  const depthOf = (from: number, to: number) =>
    mean(
      sessions.filter((s) => within(s, from, to)).flatMap((s) => (isTransitionScores(s.scores) ? [(s.scores.depth.inhale + s.scores.depth.exhale) / 2] : [])),
    );
  const rate = mean(sessions.filter((s) => s.mode === "open" && s.respirationRateBpm !== null && within(s, t - 7 * DAY, t)).map((s) => s.respirationRateBpm!));
  const depth = depthOf(t - 7 * DAY, t);
  const before = depthOf(t - 14 * DAY, t - 7 * DAY);
  return {
    done: sessions.filter((s) => Date.parse(s.startedAt) >= monday && Date.parse(s.startedAt) <= t).length,
    planned,
    avgRate: rate === null ? null : tenth(rate),
    depth: depth === null ? null : tenth(depth),
    depthChange: depth === null || before === null ? null : tenth(depth - before),
  };
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** "three" for 3, the digits past ten. Shared with the results' coaching lines (results/tone.ts). */
export const word = (n: number) => WORDS[n] ?? String(n);
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Calm's one encouraging line (02 §5.1: "Nice. Three days in a row."). With
 * `streak` off (a clinician's client) it never mentions days in a row.
 */
export function calmLine({
  streakDays,
  doneToday,
  minutes,
  streak,
}: {
  streakDays: number;
  doneToday: boolean;
  /** The person's usual session length; 0 means "until I stop". */
  minutes: number;
  streak: boolean;
}): string {
  const length = minutes > 0 ? `${word(minutes)} ${minutes === 1 ? "minute" : "minutes"}` : "a few minutes";
  if (doneToday) return streak && streakDays >= 2 ? `Nice. ${capital(word(streakDays))} days in a row.` : "Done for today. Nice.";
  if (streak && streakDays === 1) return `Yesterday's done. ${capital(length)} today makes two days in a row.`;
  if (streak && streakDays >= 2) return `${capital(word(streakDays))} days in a row. ${capital(length)} today keeps it going.`;
  return `Your next session takes ${length}.`;
}
