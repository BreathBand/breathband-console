// A coach asking an athlete to share (CoachInvite, the reverse of an athlete's
// invite): the coach sends a link, the athlete opens it, sees who is asking,
// and accepts with the scope they choose (making the coach link) or declines.
//
// Only a hash of each code is stored, like the athlete's invites. Unlike those,
// the coach lists their invites with the code (to copy the link again or
// revoke it), so the code is derived, not random: an HMAC of the coach and the
// moment of creation under AUTH_SECRET. The database alone gives no code away.

import { createHmac } from "node:crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { CoachInvite, CoachLink, ShareScope } from "@/lib/domain/types";
import { canAnswerCoachInvite, canInviteAthlete, canUseCoachData } from "../authz";
import { coachInvites, coachLinks } from "../db/schema";
import { SHARE_SCOPES } from "../db/schema/people";
import { codeFrom, hashCode, normaliseCode, withFreshCode } from "./codes";
import { fail, jsonObject, type DataApp, type DataDeps } from "./data";
import { loadProfile } from "./profile";

/** As the local adapter: a coach's invite lasts 14 days; the name keeps 80 characters, the contact 120. */
const TTL_MS = 14 * 86_400_000;
const MAX_NAME = 80;
const MAX_CONTACT = 120;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{7,}$/;

const newInviteSchema = z.object({ athleteName: z.string(), contact: z.string() });

const answerSchema = z.discriminatedUnion("accept", [
  z.object({ accept: z.literal(true), scope: z.enum(SHARE_SCOPES) }),
  z.object({ accept: z.literal(false) }),
]);

type InviteRow = typeof coachInvites.$inferSelect;

export function coachInviteRoutes(routes: DataApp, { db, auth }: DataDeps) {
  /** The code for the coach's invite created at `createdAt`. Rotating AUTH_SECRET changes it: older links stop working. */
  const codeOf = (coachId: string, createdAt: Date) =>
    codeFrom(createHmac("sha256", auth.options.secret).update(`coach-invite\0${coachId}\0${createdAt.getTime()}`).digest());

  routes.post("/coaches/:coachId/coach-invites", async (c) => {
    const coachId = c.req.param("coachId");
    const viewer = c.get("uid");
    const coach = viewer === coachId ? await loadProfile(db, coachId, false) : null;
    if (!coach || !canInviteAthlete(viewer, coachId, coach.role)) fail("permission-denied");
    const parsed = newInviteSchema.safeParse(await jsonObject(c.req.raw));
    if (!parsed.success) fail("invalid-input", "athleteName and contact: text");
    const athleteName = parsed.data.athleteName.trim().slice(0, MAX_NAME);
    const contact = parsed.data.contact.trim().slice(0, MAX_CONTACT);
    if (!athleteName || !(EMAIL.test(contact) || PHONE.test(contact))) fail("invalid-input", "a name, and an email address or phone number");

    const now = Date.now();
    // Two invites from one coach in the same millisecond would share a code: the next millisecond is free.
    const row = await withFreshCode(async (attempt) => {
      const createdAt = new Date(now + attempt);
      const values = {
        codeHash: hashCode(codeOf(coachId, createdAt)),
        coachId,
        coachName: coach.displayName,
        athleteName,
        contact,
        createdAt,
        updatedAt: createdAt,
        expiresAt: new Date(createdAt.getTime() + TTL_MS),
      };
      return (await db.insert(coachInvites).values(values).returning())[0];
    });
    return c.json(toInvite(row, codeOf(coachId, row.createdAt)));
  });

  routes.get("/coaches/:coachId/coach-invites", async (c) => {
    const coachId = c.req.param("coachId");
    if (!canUseCoachData(c.get("uid"), coachId)) fail("permission-denied");
    const rows = await db
      .select()
      .from(coachInvites)
      .where(eq(coachInvites.coachId, coachId))
      .orderBy(desc(coachInvites.createdAt), desc(sql`rowid`));
    return c.json(rows.map((r) => toInvite(r, codeOf(coachId, r.createdAt))));
  });

  routes.post("/coaches/:coachId/coach-invites/:code/revoke", async (c) => {
    const { coachId, code } = c.req.param();
    if (!canUseCoachData(c.get("uid"), coachId)) fail("permission-denied");
    // Only a pending invite of this coach's; anything else is left as it is, as on the local adapter.
    await db
      .update(coachInvites)
      .set({ status: "revoked" })
      .where(and(eq(coachInvites.codeHash, hashCode(normaliseCode(code))), eq(coachInvites.coachId, coachId), eq(coachInvites.status, "pending")));
    return c.json({ ok: true });
  });

  // What the athlete sees on opening the link: anyone signed in, without the contact details.
  routes.get("/coach-invites/:code", async (c) => {
    const code = normaliseCode(c.req.param("code"));
    const [invite] = await db.select().from(coachInvites).where(eq(coachInvites.codeHash, hashCode(code)));
    if (!invite) fail("not-found");
    const { coachId, coachName, status } = invite;
    return c.json({ code, coachId, coachName, expiresAt: invite.expiresAt.toISOString(), status });
  });

  routes.post("/athletes/:athleteId/coach-invites/:code/response", async (c) => {
    const { athleteId } = c.req.param();
    const viewer = c.get("uid");
    const athlete = viewer === athleteId ? await loadProfile(db, athleteId, false) : null;
    if (!athlete || !canAnswerCoachInvite(viewer, athleteId, athlete.role)) fail("permission-denied");
    const parsed = answerSchema.safeParse(await jsonObject(c.req.raw));
    if (!parsed.success) fail("invalid-input", "accept: true with a scope (scores or curves), or accept: false");
    const answer = parsed.data;

    // Claimed atomically: answered once, and only while pending and unexpired.
    const [claimed] = await db
      .update(coachInvites)
      .set(answer.accept ? { status: "accepted", athleteId } : { status: "declined" })
      .where(
        and(
          eq(coachInvites.codeHash, hashCode(normaliseCode(c.req.param("code")))),
          eq(coachInvites.status, "pending"),
          gt(coachInvites.expiresAt, new Date()),
        ),
      )
      .returning({ coachId: coachInvites.coachId });
    if (!claimed) fail("invite-invalid");
    if (!answer.accept) return c.json(null);

    // An existing link takes the scope just chosen, as on the local adapter.
    const [link] = await db
      .insert(coachLinks)
      .values({ coachId: claimed.coachId, athleteId, scope: answer.scope })
      .onConflictDoUpdate({ target: [coachLinks.coachId, coachLinks.athleteId], set: { scope: answer.scope, updatedAt: new Date() } })
      .returning();
    const result: CoachLink = {
      coachId: link.coachId,
      athleteId: link.athleteId,
      scope: link.scope as ShareScope,
      createdAt: link.createdAt.toISOString(),
      targets: link.targets ?? null,
    };
    return c.json(result);
  });
}

function toInvite(row: InviteRow, code: string): CoachInvite {
  return {
    code,
    coachId: row.coachId,
    coachName: row.coachName,
    athleteName: row.athleteName,
    contact: row.contact,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    status: row.status,
    athleteId: row.athleteId ?? null,
  };
}
