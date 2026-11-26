// Mood check-ins around a session (Focus, J6): the person's own, stored beside
// the session in `mood_checkins`, private even from linked professionals.

import { and, desc, eq, sql } from "drizzle-orm";
import type { SessionMoods } from "@/lib/backend/types";
import { moodsProblem } from "@/lib/domain/mood";
import type { MoodCheckin, MoodScore } from "@/lib/domain/types";
import { canUseOwnMoods } from "../authz";
import { breathSessions, moodCheckins } from "../db/schema";
import { fail, jsonObject, type DataApp, type DataDeps } from "./data";

/** As the local adapter: 200 check-ins unless asked for fewer. */
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

type Row = typeof moodCheckins.$inferSelect;

export function moodRoutes(routes: DataApp, { db }: DataDeps) {
  // Replaces the session's check-ins with these; a null phase stores nothing for it.
  routes.put("/athletes/:athleteId/sessions/:sessionId/mood", async (c) => {
    const { athleteId, sessionId } = c.req.param();
    if (!canUseOwnMoods(c.get("uid"), athleteId)) fail("permission-denied");
    const { before = null, after = null } = await jsonObject(c.req.raw);
    const problem = moodsProblem({ before, after });
    if (problem) fail("invalid-input", problem);
    const moods = { before, after } as SessionMoods;
    const [session] = await db
      .select({ startedAt: breathSessions.startedAt })
      .from(breathSessions)
      .where(and(eq(breathSessions.athleteId, athleteId), eq(breathSessions.id, sessionId)));
    if (!session) fail("not-found");

    // The before check-in was taken as the session began; the after one is stored now.
    const at = { before: session.startedAt, after: new Date() };
    const rows = (["after", "before"] as const).flatMap((phase) => {
      const mood = moods[phase];
      return mood === null ? [] : [{ id: crypto.randomUUID(), userId: athleteId, sessionId, phase, mood, createdAt: at[phase] }];
    });
    const forSession = and(eq(moodCheckins.userId, athleteId), eq(moodCheckins.sessionId, sessionId));
    // One batch: the old check-ins go and the new ones land together.
    await db.batch([db.delete(moodCheckins).where(forSession), ...(rows.length > 0 ? [db.insert(moodCheckins).values(rows)] : [])]);
    const stored = await db.select().from(moodCheckins).where(forSession).orderBy(desc(moodCheckins.createdAt));
    return c.json(stored.map(toCheckin));
  });

  routes.get("/athletes/:athleteId/mood-checkins", async (c) => {
    const athleteId = c.req.param("athleteId");
    if (!canUseOwnMoods(c.get("uid"), athleteId)) fail("permission-denied");
    const asked = Number(c.req.query("limit") ?? DEFAULT_LIMIT);
    if (!Number.isInteger(asked) || asked < 1) fail("invalid-input", "limit: a whole number from 1");
    const rows = await db
      .select()
      .from(moodCheckins)
      .where(eq(moodCheckins.userId, athleteId))
      .orderBy(desc(moodCheckins.createdAt), desc(sql`rowid`))
      .limit(Math.min(asked, MAX_LIMIT));
    return c.json(rows.map(toCheckin));
  });
}

function toCheckin(row: Row): MoodCheckin {
  return {
    id: row.id,
    athleteId: row.userId,
    sessionId: row.sessionId,
    phase: row.phase,
    mood: row.mood as MoodScore,
    createdAt: row.createdAt.toISOString(),
  };
}
