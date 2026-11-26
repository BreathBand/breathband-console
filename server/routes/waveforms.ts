// GET /api/v1/athletes/{athleteId}/sessions/{sessionId}/waveform: the signal,
// read from the StorageService at the session's stored waveformPath (never a
// path from the request). The athlete, or a coach whose link has "curves".

import { and, eq } from "drizzle-orm";
import type { Waveform } from "@/lib/domain/types";
import { canReadCurves } from "../authz";
import { breathSessions } from "../db/schema";
import { fail, linkScope, type DataApp, type DataDeps } from "./data";

export function waveformRoutes(routes: DataApp, { db, storage }: DataDeps) {
  routes.get("/athletes/:athleteId/sessions/:sessionId/waveform", async (c) => {
    const { athleteId, sessionId } = c.req.param();
    const viewer = c.get("uid");
    const link = viewer === athleteId ? null : await linkScope(db, viewer, athleteId);
    if (!canReadCurves(viewer, athleteId, link)) fail("permission-denied");
    const [row] = await db
      .select({ waveformPath: breathSessions.waveformPath })
      .from(breathSessions)
      .where(and(eq(breathSessions.athleteId, athleteId), eq(breathSessions.id, sessionId)));
    const waveform = row ? await storage.getJson<Waveform>(row.waveformPath) : null;
    if (!waveform) fail("not-found");
    return c.json(waveform);
  });
}
