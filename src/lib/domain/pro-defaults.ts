// What the people a professional invites start with, per kind (planning/v1/02
// §4.1 step 7, §5.2): their targets and the sharing scope the invite asks for.
// Stored on `proProfile` as `defaultTargets` and `scopeRequested`. The default
// "needs a look" flags are a separate card (T-0116).

import type { AthleteTargets, ProKind, ProProfile, ShareScope } from "./types";

export interface ProDefaults {
  /** Partial: a clinician starts with no score target, an educator with sessions a week only. */
  defaultTargets: Partial<AthleteTargets>;
  scopeRequested: ShareScope;
}

const DEFAULTS: Record<ProKind, ProDefaults> = {
  coach: { defaultTargets: { score: 7, rateLow: 12, rateHigh: 16, sessionsPerWeek: 4 }, scopeRequested: "curves" },
  clinician: { defaultTargets: { sessionsPerWeek: 5 }, scopeRequested: "curves" },
  educator: { defaultTargets: { sessionsPerWeek: 3 }, scopeRequested: "scores" },
};

/** A kind's defaults, as a fresh copy. */
export function proDefaults(kind: ProKind): ProDefaults {
  const d = DEFAULTS[kind];
  return { defaultTargets: { ...d.defaultTargets }, scopeRequested: d.scopeRequested };
}

/** The profile with its kind's defaults filled in where it has none (profiles saved before T-0118 have none). */
export function withProDefaults(p: ProProfile): ProProfile {
  const d = proDefaults(p.kind);
  return {
    ...p,
    defaultTargets: p.defaultTargets ? { ...p.defaultTargets } : d.defaultTargets,
    scopeRequested: p.scopeRequested ?? d.scopeRequested,
  };
}

/** The choices for sessions a week in onboarding. */
export const SESSIONS_PER_WEEK_CHOICES = [2, 3, 4, 5, 6, 7] as const;

export const SCOPE_CHOICES: { id: ShareScope; label: string; detail: string }[] = [
  { id: "curves", label: "Scores and curves", detail: "Every session's scores and the breathing curve behind them." },
  { id: "scores", label: "Scores only", detail: "Scores and notes; the breathing curves stay private." },
];

/** "Total 7 · 12–16 breaths a minute · 4 sessions a week"; "5 sessions a week". */
export function targetsText(t: Partial<AthleteTargets>): string {
  const parts: string[] = [];
  if (t.score !== undefined) parts.push(`Total ${t.score}`);
  if (t.rateLow !== undefined && t.rateHigh !== undefined) parts.push(`${t.rateLow}–${t.rateHigh} breaths a minute`);
  if (t.sessionsPerWeek !== undefined) parts.push(`${t.sessionsPerWeek} session${t.sessionsPerWeek === 1 ? "" : "s"} a week`);
  return parts.join(" · ");
}

export const scopeText = (scope: ShareScope) => SCOPE_CHOICES.find((s) => s.id === scope)?.label ?? "";

const TARGET_KEYS = ["score", "rateLow", "rateHigh", "sessionsPerWeek"];
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, low: number, high: number) => typeof v === "number" && Number.isFinite(v) && v >= low && v <= high;

/**
 * Why `defaultTargets` / `scopeRequested` can't be stored, or null. Both may
 * be absent. Ranges match the adapter's setTargets: score 1–10, rate 4–40
 * with low under high (both or neither), 1–21 whole sessions a week (required).
 */
export function proDefaultsProblem(p: Pick<ProProfile, "defaultTargets" | "scopeRequested">): string | null {
  const f = "proProfile";
  if (p.scopeRequested !== undefined && p.scopeRequested !== "scores" && p.scopeRequested !== "curves") return `${f}.scopeRequested: scores or curves`;
  const t: unknown = p.defaultTargets;
  if (t === undefined) return null;
  if (!isObject(t)) return `${f}.defaultTargets: an object`;
  for (const k of Object.keys(t)) if (!TARGET_KEYS.includes(k)) return `${f}.defaultTargets: unknown "${k}"`;
  if (!Number.isInteger(t.sessionsPerWeek) || !num(t.sessionsPerWeek, 1, 21)) return `${f}.defaultTargets.sessionsPerWeek: a whole number, 1–21`;
  if (t.score !== undefined && !num(t.score, 1, 10)) return `${f}.defaultTargets.score: 1–10`;
  if ((t.rateLow === undefined) !== (t.rateHigh === undefined)) return `${f}.defaultTargets: rateLow and rateHigh together`;
  if (t.rateLow !== undefined && !(num(t.rateLow, 4, 40) && num(t.rateHigh, 4, 40) && (t.rateLow as number) < (t.rateHigh as number))) {
    return `${f}.defaultTargets: rate 4–40, low under high`;
  }
  return null;
}
