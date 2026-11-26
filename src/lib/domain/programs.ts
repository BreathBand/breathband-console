// Self-serve programs (planning/v1/01 §3.8, J5): a fixed run of days, each a
// session preset, followed from Home. The demo ships one, Foundations, the
// program Calm promotes (02 §5.1). Only the enrolment is stored
// (`preferences.gamification.program`); the days done are read from sessions.

import { setupQuery, type SessionSetup } from "@/lib/prefs";
import type { BreathGoal, ProgramEnrolment, ProgramId, SessionSummary } from "./types";

const DAY = 86_400_000;

/** A local calendar day as a whole number, so day arithmetic ignores clock changes. */
function dayNumber(d: Date): number {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

/** A day's session, without the level: that stays the person's own. */
export type DayPreset = Omit<SessionSetup, "skill">;

export interface ProgramDay {
  /** 1-based. */
  day: number;
  name: string;
  /** One line on what to do, shown with the day. */
  line: string;
  setup: DayPreset;
}

export interface Program {
  id: ProgramId;
  name: string;
  /** What it is, in one sentence, where it's offered. */
  summary: string;
  days: ProgramDay[];
}

const open = (min: number): DayPreset => ({ mode: "open", pacer: 5, lengthSec: min * 60, view: "line", sound: false });
const paced = (min: number, view: DayPreset["view"] = "circle", sound = true): DayPreset => ({ mode: "paced", pacer: 5, lengthSec: min * 60, view, sound });

/**
 * Foundations, Calm's 14 days: open breathing first, the 5-5 pacer from day 3
 * (02 §3.4: "paced suggested on day 3"), sessions growing from three minutes
 * to ten, and day 14 repeating day 1 so the two can be compared. Draft
 * content until J4's programs are approved.
 */
const FOUNDATIONS: [string, string, DayPreset][] = [
  ["Just breathe", "Breathe the way you usually do. This first one is your baseline.", open(3)],
  ["Notice the breath", "Breathe naturally and notice where it moves: belly, ribs or chest.", open(3)],
  ["Meet the pacer", "Five seconds in, five out. Follow the circle; close is good enough.", paced(3)],
  ["Long, even breaths", "Let each breath out run all the way to the bottom.", paced(3)],
  ["Check in", "No pacer today. Is your breathing a little slower than on day 1?", open(3)],
  ["Five minutes", "The same pace, two minutes longer.", paced(5)],
  ["A week in", "Five quiet minutes, no pacer. That's a week.", open(5)],
  ["Back to the pace", "Settle into the circle from the first breath.", paced(5)],
  ["Follow the line", "The pacer as a line this time: breathe in as it rises, out as it falls.", paced(5, "line")],
  ["Without the tones", "Just the circle and you.", paced(5, "circle", false)],
  ["Open and slow", "No pacer. See where your breath settles on its own.", open(5)],
  ["Steady", "Five even minutes at 5-5.", paced(5)],
  ["The long one", "Ten minutes at 5-5. Take your time.", paced(10)],
  ["Where you are now", "The same three minutes as day 1. Compare the two in Sessions.", open(3)],
];

export const PROGRAMS: Record<ProgramId, Program> = {
  foundations: {
    id: "foundations",
    name: "Foundations",
    summary: "Fourteen short sessions, one a day, from your natural breathing to a steady 5-5 pace.",
    days: FOUNDATIONS.map(([name, line, setup], i) => ({ day: i + 1, name, line, setup })),
  },
};

export const PROGRAM_IDS = Object.keys(PROGRAMS) as ProgramId[];

/** The program a goal puts forward on Home (02 §5.1, "Programs promoted"). Only Calm's is written so far. */
export function promotedProgram(goal: BreathGoal | null | undefined): ProgramId | null {
  return goal === "calm" ? "foundations" : null;
}

/** The instrument's address for a program day: its preset at the person's level, and which day it is. */
export function programDayHref(program: Program, day: ProgramDay, skill: SessionSetup["skill"]): string {
  return `/cloud/record/live/?${setupQuery({ ...day.setup, skill })}&program=${program.id}&day=${day.day}`;
}

export interface ProgramProgress {
  program: Program;
  /** Days done, from 0 to the program's length. */
  done: number;
  /** The day to do next; null once finished. */
  next: ProgramDay | null;
  /** A day was done today, so the next one opens tomorrow. */
  doneToday: boolean;
  /** Days gone by without one since the last day done (or since enrolling), today not counted. */
  missed: number;
  /** When the last day was done (that session's start); null until then. */
  finishedAt: string | null;
}

/**
 * How far someone is: each calendar day with a session since they enrolled
 * does the next day of the program, one a day. A missed day skips nothing
 * and resets nothing: the next day waits until they come back.
 */
export function programProgress(enrolment: ProgramEnrolment, sessions: Pick<SessionSummary, "startedAt">[], now: Date): ProgramProgress {
  const program = PROGRAMS[enrolment.id];
  const from = Date.parse(enrolment.startedAt);
  const firstByDay = new Map<number, string>();
  for (const s of [...sessions].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))) {
    const at = Date.parse(s.startedAt);
    if (at < from || at > now.getTime()) continue;
    const d = dayNumber(new Date(at));
    if (!firstByDay.has(d)) firstByDay.set(d, s.startedAt);
  }
  const days = [...firstByDay].slice(0, program.days.length);
  const done = days.length;
  const finished = done === program.days.length;
  const today = dayNumber(now);
  const last = days.length ? days[days.length - 1][0] : dayNumber(new Date(from));
  return {
    program,
    done,
    next: finished ? null : program.days[done],
    doneToday: days.some(([d]) => d === today),
    missed: finished ? 0 : Math.max(0, today - last - 1),
    finishedAt: finished ? days[done - 1][1] : null,
  };
}

/** Where the person is, in one line: kind about missed days, never "behind" or "failed". */
export function progressLine(p: ProgramProgress): string {
  const total = p.program.days.length;
  if (!p.next) return `Finished: all ${total} days of ${p.program.name}.`;
  if (p.doneToday) return `Day ${p.done} done. Day ${p.next.day} opens tomorrow.`;
  if (p.missed > 0 && p.done > 0) return `Day ${p.next.day} is waiting for you. A missed day resets nothing: carry on where you left off.`;
  if (p.done === 0) return "One day at a time. Miss one and it waits for you.";
  return `${total - p.done} days to go.`;
}
