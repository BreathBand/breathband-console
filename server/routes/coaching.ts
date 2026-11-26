// Coach links and what hangs off them: list both sides, read one, change its
// scope, revoke it; invites (athlete → coach, hashed codes that expire and
// redeem once); a coach's seen marks, private notes and targets.
// Assignments, comments and kudos are in coaching-feedback.ts.

import { createHash } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AthleteTargets, CoachLink, Invite, ShareScope, UserProfile } from "@/lib/domain/types";
import { canCoach, canManageSharing, canReadAthlete, canReadLink, canRedeemInvite, canUseCoachData, isSelf } from "../authz";
import { breathSessions, coachLinks, coachNotes, invites, seenSessions } from "../db/schema";
import { SHARE_SCOPES } from "../db/schema/people";
import { fail, jsonObject, linkScope, type DataApp, type DataDeps } from "./data";
import { loadProfile } from "./profile";

/** As the local adapter: an invite lasts 7 days, a private note keeps 5000 characters. */
const INVITE_TTL_MS = 7 * 86_400_000;
const MAX_NOTE = 5000;

const scopeSchema = z.enum(SHARE_SCOPES);

/** The local adapter's limits (src/lib/backend/local/index.ts setTargets). */
const targetsSchema = z
  .object({ score: z.number(), rateLow: z.number(), rateHigh: z.number(), sessionsPerWeek: z.number() })
  .refine(
    ({ score, rateLow, rateHigh, sessionsPerWeek }) =>
      score >= 1 && score <= 10 && rateLow >= 4 && rateHigh <= 40 && rateLow < rateHigh && Number.isInteger(sessionsPerWeek) && sessionsPerWeek >= 1 && sessionsPerWeek <= 21,
  );

type LinkRow = typeof coachLinks.$inferSelect;

