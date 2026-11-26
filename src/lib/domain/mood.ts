// Mood check-in for Focus (planning/v1/03 J6; 02 §3 "Check in on your mood
// before and after?", §5.1 "mood change" on Home and Results): five faces,
// 1 (worst) to 5 (best), one before a session and one after. Pure, so when to
// ask, the change and the trend are tested without a screen.

import type { MoodCheckin, MoodScore, UserPreferences } from "./types";

export const MOOD_SCORES: readonly MoodScore[] = [1, 2, 3, 4, 5];

/** The word under each face, lower case so it reads inside a sentence. */
export const MOOD_WORDS: Record<MoodScore, string> = {
  1: "awful",
  2: "low",
  3: "okay",
  4: "good",
  5: "great",
};

export function isMoodScore(value: unknown): value is MoodScore {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Whether a session asks for the mood: only for Focus, and only while the
 * person's check-in is on. Focus profiles from before the goal questions
 * count as on, the question's default.
 */
export function asksMood(preferences: UserPreferences | null | undefined): boolean {
  if (preferences?.goal !== "focus") return false;
  return preferences.goalDetails?.focus?.moodCheckins ?? true;
}

/** Why a session's moods can't be stored, or null when they're fine. */
export function moodsProblem(moods: { before: unknown; after: unknown }): string | null {
  for (const phase of ["before", "after"] as const) {
    const mood = moods[phase];
    if (mood !== null && !isMoodScore(mood)) return `${phase}: a whole number from 1 to 5, or null`;
  }
  return null;
}

/** After minus before; null unless both were given. */
export function moodChange(before: MoodScore | null | undefined, after: MoodScore | null | undefined): number | null {
  return before && after ? after - before : null;
}

/** The results' mood sentence: "Mood up from low to good." Null unless both moods exist. */
export function moodSentence(before: MoodScore | null | undefined, after: MoodScore | null | undefined): string | null {
  const change = moodChange(before, after);
  if (change === null) return null;
  if (change === 0) return `Mood steady at ${MOOD_WORDS[before!]}.`;
  return `Mood ${change > 0 ? "up" : "down"} from ${MOOD_WORDS[before!]} to ${MOOD_WORDS[after!]}.`;
}

/** One session's before and after, both given. */
export interface SessionMood {
  sessionId: string;
  /** When the after check-in was taken (ISO 8601). */
  at: string;
  before: MoodScore;
  after: MoodScore;
  change: number;
}

/**
 * Before and after paired per session, newest first. Sessions missing either
 * check-in, and check-ins whose session was deleted, are left out. Should a
 * session hold two of one phase, the later one counts.
 */
export function moodPairs(checkins: readonly MoodCheckin[]): SessionMood[] {
  const bySession = new Map<string, Partial<Record<MoodCheckin["phase"], MoodCheckin>>>();
  for (const c of checkins) {
    if (!c.sessionId) continue;
    const entry = bySession.get(c.sessionId) ?? {};
    const held = entry[c.phase];
    if (!held || held.createdAt < c.createdAt) entry[c.phase] = c;
    bySession.set(c.sessionId, entry);
  }
  const pairs: SessionMood[] = [];
  for (const [sessionId, { before, after }] of bySession) {
    if (!before || !after) continue;
    pairs.push({ sessionId, at: after.createdAt, before: before.mood, after: after.mood, change: after.mood - before.mood });
  }
  return pairs.sort((a, b) => b.at.localeCompare(a.at));
}

export interface MoodTrend {
  /** Days looked back over. */
  days: number;
  /** Sessions in that span with both check-ins. */
  sessions: number;
  /** Mean change after minus before, to one decimal. */
  averageChange: number;
  /** The latest few sessions, oldest first, for a small chart. */
  recent: SessionMood[];
}

const DAY = 86_400_000;
const RECENT = 7;

/** Focus Home's mood trend over the last `days` days; null when no session there has both check-ins. */
export function moodTrend(checkins: readonly MoodCheckin[], now: Date, days = 14): MoodTrend | null {
  const from = now.getTime() - days * DAY;
  const pairs = moodPairs(checkins).filter((p) => {
    const at = Date.parse(p.at);
    return at > from && at <= now.getTime();
  });
  if (pairs.length === 0) return null;
  const mean = pairs.reduce((sum, p) => sum + p.change, 0) / pairs.length;
  return {
    days,
    sessions: pairs.length,
    averageChange: Math.round(mean * 10) / 10,
    recent: pairs.slice(0, RECENT).reverse(),
  };
}

/** Home's line for the trend: "Your mood rises 1.2 points on average after a session." */
export function moodTrendLine(trend: MoodTrend): string {
  const n = Math.abs(trend.averageChange);
  const points = `${n} ${n === 1 ? "point" : "points"}`;
  if (trend.averageChange > 0) return `Your mood rises ${points} on average after a session.`;
  if (trend.averageChange < 0) return `Your mood dips ${points} on average after a session.`;
  return "Your mood holds steady from before a session to after.";
}
