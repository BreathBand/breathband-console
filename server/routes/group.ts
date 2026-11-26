// Group sessions, their state only: a coach opens one for linked athletes
// (lobby), starts it (live), switches the pacer and drops markers, then ends or
// cancels it. The live signal and the athletes' presence travel over a realtime
// channel that a later card brings; until then GET .../live reports presence
// from the state alone and no frames.

import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Presence } from "@/lib/backend/types";
import { GROUP_SIZE, pacerAt } from "@/lib/domain/group";
import type { GroupSession, PacerHalfCycle } from "@/lib/domain/types";
import { canHostGroup, canReadGroup, canRunGroup, isSelf } from "../authz";
import { groupParticipants, groupSessions } from "../db/schema";
import { fail, jsonObject, linkScope, type DataApp, type DataDeps } from "./data";
import { loadProfile } from "./profile";

/** As the local adapter: a title keeps 80 characters; a session runs 1 to 30 minutes. */
const MAX_TITLE = 80;
const MIN_DURATION_SEC = 60;
const MAX_DURATION_SEC = 1800;

const pacerSchema = z.union([z.literal(2), z.literal(5)]);

const newGroupSchema = z.object({
  title: z.string(),
  athleteIds: z.array(z.string().min(1)).max(GROUP_SIZE.max * 2),
  pacerHalfCycleSec: z.number(),
  durationSec: z.number(),
});

type GroupRow = typeof groupSessions.$inferSelect;
type Status = GroupSession["status"];

