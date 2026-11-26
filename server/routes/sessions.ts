// /api/v1/athletes/{athleteId}/sessions: list, get, save (with its signal),
// change the note, delete. The athlete writes; the athlete and linked coaches read.

import { and, desc, eq, lt } from "drizzle-orm";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { checkSessionContract } from "@/lib/backend/local/validate";
import { BackendError } from "@/lib/backend/types";
import type { NewSession } from "@/lib/backend/types";
import { isTransitionScores } from "@/lib/domain/scores";
import type { SessionSummary, Waveform } from "@/lib/domain/types";
import { canReadAthlete, canWriteOwn } from "../authz";
import { breathSessions } from "../db/schema";
import { waveformKey } from "../storage";
import { fail, jsonObject, linkScope, type DataApp, type DataDeps } from "./data";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_NOTE = 2000;
/** storage.rules: a signal under 5 MB. The request carries the summary too. */
const MAX_WAVEFORM_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_WAVEFORM_BYTES + 1024 * 1024;

const json = z.record(z.string(), z.unknown());

/** What the recorder hands over (`NewSession`); the server assigns id, athleteId and waveformPath. */
const newSessionSchema = z.object({
  startedAt: z.iso.datetime({ offset: true }),
  durationSec: z.number().positive(),
  mode: z.enum(["paced", "open"]),
  pacerHalfCycleSec: z.union([z.literal(2), z.literal(5)]).nullable(),
  scores: json.nullable(),
  scoringVersion: z.string().min(1).max(40),
  respirationRateBpm: z.number().nullable(),
  note: z.string(),
  appVersion: z.string().max(80),
  groupSessionId: z.string().nullable().optional(),
  skillLevel: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
  paced: json.nullable().optional(),
  open: json.nullable().optional(),
  source: z.enum(["app", "web"]).optional(),
});

const numbers = z.array(z.number());

const waveformSchema = z.object({
  sampleIntervalMs: z.number().positive(),
  user: numbers,
  units: z.enum(["raw", "pct-max"]).optional(),
  pacer: numbers.nullable(),
  markers: z.array(z.number().int().nonnegative()),
  calibration: z.object({
    min: z.number(),
    max: z.number(),
    a100: z.number().optional(),
    midline: z.number().optional(),
    peaks: numbers.optional(),
    troughs: numbers.optional(),
  }),
});

type Row = typeof breathSessions.$inferSelect;

