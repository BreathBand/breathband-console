// What the athlete's Home shows for their goal (planning/v1/02 §5.1, Home row,
// and §3.5 for people who came through a professional). Pure, so the choice
// is tested without rendering; AthleteHome reads it and lays the page out.

import type { AssignmentProgress } from "@/lib/domain/coaching";
import { isTransitionScores } from "@/lib/domain/scores";
import type { Mechanics, Ring } from "@/lib/domain/habit";
import type { Assignment, BreathGoal, ProKind, SessionComment, SessionSummary, UserProfile } from "@/lib/domain/types";
import { parseSetup, type SessionSetup } from "@/lib/prefs";
import { weekStart } from "../SessionsTab";

const DAY = 86_400_000;

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
 * - `calm-ring`: the daily ring (J1), when the ring is on
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
 * The person's linked professional, if any, as the kind they told onboarding
 * (`proKind`, planning/v1/02 §7). Accounts from before onboarding asked read
 * as a coach.
 */
export function professionalOf(coachName: string | undefined, kind?: ProKind | null): Professional | null {
  return coachName ? { name: coachName, kind: kind ?? "coach" } : null;
}

/** A professional's profile, as `listCoaches` gives it. */
type ProfessionalProfile = Pick<UserProfile, "uid" | "displayName" | "proKind" | "proProfile">;

/** A linked professional's profile, named as `professionalOf` names them; null with none. */
export function professionalFrom(profile: ProfessionalProfile | null | undefined): Professional | null {
  return profile ? professionalOf(profile.displayName, profile.proKind ?? profile.proProfile?.kind) : null;
}

/**
 * What the person calls their professional on their own screens: the linked
 * one's word; with none, the word Home's side pane uses (a teacher for Focus,
 * otherwise a coach; see `sidePractice`).
 */
export function proWordFor(goal: BreathGoal | null, professional: Professional | null): string {
  if (professional) return PRO_WORD[professional.kind];
  return goal === "focus" ? "teacher" : "coach";
}

const PLURAL: Record<ProKind, string> = { coach: "coaches", clinician: "clinicians", educator: "teachers" };

/**
 * Who reads the person's note and comments on their own session review:
 * "your clinician" with one professional (the goal's word with none), "your
 * coaches" with several of one kind, "the people you share with" otherwise.
 */
export function yourProfessionals(goal: BreathGoal | null, professionals: readonly Professional[]): string {
  if (professionals.length <= 1) return `your ${proWordFor(goal, professionals[0] ?? null)}`;
  const kinds = new Set(professionals.map((p) => p.kind));
  return kinds.size === 1 ? `your ${PLURAL[professionals[0].kind]}` : "the people you share with";
}

/**
 * The word beside a professional's comment ("· clinician"), from the author's
 * kind among the reader's linked professionals; null for anyone else's
 * comment. An author not among them (no longer linked, or the reader is
 * another professional, who can't list them) reads as a coach, as older
 * accounts do.
 */
