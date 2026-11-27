// What a coach and an athlete say to each other: assignments (practice a linked
// coach sets), and comments and kudos on the athlete's sessions.

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Assignment, SessionComment } from "@/lib/domain/types";
import { canCancelAssignment, canCoach, canComment, canDeleteComment, canReadAthlete } from "../authz";
import { assignments, breathSessions, comments, kudos } from "../db/schema";
import { fail, jsonObject, linkScope, type DataApp, type DataDeps } from "./data";
import { loadProfile } from "./profile";

/** As the local adapter: an assignment note keeps 500 characters, a comment 1000. */
const MAX_ASSIGNMENT_NOTE = 500;
const MAX_COMMENT = 1000;

const newAssignmentSchema = z.object({
  athleteId: z.string().min(1),
  mode: z.enum(["paced", "open"]),
  pacerHalfCycleSec: z.union([z.literal(2), z.literal(5)]).nullable(),
  durationSec: z.number(),
  target: z.number(),
  dueAt: z.iso.datetime({ offset: true }),
  note: z.string(),
});

type AssignmentRow = typeof assignments.$inferSelect;

export function feedbackRoutes(routes: DataApp, { db, notify }: DataDeps) {
  /** The viewer's link to the athlete (none for the athlete themselves). */
  const scopeOf = (viewer: string, athleteId: string) => (viewer === athleteId ? null : linkScope(db, viewer, athleteId));

  const assertCanRead = async (viewer: string, athleteId: string) => {
    if (!canReadAthlete(viewer, athleteId, await scopeOf(viewer, athleteId))) fail("permission-denied");
  };

  routes.get("/athletes/:athleteId/assignments", async (c) => {
    const athleteId = c.req.param("athleteId");
    await assertCanRead(c.get("uid"), athleteId);
    const rows = await db
      .select()
      .from(assignments)
      .where(eq(assignments.athleteId, athleteId))
      .orderBy(desc(assignments.createdAt), desc(sql`rowid`));
    return c.json(rows.map(toAssignment));
  });

  routes.post("/coaches/:coachId/assignments", async (c) => {
    const coachId = c.req.param("coachId");
    const viewer = c.get("uid");
    if (viewer !== coachId) fail("permission-denied");
    const parsed = newAssignmentSchema.safeParse(await jsonObject(c.req.raw));
    if (!parsed.success) fail("invalid-input", z.prettifyError(parsed.error));
    const input = parsed.data;
    if (!canCoach(viewer, coachId, await linkScope(db, coachId, input.athleteId))) fail("permission-denied");
    // The local adapter's checks (src/lib/backend/local/index.ts createAssignment).
    const dueAt = new Date(input.dueAt);
    if (
      !Number.isInteger(input.target) ||
      input.target < 1 ||
      input.target > 30 ||
      input.durationSec < 60 ||
      (input.mode === "paced") !== (input.pacerHalfCycleSec !== null) ||
      dueAt.getTime() <= Date.now()
    ) {
      fail("invalid-input", "target 1–30, at least 60 s, a pacer only for paced practice, due in the future");
    }
    const [row] = await db
      .insert(assignments)
      .values({ ...input, coachId, dueAt, note: input.note.trim().slice(0, MAX_ASSIGNMENT_NOTE), cancelled: false })
      .returning();
    await notify.practiceSet(coachId, input.athleteId, input);
    return c.json(toAssignment(row));
  });

  routes.post("/athletes/:athleteId/assignments/:assignmentId/cancel", async (c) => {
    const { athleteId, assignmentId } = c.req.param();
    const where = and(eq(assignments.athleteId, athleteId), eq(assignments.id, assignmentId));
    const [existing] = await db.select({ coachId: assignments.coachId }).from(assignments).where(where);
    if (!existing) fail("not-found");
    if (!canCancelAssignment(c.get("uid"), existing.coachId)) fail("permission-denied");
    await db.update(assignments).set({ cancelled: true }).where(where);
    return c.json({ ok: true });
  });

  // Comments and kudos live in two tables; the adapter sees one thread, oldest first.
  routes.get("/athletes/:athleteId/comments", async (c) => {
    const athleteId = c.req.param("athleteId");
    await assertCanRead(c.get("uid"), athleteId);
    const sessionId = c.req.query("sessionId");
    const [said, marks] = await Promise.all([
      db.select().from(comments).where(and(eq(comments.athleteId, athleteId), sessionId ? eq(comments.sessionId, sessionId) : undefined)).orderBy(asc(comments.createdAt), asc(sql`rowid`)),
      db.select().from(kudos).where(and(eq(kudos.athleteId, athleteId), sessionId ? eq(kudos.sessionId, sessionId) : undefined)).orderBy(asc(kudos.createdAt), asc(sql`rowid`)),
    ]);
    const thread = [...said.map((r) => toComment(r, "comment", r.text)), ...marks.map((r) => toComment(r, "kudos", ""))];
    // Every createdAt is distinct per athlete (threadTime), so this is write order.
    thread.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return c.json(thread);
  });

  routes.post("/athletes/:athleteId/sessions/:sessionId/comments", async (c) => {
    const { athleteId, sessionId } = c.req.param();
    const viewer = c.get("uid");
    if (!canComment(viewer, athleteId, await scopeOf(viewer, athleteId))) fail("permission-denied");
    const [session] = await db
      .select({ id: breathSessions.id })
      .from(breathSessions)
      .where(and(eq(breathSessions.athleteId, athleteId), eq(breathSessions.id, sessionId)));
    if (!session) fail("not-found");
    const { kind, text } = await jsonObject(c.req.raw);
    const author = await loadProfile(db, viewer, false);
    if (!author) fail("not-found");
    const by = { athleteId, sessionId, authorId: viewer, authorName: author.displayName, authorRole: author.role };

    if (kind === "kudos") {
      // One per person per session (a unique index): a second is a no-op that returns the first.
      await db.insert(kudos).values({ ...by, createdAt: threadTime(athleteId) }).onConflictDoNothing();
      const [row] = await db.select().from(kudos).where(and(eq(kudos.sessionId, sessionId), eq(kudos.authorId, viewer)));
      return c.json(toComment(row, "kudos", ""));
    }
    if (kind !== "comment") fail("invalid-input", "kind: comment or kudos");
    const body = typeof text === "string" ? text.trim().slice(0, MAX_COMMENT) : "";
    if (!body) fail("invalid-input", "text: empty");
    const [row] = await db.insert(comments).values({ ...by, text: body, createdAt: threadTime(athleteId) }).returning();
    return c.json(toComment(row, "comment", row.text));
  });

  routes.delete("/athletes/:athleteId/sessions/:sessionId/comments/:commentId", async (c) => {
    const { athleteId, sessionId, commentId } = c.req.param();
    for (const table of [comments, kudos]) {
      const where = and(eq(table.athleteId, athleteId), eq(table.sessionId, sessionId), eq(table.id, commentId));
      const [existing] = await db.select({ authorId: table.authorId }).from(table).where(where);
      if (!existing) continue;
      if (!canDeleteComment(c.get("uid"), existing.authorId)) fail("permission-denied");
      await db.delete(table).where(where);
      return c.json({ ok: true });
    }
    fail("not-found");
  });
}