export function sessionRoutes(routes: DataApp, { db, storage }: DataDeps) {
  const findSession = async (athleteId: string, sessionId: string) => {
    const [row] = await db
      .select()
      .from(breathSessions)
      .where(and(eq(breathSessions.athleteId, athleteId), eq(breathSessions.id, sessionId)));
    return row;
  };

  const assertCanRead = async (viewer: string, athleteId: string) => {
    const link = viewer === athleteId ? null : await linkScope(db, viewer, athleteId);
    if (!canReadAthlete(viewer, athleteId, link)) fail("permission-denied");
  };

  routes.get("/athletes/:athleteId/sessions", async (c) => {
    const athleteId = c.req.param("athleteId");
    await assertCanRead(c.get("uid"), athleteId);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(c.req.query("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT));
    const before = c.req.query("before");
    const beforeTime = before ? new Date(before) : null;
    if (beforeTime && Number.isNaN(beforeTime.getTime())) fail("invalid-input", "before: an ISO timestamp");
    const rows = await db
      .select()
      .from(breathSessions)
      .where(and(eq(breathSessions.athleteId, athleteId), beforeTime ? lt(breathSessions.startedAt, beforeTime) : undefined))
      .orderBy(desc(breathSessions.startedAt))
      .limit(limit);
    return c.json(rows.map(toSummary));
  });

  routes.get("/athletes/:athleteId/sessions/:sessionId", async (c) => {
    const { athleteId, sessionId } = c.req.param();
    await assertCanRead(c.get("uid"), athleteId);
    const row = await findSession(athleteId, sessionId);
    if (!row) fail("not-found");
    return c.json(toSummary(row));
  });

  routes.post("/athletes/:athleteId/sessions", bodyLimit({ maxSize: MAX_BODY_BYTES, onError: () => fail("invalid-input", "signal over 5 MB") }), async (c) => {
    const athleteId = c.req.param("athleteId");
    if (!canWriteOwn(c.get("uid"), athleteId)) fail("permission-denied");
    const body = await jsonObject(c.req.raw);
    const parsedSession = newSessionSchema.safeParse(body.session);
    if (!parsedSession.success) fail("invalid-input", `session: ${z.prettifyError(parsedSession.error)}`);
    const parsedWaveform = waveformSchema.safeParse(body.waveform);
    if (!parsedWaveform.success) fail("invalid-input", `waveform: ${z.prettifyError(parsedWaveform.error)}`);
    const session = parsedSession.data as NewSession;
    const waveform = parsedWaveform.data as Waveform;

    // The local adapter's checks, in its order (src/lib/backend/local/index.ts saveSession).
    if (waveform.user.length === 0) fail("invalid-input", "empty recording");
    if (waveform.pacer && waveform.pacer.length !== waveform.user.length) {
      fail("invalid-input", "pacer and user signals differ in length");
    }
    const id = crypto.randomUUID();
    const summary: SessionSummary = {
      ...session,
      id,
      athleteId,
      waveformPath: waveformKey(athleteId, id),
      note: session.note.trim().slice(0, MAX_NOTE),
    };
    try {
      checkSessionContract(summary, waveform);
    } catch (error) {
      if (error instanceof BackendError) fail("invalid-input", error.message);
      throw error;
    }
    if (JSON.stringify(waveform).length > MAX_WAVEFORM_BYTES) fail("invalid-input", "signal over 5 MB");

    await storage.putJson(summary.waveformPath, waveform);
    try {
      const [row] = await db.insert(breathSessions).values(toRow(summary)).returning();
      return c.json(toSummary(row));
    } catch (error) {
      await storage.delete(summary.waveformPath);
      throw error;
    }
  });

  routes.put("/athletes/:athleteId/sessions/:sessionId/note", async (c) => {
    const { athleteId, sessionId } = c.req.param();
    if (!canWriteOwn(c.get("uid"), athleteId)) fail("permission-denied");
    const { note } = await jsonObject(c.req.raw);
    if (typeof note !== "string") fail("invalid-input", "note: text");
    const updated = await db
      .update(breathSessions)
      .set({ note: note.trim().slice(0, MAX_NOTE) })
      .where(and(eq(breathSessions.athleteId, athleteId), eq(breathSessions.id, sessionId)))
      .returning({ id: breathSessions.id });
    if (updated.length === 0) fail("not-found");
    return c.json({ ok: true });
  });

  routes.delete("/athletes/:athleteId/sessions/:sessionId", async (c) => {
    const { athleteId, sessionId } = c.req.param();
    if (!canWriteOwn(c.get("uid"), athleteId)) fail("permission-denied");
    // Comments, kudos and seen marks go with it (foreign keys cascade).
    const [deleted] = await db
      .delete(breathSessions)
      .where(and(eq(breathSessions.athleteId, athleteId), eq(breathSessions.id, sessionId)))
      .returning({ waveformPath: breathSessions.waveformPath });
    if (!deleted) fail("not-found");
    await storage.delete(deleted.waveformPath);
    return c.json({ ok: true });
  });
}

function toRow(s: SessionSummary): typeof breathSessions.$inferInsert {
  const total = s.scores === null ? null : isTransitionScores(s.scores) ? s.scores.total : s.scores.overall;
  return {
    id: s.id,
    athleteId: s.athleteId,
    startedAt: new Date(s.startedAt),
    durationSec: s.durationSec,
    mode: s.mode,
    pacerHalfCycleSec: s.pacerHalfCycleSec,
    scoringVersion: s.scoringVersion,
    respirationRateBpm: s.respirationRateBpm,
    total: typeof total === "number" ? total : null,
    source: s.source ?? null,
    skillLevel: s.skillLevel ?? null,
    scores: s.scores,
    paced: s.paced ?? null,
    open: s.open ?? null,
    note: s.note,
    // Group sessions are stored by I-10; until then a client can't point at one.
    groupSessionId: null,
    waveformPath: s.waveformPath,
    appVersion: s.appVersion,
  };
}

function toSummary(row: Row): SessionSummary {
  const summary: SessionSummary = {
    id: row.id,
    athleteId: row.athleteId,
    startedAt: row.startedAt.toISOString(),
    durationSec: row.durationSec,
    mode: row.mode,
    pacerHalfCycleSec: row.pacerHalfCycleSec ?? null,
    scores: row.scores ?? null,
    scoringVersion: row.scoringVersion,
    respirationRateBpm: row.respirationRateBpm,
    note: row.note,
    waveformPath: row.waveformPath,
    appVersion: row.appVersion,
  };
  if (row.groupSessionId) summary.groupSessionId = row.groupSessionId;
  if (row.skillLevel) summary.skillLevel = row.skillLevel;
  if (row.paced) summary.paced = row.paced;
  if (row.open) summary.open = row.open;
  if (row.source) summary.source = row.source;
  return summary;
}
