import { describeMode, formatDuration } from "./format";
import type { Assignment, SessionComment, SessionSummary } from "./types";

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------- practice plans

export type AssignmentStatus = "active" | "behind" | "done" | "missed" | "cancelled";

export interface AssignmentProgress {
  assignment: Assignment;
  /** Sessions that count toward it, newest first. */
  counted: SessionSummary[];
  done: number;
  status: AssignmentStatus;
  /** Whole days until it's due, counting today; 0 or less once it's past. */
  daysLeft: number;
}

/** A session counts if it matches the mode, pacer and minimum length, inside the assignment's window. */
export function countsToward(assignment: Assignment, session: SessionSummary): boolean {
  return (
    session.athleteId === assignment.athleteId &&
    session.mode === assignment.mode &&
    session.pacerHalfCycleSec === assignment.pacerHalfCycleSec &&
    // A few seconds' grace: a 5:00 session stopped at 4:57 still counts.
    session.durationSec >= assignment.durationSec - 10 &&
    session.startedAt >= assignment.createdAt &&
    session.startedAt <= assignment.dueAt
  );
}

/** Progress on one assignment. `sessions` is the athlete's history, newest first. */
export function assignmentProgress(assignment: Assignment, sessions: SessionSummary[], now: Date): AssignmentProgress {
  const counted = sessions.filter((s) => countsToward(assignment, s));
  const done = Math.min(counted.length, assignment.target);
  const daysLeft = Math.ceil((Date.parse(assignment.dueAt) - now.getTime()) / DAY_MS);
  const remaining = assignment.target - done;
  const status: AssignmentStatus = assignment.cancelled
    ? "cancelled"
    : remaining <= 0
      ? "done"
      : daysLeft <= 0
        ? "missed"
        : remaining > daysLeft
          ? "behind"
          : "active";
  return { assignment, counted, done, status, daysLeft };
}

/** Still in play: not finished, missed or cancelled. */
export const isOpen = (p: AssignmentProgress) => p.status === "active" || p.status === "behind";

/** "Paced 5-5 · 5:00 · 4 times". */
export function describeAssignment(a: Pick<Assignment, "mode" | "pacerHalfCycleSec" | "durationSec" | "target">): string {
  return `${describeMode(a)} · ${formatDuration(a.durationSec)} · ${a.target} ${a.target === 1 ? "time" : "times"}`;
}

export const STATUS_TEXT: Record<AssignmentStatus, string> = {
  active: "On track",
  behind: "Behind",
  done: "Done",
  missed: "Missed",
  cancelled: "Cancelled",
};

/** "Due today", "Due tomorrow", "Due in 3 days", "Was due 2 days ago". */
export function dueText(daysLeft: number): string {
  if (daysLeft === 1) return "Due today";
  if (daysLeft === 2) return "Due tomorrow";
  if (daysLeft > 2) return `Due in ${daysLeft - 1} days`;
  const ago = 1 - daysLeft;
  return ago <= 1 ? "Was due yesterday" : `Was due ${ago} days ago`;
}

// ---------------------------------------------------------------- comments

export interface Thread {
  sessionId: string;
  comments: SessionComment[];
  kudos: SessionComment[];
  /** The newest written comment, if any. */
  last: SessionComment | null;
}

/** Groups an athlete's comments (oldest first) into one thread per session. */
export function threads(comments: SessionComment[]): Map<string, Thread> {
  const map = new Map<string, Thread>();
  for (const c of comments) {
    const t = map.get(c.sessionId) ?? { sessionId: c.sessionId, comments: [], kudos: [], last: null };
    if (c.kind === "kudos") t.kudos.push(c);
    else {
      t.comments.push(c);
      t.last = c;
    }
    map.set(c.sessionId, t);
  }
  return map;
}

/**
 * Threads where the athlete spoke last, so the coach owes a reply. A coach's
 * kudos after the athlete's comment counts as an answer ("Thanks!" needs no
 * reply). Newest first.
 */
export function awaitingReply(comments: SessionComment[]): SessionComment[] {
  return [...threads(comments).values()]
    .filter(
      (t) =>
        t.last?.authorRole === "athlete" &&
        !t.kudos.some((k) => k.authorRole === "coach" && k.createdAt > t.last!.createdAt),
    )
    .map((t) => t.last!)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function timeAgo(iso: string, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

// ---------------------------------------------------------------- calendar

/** Local midnight of the day `iso` falls on, as a sortable key ("2026-11-19"). */
export function dayKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The last `count` days ending today, oldest first. */
export function lastDays(now: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (count - 1 - i));
    return d;
  });
}
