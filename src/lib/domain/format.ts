import type { SessionSummary } from "./types";

export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatSessionDate(iso: string, locale?: string): string {
  return new Date(iso).toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Sun 8 Nov" (order follows the viewer's locale). */
export function formatDay(iso: string, locale?: string, withWeekday = true): string {
  return new Date(iso).toLocaleDateString(locale, {
    ...(withWeekday && { weekday: "short" }),
    day: "numeric",
    month: "short",
  });
}

/** "Sun 8 Nov 2026" */
export function formatLongDay(iso: string, locale?: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "7:36 AM" (or "07:36") in the viewer's time zone. */
export function formatTime(iso: string, locale?: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

/** "Paced 5-5" or "Open", as the app labels sessions. */
export function describeMode(session: Pick<SessionSummary, "mode" | "pacerHalfCycleSec">): string {
  if (session.mode === "open") return "Open";
  const half = session.pacerHalfCycleSec;
  return `Paced ${half}-${half}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}