export function coachingRoutes(routes: DataApp, { db }: DataDeps) {
  const findLink = async (coachId: string, athleteId: string) =>
    (await db.select().from(coachLinks).where(and(eq(coachLinks.coachId, coachId), eq(coachLinks.athleteId, athleteId))))[0];

  /** The people on the other side of `uid`'s links, oldest link first; birth year and consents left out. */
  const linkedProfiles = async (side: "coach" | "athlete", uid: string) => {
    const [mine, theirs] = side === "coach" ? [coachLinks.coachId, coachLinks.athleteId] : [coachLinks.athleteId, coachLinks.coachId];
    const rows = await db.select({ other: theirs }).from(coachLinks).where(eq(mine, uid)).orderBy(asc(coachLinks.createdAt), asc(sql`rowid`));
    const profiles = await Promise.all(rows.map((r) => loadProfile(db, r.other, false)));
    return profiles.filter((p): p is UserProfile => p !== null);
  };

  routes.get("/coaches/:coachId/athletes", async (c) => {
    const coachId = c.req.param("coachId");
    if (!isSelf(c.get("uid"), coachId)) fail("permission-denied");
    return c.json(await linkedProfiles("coach", coachId));
  });

  routes.get("/athletes/:athleteId/coaches", async (c) => {
    const athleteId = c.req.param("athleteId");
    if (!isSelf(c.get("uid"), athleteId)) fail("permission-denied");
    return c.json(await linkedProfiles("athlete", athleteId));
  });

  routes.get("/coach-links/:coachId/:athleteId", async (c) => {
    const { coachId, athleteId } = c.req.param();
    if (!canReadLink(c.get("uid"), coachId, athleteId)) fail("permission-denied");
    const link = await findLink(coachId, athleteId);
    if (!link) fail("not-found");
    return c.json(toLink(link));
  });

  routes.patch("/athletes/:athleteId/coaches/:coachId/scope", async (c) => {
    const { athleteId, coachId } = c.req.param();
    if (!canManageSharing(c.get("uid"), athleteId)) fail("permission-denied");
    const scope = scopeSchema.safeParse((await jsonObject(c.req.raw)).scope);
    if (!scope.success) fail("invalid-input", "scope: scores or curves");
    const updated = await db
      .update(coachLinks)
      .set({ scope: scope.data })
      .where(and(eq(coachLinks.coachId, coachId), eq(coachLinks.athleteId, athleteId)))
      .returning({ scope: coachLinks.scope });
    if (updated.length === 0) fail("not-found");
    return c.json({ ok: true });
  });

  // Revoking deletes the link: from then on the coach reads nothing (authz: link null).
  routes.delete("/athletes/:athleteId/coaches/:coachId", async (c) => {
    const { athleteId, coachId } = c.req.param();
    if (!canManageSharing(c.get("uid"), athleteId)) fail("permission-denied");
    await db.delete(coachLinks).where(and(eq(coachLinks.coachId, coachId), eq(coachLinks.athleteId, athleteId)));
    return c.json({ ok: true });
  });

  routes.post("/athletes/:athleteId/invites", async (c) => {
    const athleteId = c.req.param("athleteId");
    if (!canManageSharing(c.get("uid"), athleteId)) fail("permission-denied");
    const given = (await jsonObject(c.req.raw)).scope;
    const scope = scopeSchema.safeParse(given ?? "curves");
    if (!scope.success) fail("invalid-input", "scope: scores or curves");
    const code = inviteCode();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    // Only the hash is stored: the code itself is shown to the athlete once, here.
    await db.insert(invites).values({ codeHash: hashCode(code), athleteId, scope: scope.data, expiresAt });
    const invite: Invite = { code, athleteId, scope: scope.data, expiresAt: expiresAt.toISOString() };
    return c.json(invite);
  });

  routes.post("/coaches/:coachId/invites/redeem", async (c) => {
    const coachId = c.req.param("coachId");
    if (!isSelf(c.get("uid"), coachId)) fail("permission-denied");
    const { code } = await jsonObject(c.req.raw);
    if (typeof code !== "string") fail("invalid-input", "code: text");
    const codeHash = hashCode(code.trim().toUpperCase());
    const [invite] = await db.select().from(invites).where(eq(invites.codeHash, codeHash));
    if (!invite || invite.status !== "pending" || invite.expiresAt.getTime() < Date.now() || !canRedeemInvite(c.get("uid"), coachId, invite.athleteId)) {
      fail("invite-invalid");
    }
    // Claimed atomically, so a code redeems once even when two requests race.
    const claimed = await db
      .update(invites)
      .set({ status: "redeemed" })
      .where(and(eq(invites.codeHash, codeHash), eq(invites.status, "pending")))
      .returning({ athleteId: invites.athleteId });
    if (claimed.length === 0) fail("invite-invalid");
    // An existing link keeps its scope and targets, as on the local adapter.
    await db.insert(coachLinks).values({ coachId, athleteId: invite.athleteId, scope: invite.scope }).onConflictDoNothing();
    return c.json(toLink((await findLink(coachId, invite.athleteId))!));
  });

  routes.get("/coaches/:coachId/seen", async (c) => {
    const coachId = c.req.param("coachId");
    if (!canUseCoachData(c.get("uid"), coachId)) fail("permission-denied");
    const rows = await db
      .select({ athleteId: seenSessions.athleteId, sessionId: seenSessions.sessionId })
      .from(seenSessions)
      .where(eq(seenSessions.coachId, coachId))
      .orderBy(asc(seenSessions.createdAt), asc(sql`rowid`));
    return c.json(rows.map((r) => `${r.athleteId}/${r.sessionId}`));
  });

  routes.put("/coaches/:coachId/seen/:athleteId/:sessionId", async (c) => {
    const { coachId, athleteId, sessionId } = c.req.param();
    const viewer = c.get("uid");
    if (!canUseCoachData(viewer, coachId)) fail("permission-denied");
    // A mark is about a session the coach can read, and it has to exist (the table's foreign key).
    if (!canReadAthlete(viewer, athleteId, await linkScope(db, viewer, athleteId))) fail("permission-denied");
    const [session] = await db
      .select({ id: breathSessions.id })
      .from(breathSessions)
      .where(and(eq(breathSessions.athleteId, athleteId), eq(breathSessions.id, sessionId)));
    if (!session) fail("not-found");
    await db.insert(seenSessions).values({ coachId, athleteId, sessionId }).onConflictDoNothing();
    return c.json({ ok: true });
  });

  routes.get("/coaches/:coachId/athletes/:athleteId/note", async (c) => {
    const { coachId, athleteId } = c.req.param();
    if (!canUseCoachData(c.get("uid"), coachId)) fail("permission-denied");
    const [note] = await db
      .select({ text: coachNotes.text })
      .from(coachNotes)
      .where(and(eq(coachNotes.coachId, coachId), eq(coachNotes.athleteId, athleteId)));
    return c.json({ text: note?.text ?? "" });
  });

  routes.put("/coaches/:coachId/athletes/:athleteId/note", async (c) => {
    const { coachId, athleteId } = c.req.param();
    const viewer = c.get("uid");
    if (!canUseCoachData(viewer, coachId)) fail("permission-denied");
    if (!canCoach(viewer, coachId, await linkScope(db, coachId, athleteId))) fail("permission-denied");
    const { text } = await jsonObject(c.req.raw);
    if (typeof text !== "string") fail("invalid-input", "text: text");
    const value = text.slice(0, MAX_NOTE);
    await db
      .insert(coachNotes)
      .values({ coachId, athleteId, text: value })
      .onConflictDoUpdate({ target: [coachNotes.coachId, coachNotes.athleteId], set: { text: value, updatedAt: new Date() } });
    return c.json({ ok: true });
  });

  routes.put("/coaches/:coachId/athletes/:athleteId/targets", async (c) => {
    const { coachId, athleteId } = c.req.param();
    const viewer = c.get("uid");
    if (!canUseCoachData(viewer, coachId)) fail("permission-denied");
    // Checked before the link, in the local adapter's order.
    const parsed = targetsSchema.safeParse(await jsonObject(c.req.raw));
    if (!parsed.success) fail("invalid-input", "targets: score 1–10, rateLow ≥ 4 < rateHigh ≤ 40, sessionsPerWeek 1–21");
    if (!canCoach(viewer, coachId, await linkScope(db, coachId, athleteId))) fail("permission-denied");
    const { score, rateLow, rateHigh, sessionsPerWeek } = parsed.data;
    const targets: AthleteTargets = { score, rateLow, rateHigh, sessionsPerWeek };
    await db.update(coachLinks).set({ targets }).where(and(eq(coachLinks.coachId, coachId), eq(coachLinks.athleteId, athleteId)));
    return c.json({ ok: true });
  });
}

function toLink(row: LinkRow): CoachLink {
  return {
    coachId: row.coachId,
    athleteId: row.athleteId,
    scope: row.scope as ShareScope,
    createdAt: row.createdAt.toISOString(),
    targets: row.targets ?? null,
  };
}

/** The stored form of an invite code: SHA-256 of the normalised code, hex. */
export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** 8 characters, no look-alikes (0/O, 1/I), as the local adapter. 32 divides 256, so no bias. */
function inviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
