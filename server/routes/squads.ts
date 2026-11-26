// A coach's squads: their own grouping of linked athletes, by name.

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Squad } from "@/lib/domain/types";
import { canSaveSquad, canUseCoachData } from "../authz";
import { squadMembers, squads } from "../db/schema";
import { fail, jsonObject, linkScope, type DataApp, type DataDeps } from "./data";

/** As the local adapter: a squad name keeps 40 characters. */
const MAX_NAME = 40;
const MAX_MEMBERS = 200;

const squadSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string(),
  athleteIds: z.array(z.string().min(1)).max(MAX_MEMBERS),
});

export function squadRoutes(routes: DataApp, { db }: DataDeps) {
  /** The coach's squads with their members, members in the order they were saved. */
  const loadSquads = async (coachId: string, onlyId?: string): Promise<Squad[]> => {
    const rows = await db
      .select()
      .from(squads)
      .where(and(eq(squads.coachId, coachId), onlyId ? eq(squads.id, onlyId) : undefined));
    if (rows.length === 0) return [];
    const members = await db
      .select({ squadId: squadMembers.squadId, athleteId: squadMembers.athleteId })
      .from(squadMembers)
      .where(inArray(squadMembers.squadId, rows.map((r) => r.id)))
      .orderBy(asc(sql`rowid`));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      athleteIds: members.filter((m) => m.squadId === r.id).map((m) => m.athleteId),
      createdAt: r.createdAt.toISOString(),
    }));
  };

  routes.get("/coaches/:coachId/squads", async (c) => {
    const coachId = c.req.param("coachId");
    if (!canUseCoachData(c.get("uid"), coachId)) fail("permission-denied");
    // By name, the way the local adapter sorts (localeCompare, not SQLite's byte order).
    return c.json((await loadSquads(coachId)).sort((a, b) => a.name.localeCompare(b.name)));
  });

  // Creates (no id) or replaces a squad: its name and every member.
  routes.put("/coaches/:coachId/squads", async (c) => {
    const coachId = c.req.param("coachId");
    const viewer = c.get("uid");
    if (!canUseCoachData(viewer, coachId)) fail("permission-denied");
    const parsed = squadSchema.safeParse(await jsonObject(c.req.raw));
    if (!parsed.success) fail("invalid-input", z.prettifyError(parsed.error));
    const { id } = parsed.data;
    const name = parsed.data.name.trim().slice(0, MAX_NAME);
    const athleteIds = [...new Set(parsed.data.athleteIds)];
    if (!name) fail("invalid-input", "name: empty");
    const links = await Promise.all(athleteIds.map((a) => linkScope(db, coachId, a)));
    if (!canSaveSquad(viewer, coachId, links)) fail("permission-denied");

    const members = (squadId: string) =>
      athleteIds.length > 0 ? [db.insert(squadMembers).values(athleteIds.map((athleteId) => ({ squadId, athleteId })))] : [];
    if (!id) {
      const squadId = crypto.randomUUID();
      // One batch: the squad and its members land together or not at all.
      await db.batch([db.insert(squads).values({ id: squadId, coachId, name }), ...members(squadId)]);
      return c.json((await loadSquads(coachId, squadId))[0]);
    }
    const [existing] = await db.select({ id: squads.id }).from(squads).where(and(eq(squads.coachId, coachId), eq(squads.id, id)));
    if (!existing) fail("not-found");
    await db.batch([
      db.update(squads).set({ name }).where(eq(squads.id, id)),
      db.delete(squadMembers).where(eq(squadMembers.squadId, id)),
      ...members(id),
    ]);
    return c.json((await loadSquads(coachId, id))[0]);
  });

  routes.delete("/coaches/:coachId/squads/:squadId", async (c) => {
    const { coachId, squadId } = c.req.param();
    if (!canUseCoachData(c.get("uid"), coachId)) fail("permission-denied");
    // Members go with it (foreign key cascade). An unknown id is a no-op, as on the local adapter.
    await db.delete(squads).where(and(eq(squads.coachId, coachId), eq(squads.id, squadId)));
    return c.json({ ok: true });
  });
}