/**
 * The createdAt for a new comment or kudos: now, or 1 ms after the athlete's newest comment or
 * kudos when that isn't earlier. The two tables merge by createdAt when listed, so a time that
 * only ever goes up per athlete keeps the thread in write order. It is computed inside the
 * INSERT itself, which SQLite (and libSQL) runs under the write lock: two writers in the same
 * millisecond still get two different times.
 */
function threadTime(athleteId: string) {
  return sql`max(
    cast(unixepoch('subsecond') * 1000 as integer),
    coalesce((select max(created_at) from comments where athlete_id = ${athleteId}), 0) + 1,
    coalesce((select max(created_at) from kudos where athlete_id = ${athleteId}), 0) + 1
  )`;
}

function toAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    coachId: row.coachId,
    athleteId: row.athleteId,
    createdAt: row.createdAt.toISOString(),
    mode: row.mode,
    pacerHalfCycleSec: row.pacerHalfCycleSec ?? null,
    durationSec: row.durationSec,
    target: row.target,
    dueAt: row.dueAt.toISOString(),
    note: row.note,
    cancelled: row.cancelled,
  };
}

type AuthoredRow = Pick<typeof comments.$inferSelect, "id" | "athleteId" | "sessionId" | "authorId" | "authorName" | "authorRole" | "createdAt">;

function toComment(row: AuthoredRow, kind: SessionComment["kind"], text: string): SessionComment {
  const { id, athleteId, sessionId, authorId, authorName, authorRole } = row;
  return { id, athleteId, sessionId, authorId, authorName, authorRole, kind, text, createdAt: row.createdAt.toISOString() };
}
