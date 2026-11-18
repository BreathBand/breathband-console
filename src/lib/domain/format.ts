import type { SessionSummary } from "./types";

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
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

export function describeMode(session: Pick<SessionSummary, "mode" | "pacerHalfCycleSec">): string {
  if (session.mode === "open") return "Open breathing";
  const half = session.pacerHalfCycleSec;
  return `Paced ${half}–${half} s`;
}
