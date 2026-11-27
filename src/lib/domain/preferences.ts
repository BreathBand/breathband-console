import { OPEN_CONSTANTS, type SkillLevel } from "@/lib/analysis/config";
import type { BreathGoal, EmailPreferences, SessionPreferences, UserPreferences } from "./types";

/** The three reasons to breathe with Breathband, as the site presents them. Each sets defaults, never scoring. */
export const GOALS: { id: BreathGoal; label: string; who: string; detail: string; session: SessionPreferences; sessionsPerWeek: number }[] = [
  {
    id: "train",
    label: "Train",
    who: "Athletes",
    detail: "Breath control for training and recovery. Longer paced sessions, most days.",
    session: { mode: "paced", pacerHalfCycleSec: 5, durationSec: 600, view: "circle", sound: true },
    sessionsPerWeek: 5,
  },
  {
    id: "focus",
    label: "Focus",
    who: "Students and busy days",
    detail: "A few calm, paced minutes before an exam, a meeting or a study block.",
    session: { mode: "paced", pacerHalfCycleSec: 5, durationSec: 180, view: "circle", sound: true },
    sessionsPerWeek: 4,
  },
  {
    id: "calm",
    label: "Calm",
    who: "Everyone else",
    detail: "A short daily habit: breathe your own way and watch your resting rate settle.",
    session: { mode: "open", pacerHalfCycleSec: 5, durationSec: 180, view: "line", sound: false },
    sessionsPerWeek: 7,
  },
];

export const SKILL_LEVELS: { id: SkillLevel; label: string; detail: string }[] = [
  { id: "beginner", label: "New to it", detail: "First time training your breathing. The on-target band is widest." },
  { id: "intermediate", label: "Some practice", detail: "You've done paced or box breathing before." },
  { id: "advanced", label: "Regular", detail: "Breath work is part of your routine. A tighter band." },
  { id: "expert", label: "Years of it", detail: "Freediving, singing, wind instruments, yoga teaching. The tightest band." },
];

/** "within ±0.75 SD of the pacer", for showing what a skill level means for scoring. */
export function skillBandText(level: SkillLevel): string {
  return `within ±${OPEN_CONSTANTS.skillBandK[level]} SD of the pacer counts as on target`;
}

export function goalOf(id: BreathGoal) {
  return GOALS.find((g) => g.id === id) ?? GOALS[0];
}

export function defaultPreferences(goal: BreathGoal = "train", skillLevel: SkillLevel = "intermediate"): UserPreferences {
  const g = goalOf(goal);
  return { goal, skillLevel, session: { ...g.session }, sessionsPerWeek: g.sessionsPerWeek, onboardedAt: null };
}

const DURATIONS = new Set([0, 60, 120, 180, 300, 600, 900, 1200]);

/** Why a preferences object can't be stored, or null when it's fine. */
export function preferencesProblem(p: UserPreferences): string | null {
  if (!GOALS.some((g) => g.id === p.goal)) return `goal: unknown "${String(p.goal)}"`;
  if (!Object.hasOwn(OPEN_CONSTANTS.skillBandK, p.skillLevel)) return `skillLevel: unknown "${String(p.skillLevel)}"`;
  const s = p.session;
  if (s.mode !== "paced" && s.mode !== "open") return "session.mode: paced or open";
  if (s.pacerHalfCycleSec !== 2 && s.pacerHalfCycleSec !== 5) return "session.pacerHalfCycleSec: 2 or 5";
  if (!DURATIONS.has(s.durationSec)) return `session.durationSec: one of ${[...DURATIONS].join(", ")}`;
  if (s.mode === "paced" && s.durationSec === 0) return "session.durationSec: a paced session needs a length";
  if (s.view !== "circle" && s.view !== "line") return "session.view: circle or line";
  if (typeof s.sound !== "boolean") return "session.sound: true or false";
  if (!Number.isInteger(p.sessionsPerWeek) || p.sessionsPerWeek < 1 || p.sessionsPerWeek > 14) return "sessionsPerWeek: 1 to 14";
  if (p.onboardedAt !== null && Number.isNaN(Date.parse(p.onboardedAt))) return "onboardedAt: an ISO date or null";
  if (p.emails !== undefined) {
    const e = p.emails;
    if (!e || EMAIL_KINDS.some((k) => typeof e[k] !== "boolean")) return `emails: ${EMAIL_KINDS.join(", ")}, each true or false`;
  }
  return null;
}

export const EMAIL_KINDS = ["practice", "reminders", "digest"] as const satisfies readonly (keyof EmailPreferences)[];
export type EmailKind = (typeof EMAIL_KINDS)[number];

/** Whether the person gets this kind of email: on unless they turned it off. */
export function emailOn(p: Pick<UserPreferences, "emails"> | null | undefined, kind: EmailKind): boolean {
  return p?.emails?.[kind] ?? true;
}
