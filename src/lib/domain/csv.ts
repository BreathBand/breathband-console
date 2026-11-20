import { describeMode } from "./format";
import { isLegacyScores, isTransitionScores } from "./scores";
import type { SessionSummary } from "./types";

/** Quotes a CSV field when it needs it (RFC 4180). */
function field(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * One row per session, for a spreadsheet. Dates are ISO 8601 in UTC so the
 * file sorts and imports the same everywhere.
 */
export function sessionsCsv(sessions: SessionSummary[]): string {
  const header = [
    "Started (UTC)",
    "Type",
    "Duration (s)",
    "Scoring",
    "Total Breath Score",
    "Timing in",
    "Timing out",
    "Depth in",
    "Depth out",
    "Legacy overall (%)",
    "Breathing rate (br/min)",
    "Note",
  ];
  const rows = sessions.map((s) => {
    const t = isTransitionScores(s.scores) ? s.scores : null;
    const legacy = isLegacyScores(s.scores) ? s.scores : null;
    return [
      s.startedAt,
      describeMode(s),
      s.durationSec,
      s.scoringVersion,
      t?.total ?? null,
      t?.timing.inhale ?? null,
      t?.timing.exhale ?? null,
      t?.depth.inhale ?? null,
      t?.depth.exhale ?? null,
      legacy?.overall ?? null,
      s.respirationRateBpm,
      s.note,
    ];
  });
  return [header, ...rows].map((r) => r.map(field).join(",")).join("\r\n") + "\r\n";
}
