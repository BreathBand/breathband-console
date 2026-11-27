// Calibrations (F8): the person's own, one per time the band went on, with the
// band that took it. Only the newest is read back; the export has them all.

import { desc, eq, sql } from "drizzle-orm";
import { calibrationProblem } from "@/lib/backend/local/validate";
import type { CalibrationRecord, NewCalibration } from "@/lib/backend/types";
import { canWriteOwn } from "../authz";
import { calibrations } from "../db/schema";
import { fail, jsonObject, type DataApp, type DataDeps } from "./data";

type Row = typeof calibrations.$inferSelect;

const toRecord = (r: Row): CalibrationRecord => ({ a100: r.a100, midline: r.midline, source: r.source, bandName: r.bandName, at: r.createdAt.toISOString() });

export function calibrationRoutes(routes: DataApp, { db }: DataDeps) {
  routes.post("/users/:uid/calibrations", async (c) => {
    const uid = c.req.param("uid");
    if (!canWriteOwn(c.get("uid"), uid)) fail("permission-denied");
    const { a100, midline, source, bandName = null } = await jsonObject(c.req.raw);
    const given = { a100, midline, source, bandName } as NewCalibration;
    const problem = calibrationProblem(given);
    if (problem) fail("invalid-input", problem);
    // Until the band reports its range, the extremes are the scale's own.
    const [row] = await db
      .insert(calibrations)
      .values({ userId: uid, a100: given.a100, midline: given.midline, min: given.midline - given.a100 / 2, max: given.midline + given.a100 / 2, source: given.source, bandName: given.bandName })
      .returning();
    return c.json(toRecord(row));
  });

  routes.get("/users/:uid/calibrations/latest", async (c) => {
    const uid = c.req.param("uid");
    if (!canWriteOwn(c.get("uid"), uid)) fail("permission-denied");
    const [row] = await db
      .select()
      .from(calibrations)
      .where(eq(calibrations.userId, uid))
      .orderBy(desc(calibrations.createdAt), desc(sql`rowid`))
      .limit(1);
    return c.json({ calibration: row ? toRecord(row) : null });
  });
}