export function commentAuthorWord(comment: Pick<SessionComment, "authorId" | "authorRole">, professionals: readonly ProfessionalProfile[]): string | null {
  if (comment.authorRole !== "coach") return null;
  const author = professionals.find((p) => p.uid === comment.authorId);
  return PRO_WORD[author?.proKind ?? author?.proProfile?.kind ?? "coach"];
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

/**
 * The layout with the person's habit switches applied (lib/domain/habit.ts):
 * the streak only where both the layout and the switch allow it, Calm's ring
 * only when it's on.
 */
export function withMechanics(layout: HomeLayout, mechanics: Mechanics): HomeLayout {
  return {
    ...layout,
    streak: layout.streak && mechanics.streak,
    slots: layout.slots.filter((s) => s !== "calm-ring" || mechanics.ring),
  };
}

/**
 * The side pane's block for practice from a professional, when their card
 * isn't leading Home: headed with the linked professional's word. With no
 * professional, Train asks for a coach and Focus for a teacher (02 §5.1,
 * "Sharing default": coach or physio; teacher or counsellor), and Calm, whose
 * sharing is off, shows no block, so its Home stays minimal.
 */
export function sidePractice(goal: BreathGoal | null, professional: Professional | null): { word: string; empty: string } | null {
  const word = proWordFor(goal, professional);
  if (professional) return { word, empty: "Nothing set right now." };
  if (goal === "calm") return null;
  if (goal === "focus") return { word, empty: "Share with a teacher or counsellor in Settings and their practice shows up here." };
  return { word, empty: "Share with a coach in Settings and their practice shows up here." };
}

/** What a start button needs to name a session; the person's defaults and an assignment both have it. */
export type SessionShape = Pick<Assignment, "mode" | "pacerHalfCycleSec" | "durationSec">;

/** "Start Paced 5-5 · 10 min", "Start Open · 3 min". */
export function startLabel(s: SessionShape): string {
  const what = s.mode === "paced" ? `Paced ${s.pacerHalfCycleSec}-${s.pacerHalfCycleSec}` : "Open";
  return `Start ${what}${s.durationSec ? ` · ${Math.round(s.durationSec / 60)} min` : ""}`;
}

/**
 * Home's one primary action: the open practice a professional set, when
 * there is one (02 §3.5 and §5.1, "New session defaults: the assignment"),
 * else the person's own defaults. The practice goes to New session in the
 * query, which sets it there.
 */
export function homeStart(own: SessionShape | null, practice: SessionShape | null): { label: string; href: string } {
  if (practice) return { label: startLabel(practice), href: `/cloud/record/?${practiceQuery(practice)}` };
  return { label: own ? startLabel(own) : "Start a session", href: "/cloud/record/" };
}

/** A practice's mode, pacer and length as New session's query (the same keys as `setupQuery`). */
export function practiceQuery(p: SessionShape): string {
  const q = new URLSearchParams({ mode: p.mode, len: String(p.durationSec) });
  if (p.mode === "paced" && p.pacerHalfCycleSec) q.set("pacer", String(p.pacerHalfCycleSec));
  return q.toString();
}

/** New session's setup with a practice from the query applied; view, sound and level stay the person's own. */
export function withPractice(setup: SessionSetup, q: URLSearchParams): SessionSetup {
  if (!q.has("mode")) return setup;
  const p = parseSetup(q);
  return { ...setup, mode: p.mode, lengthSec: p.lengthSec, pacer: q.has("pacer") ? p.pacer : setup.pacer };
}

/**
 * The streak's paused line in the goal's tone (02 §8, "Streak paused"):
 * kind, never "lost", never red. Focus names the minutes that pick it back up.
 */
export function pausedLine(goal: BreathGoal | null, dailyMinutes: number): string {
  if (goal === "train") return "Streak paused. Back at it today.";
  if (goal === "focus") return `Your streak paused. ${capital(word(dailyMinutes))} ${dailyMinutes === 1 ? "minute" : "minutes"} picks it back up.`;
  return "Your streak paused. Start today to pick it back up.";
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
 * Whole minutes still to close today's ring; 0 once it's closed. It counts
 * against the ring's own whole minutes done (rounded down), so it is the time
 * left rounded up and goes with what the ring shows: "0 of 3 min" and "three
 * more". Home and the results (results/tone.ts) both read "done for today"
 * from it.
 */
export function minutesLeftToday(ring: Pick<Ring, "closed" | "goalMinutes" | "minutes">): number {
  return ring.closed ? 0 : Math.max(1, ring.goalMinutes - ring.minutes);
}

/**
 * What still finishes today, from `minutesLeftToday`. The minutes are rounded
 * up, so the sentence is never short of the truth; the last minute reads "A
 * minute or less", so ten seconds to go never sounds like a full minute.
 */
export function moreToday(leftToday: number): string {
  return leftToday <= 1 ? "A minute or less finishes today." : `${capital(word(leftToday))} more minutes finishes today.`;
}

/**
 * Calm's one encouraging line (02 §5.1: "Nice. Three days in a row."). With
 * `streak` off (a clinician's client) it never mentions days in a row. Any
 * session today counts for the streak, but "done for today" waits for the
 * ring's minutes (T-0113): with `leftToday` minutes still to go it says so.
 */
export function calmLine({
  streakDays,
  doneToday,
  minutes,
  streak,
  leftToday = 0,
}: {
  streakDays: number;
  doneToday: boolean;
  /** The person's usual session length; 0 means "until I stop". */
  minutes: number;
  streak: boolean;
  /** Whole minutes still to close today's ring (`minutesLeftToday`); 0 (the default) when it's closed. */
  leftToday?: number;
}): string {
  const length = minutes > 0 ? `${word(minutes)} ${minutes === 1 ? "minute" : "minutes"}` : "a few minutes";
  if (doneToday && leftToday > 0) {
    const more = moreToday(leftToday);
    return streak && streakDays >= 2 ? `${capital(word(streakDays))} days in a row. ${more}` : `Good start. ${more}`;
  }
  if (doneToday) return streak && streakDays >= 2 ? `Nice. ${capital(word(streakDays))} days in a row.` : "Done for today. Nice.";
  if (streak && streakDays === 1) return `Yesterday's done. ${capital(length)} today makes two days in a row.`;
  if (streak && streakDays >= 2) return `${capital(word(streakDays))} days in a row. ${capital(length)} today keeps it going.`;
  return `Your next session takes ${length}.`;
}