export function groupRoutes(routes: DataApp, { db }: DataDeps) {
  /** The group sessions with these ids, newest first, with their athletes in the order they were invited. */
  const loadGroups = async (rows: GroupRow[]): Promise<GroupSession[]> => {
    if (rows.length === 0) return [];
    const people = await db
      .select()
      .from(groupParticipants)
      .where(inArray(groupParticipants.groupSessionId, rows.map((r) => r.id)))
      .orderBy(asc(sql`rowid`));
    return rows.map((row) => toGroup(row, people.filter((p) => p.groupSessionId === row.id)));
  };

  const findRow = async (id: string) => (await db.select().from(groupSessions).where(eq(groupSessions.id, id)))[0];

  const findGroup = async (id: string) => {
    const row = await findRow(id);
    return row ? (await loadGroups([row]))[0] : null;
  };

  /**
   * A host-only change to a group session in one of the `from` states, in the
   * local adapter's order: not-found, permission-denied, then invalid-input.
   * The update is conditional on the row just read (its `updated_at`), so of
   * two racing changes one applies and the other is refused.
   */
  const changeGroup = async (viewer: string, id: string, from: Status[], change: (g: GroupSession) => Partial<typeof groupSessions.$inferInsert> | null) => {
    const row = await findRow(id);
    if (!row) fail("not-found");
    const [group] = await loadGroups([row]);
    if (!canRunGroup(viewer, group.hostId)) fail("permission-denied");
    if (!from.includes(group.status)) fail("invalid-input", `the group session is ${group.status}`);
    const values = change(group);
    if (values) {
      const updated = await db
        .update(groupSessions)
        .set(values)
        .where(and(eq(groupSessions.id, id), eq(groupSessions.updatedAt, row.updatedAt)))
        .returning({ id: groupSessions.id });
      if (updated.length === 0) fail("invalid-input", "the group session changed meanwhile");
    }
    return (await findGroup(id))!;
  };

  routes.post("/coaches/:hostId/group-sessions", async (c) => {
    const hostId = c.req.param("hostId");
    const viewer = c.get("uid");
    const parsed = newGroupSchema.safeParse(await jsonObject(c.req.raw));
    if (!parsed.success) fail("invalid-input", z.prettifyError(parsed.error));
    const { pacerHalfCycleSec, durationSec } = parsed.data;
    const athleteIds = [...new Set(parsed.data.athleteIds)];
    const host = isSelf(viewer, hostId) ? await loadProfile(db, hostId, false) : null;
    const links = await Promise.all(athleteIds.map((a) => linkScope(db, hostId, a)));
    if (!host || !canHostGroup(viewer, hostId, host.role, links)) fail("permission-denied");
    if (
      athleteIds.length < GROUP_SIZE.min ||
      athleteIds.length > GROUP_SIZE.max ||
      !pacerSchema.safeParse(pacerHalfCycleSec).success ||
      durationSec < MIN_DURATION_SEC ||
      durationSec > MAX_DURATION_SEC
    ) {
      fail("invalid-input", `${GROUP_SIZE.min}–${GROUP_SIZE.max} athletes, a 2 or 5 s pacer, 60–1800 s`);
    }
    const id = crypto.randomUUID();
    // One batch: the session and its athletes land together or not at all.
    await db.batch([
      db.insert(groupSessions).values({
        id,
        hostId,
        hostName: host.displayName,
        title: parsed.data.title.trim().slice(0, MAX_TITLE) || "Group session",
        pacerHalfCycleSec: pacerHalfCycleSec as PacerHalfCycle,
        durationSec,
      }),
      db.insert(groupParticipants).values(athleteIds.map((athleteId) => ({ groupSessionId: id, athleteId }))),
    ]);
    return c.json(await findGroup(id));
  });

  routes.get("/group-sessions/:id", async (c) => {
    const group = await findGroup(c.req.param("id"));
    if (!group) fail("not-found");
    if (!canReadGroup(c.get("uid"), group.hostId, group.athleteIds)) fail("permission-denied");
    return c.json(group);
  });

  routes.get("/users/:uid/group-sessions", async (c) => {
    const uid = c.req.param("uid");
    if (!isSelf(c.get("uid"), uid)) fail("permission-denied");
    const invitedTo = db.select({ id: groupParticipants.groupSessionId }).from(groupParticipants).where(eq(groupParticipants.athleteId, uid));
    const rows = await db
      .select()
      .from(groupSessions)
      .where(or(eq(groupSessions.hostId, uid), inArray(groupSessions.id, invitedTo)))
      .orderBy(desc(groupSessions.createdAt), desc(sql`rowid`));
    return c.json(await loadGroups(rows));
  });

  routes.post("/group-sessions/:id/start", async (c) =>
    c.json(await changeGroup(c.get("uid"), c.req.param("id"), ["lobby"], () => ({ status: "live", startedAt: new Date() }))),
  );

  routes.put("/group-sessions/:id/pacer", async (c) => {
    const pacer = pacerSchema.safeParse((await jsonObject(c.req.raw)).pacerHalfCycleSec);
    if (!pacer.success) fail("invalid-input", "pacerHalfCycleSec: 2 or 5");
    return c.json(
      await changeGroup(c.get("uid"), c.req.param("id"), ["live"], (g) => {
        const atSec = elapsedSec(g);
        // Asking for the pacer that's already running changes nothing.
        if (pacerAt(g, atSec) === pacer.data) return null;
        return { pacerChanges: [...g.pacerChanges, { atSec, pacerHalfCycleSec: pacer.data }] };
      }),
    );
  });

  routes.post("/group-sessions/:id/markers", async (c) =>
    c.json(await changeGroup(c.get("uid"), c.req.param("id"), ["live"], (g) => ({ markers: [...g.markers, elapsedSec(g)] }))),
  );

  // Each athlete's app saves its own session when the session ends; that, and
  // the results and group average it fills in, come with the realtime card.
  routes.post("/group-sessions/:id/end", async (c) =>
    c.json(await changeGroup(c.get("uid"), c.req.param("id"), ["live"], () => ({ status: "ended", endedAt: new Date() }))),
  );

  routes.post("/group-sessions/:id/cancel", async (c) => {
    await changeGroup(c.get("uid"), c.req.param("id"), ["lobby"], () => ({ status: "cancelled", endedAt: new Date() }));
    return c.json({ ok: true });
  });

  // The host's live view, from the state alone: nobody has joined over a realtime channel yet.
  routes.get("/group-sessions/:id/live", async (c) => {
    const group = await findGroup(c.req.param("id"));
    if (!group) fail("not-found");
    if (!canRunGroup(c.get("uid"), group.hostId)) fail("permission-denied");
    const now: Presence = group.status === "ended" || group.status === "cancelled" ? "left" : "invited";
    return c.json({ status: group.status, presence: Object.fromEntries(group.athleteIds.map((a) => [a, now])) });
  });
}

/** Seconds since the session started, capped at its planned length, to a tenth (as the local adapter). */
function elapsedSec(g: GroupSession): number {
  const since = g.startedAt ? (Date.now() - Date.parse(g.startedAt)) / 1000 : 0;
  return Math.round(Math.min(g.durationSec, Math.max(0, since)) * 10) / 10;
}

function toGroup(row: GroupRow, people: (typeof groupParticipants.$inferSelect)[]): GroupSession {
  return {
    id: row.id,
    hostId: row.hostId,
    hostName: row.hostName,
    title: row.title,
    athleteIds: people.map((p) => p.athleteId),
    pacerHalfCycleSec: row.pacerHalfCycleSec,
    durationSec: row.durationSec,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    pacerChanges: row.pacerChanges,
    markers: row.markers,
    results: Object.fromEntries(people.flatMap((p) => (p.sessionId ? [[p.athleteId, p.sessionId]] : []))),
    groupAverage: row.groupAverage ?? null,
  };
}
