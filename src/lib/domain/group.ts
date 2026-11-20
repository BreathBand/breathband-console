import { formatScore } from "./scores";
import type { GroupSession, PacerHalfCycle } from "./types";
import type { BreathDeviation } from "./waveform";

// The shared pacer of a group session, and how the host's screen reads each
// athlete's last breath. Measurements for display, not scores: scores come
// from each athlete's app when the session ends.

type PacerPlan = Pick<GroupSession, "pacerHalfCycleSec" | "pacerChanges">;

/** The pacer's half cycle (seconds in, seconds out) at `t` seconds after the start. */
export function pacerAt(plan: PacerPlan, t: number): PacerHalfCycle {
  let half = plan.pacerHalfCycleSec;
  for (const c of plan.pacerChanges) if (c.atSec <= t) half = c.pacerHalfCycleSec;
  return half;
}

/**
 * The pacer's phase in radians at `t`: π per half cycle, accumulated across
 * pacer switches so the pacer never jumps. The pacer starts at the bottom of
 * an exhale; its value is −cos(phase), so rising (inhale) comes first.
 */
export function pacerPhase(plan: PacerPlan, t: number): number {
  let phase = 0;
  let from = 0;
  let half: number = plan.pacerHalfCycleSec;
  for (const c of [...plan.pacerChanges].sort((a, b) => a.atSec - b.atSec)) {
    if (c.atSec >= t) break;
    phase += (Math.PI * (c.atSec - from)) / half;
    from = c.atSec;
    half = c.pacerHalfCycleSec;
  }
  return phase + (Math.PI * (Math.max(0, t) - from)) / half;
}

/** −1 (fully out) to 1 (fully in). */
export function pacerValue(plan: PacerPlan, t: number): number {
  return -Math.cos(pacerPhase(plan, t));
}

/** "in" while the pacer rises, "out" while it falls, and seconds left in that phase. */
export function pacerCue(plan: PacerPlan, t: number): { dir: "in" | "out"; secondsLeft: number } {
  const phase = pacerPhase(plan, t);
  const intoHalf = phase % (2 * Math.PI);
  const dir = intoHalf < Math.PI ? "in" : "out";
  const left = ((Math.PI - (intoHalf % Math.PI)) / Math.PI) * pacerAt(plan, t);
  return { dir, secondsLeft: Math.max(0, left) };
}

export type LiveState = "with" | "late" | "early" | "shallow" | "settling";

/**
 * A plain-words read of the last breath for the host's grid. Late or early
 * means a turning point more than a quarter of a half cycle off the pacer's;
 * shallow means falling short of the pacer by more than a third.
 */
export function liveRead(last: BreathDeviation | undefined, half: number): { state: LiveState; text: string } {
  if (!last) return { state: "settling", text: "Settling in" };
  const lag = (last.inLag + last.outLag) / 2;
  const depth = (last.inDepth + last.outDepth) / 2;
  if (depth < -33) return { state: "shallow", text: "Shallow" };
  if (lag > half / 4) return { state: "late", text: "Behind the pacer" };
  if (lag < -half / 4) return { state: "early", text: "Ahead of the pacer" };
  return { state: "with", text: "With the pacer" };
}

/** "+0.4 s" / "−0.2 s". */
export function formatLag(sec: number): string {
  const r = Math.round(sec * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r).toFixed(1)} s`;
}

/** "−8%" / "+3%". */
export function formatDepth(pct: number): string {
  return `${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${Math.abs(Math.round(pct))}%`;
}

export const GROUP_SIZE = { min: 2, max: 30 } as const;

/** Sessions under this are discarded, as in the app. */
export const MIN_SAVED_SEC = 30;

export function describeGroupAverage(avg: number | null): string {
  return avg === null ? "–" : formatScore(avg);
}

/** "5-5", or "5-5 → 2-2" when the host switched the pacer. */
export function describePacer(g: PacerPlan): string {
  const halves = [g.pacerHalfCycleSec, ...g.pacerChanges.map((c) => c.pacerHalfCycleSec)];
  return [...new Set(halves)].map((h) => `${h}-${h}`).join(" → ");
}
