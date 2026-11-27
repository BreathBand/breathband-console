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
import { invitePractice, practiceAssignment } from "@/lib/domain/invite-context";
import type { CoachInvite, CoachLink, ShareScope, UserProfile } from "@/lib/domain/types";
import type { CoachInviteLookup, PublicCoachInvite } from "@/lib/backend/types";
import { canAnswerCoachInvite, canInviteAthlete, canUseCoachData } from "../authz";
import { assignments, coachInvites, coachLinks } from "../db/schema";
import { SHARE_SCOPES } from "../db/schema/people";
import { clientIp, createRateLimiter, rateLimit } from "../rate-limit";
import { codeFrom, hashCode, normaliseCode, withFreshCode } from "./codes";
import { fail, jsonObject, type DataApp, type DataDeps, type DataEnv } from "./data";
import { loadProfile } from "./profile";

/** As the local adapter: a coach's invite lasts 14 days; the name keeps 80 characters, the contact 120. */
const TTL_MS = 14 * 86_400_000;
const MAX_NAME = 80;
const MAX_CONTACT = 120;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{7,}$/;

/**
 * Lookups by code (T-0129). Codes are 8 characters from 32 (40 bits), so at 30
 * a minute a client would need about 70,000 years to try every code, and with
 * 10,000 pending invites about one guess in 100 million finds one. 30 at once
 * still lets a class open a teacher's QR code together from one school network.
 * The public lookup is limited per client IP, the signed-in one per person
 * (an account would otherwise be a way round the public limit). Answering an
 * invite by code tells as much (a miss is "invite-invalid"), so it shares the
 * signed-in lookup's budget (T-0133): together, 30 a minute per person.
 */
export const PUBLIC_LOOKUP_LIMIT = { limit: 30, windowMs: 60_000 } as const;
export const SIGNED_IN_LOOKUP_LIMIT = { limit: 30, windowMs: 60_000 } as const;

const newInviteSchema = z.object({ athleteName: z.string(), contact: z.string(), practice: z.string().nullish() });

/** The professional's kind, as the local adapter reads it: `proKind`, else their profile's. */
const kindOf = (p: UserProfile | null) => p?.proKind ?? p?.proProfile?.kind ?? null;

const answerSchema = z.discriminatedUnion("accept", [
  z.object({ accept: z.literal(true), scope: z.enum(SHARE_SCOPES) }),
  z.object({ accept: z.literal(false) }),
]);

type InviteRow = typeof coachInvites.$inferSelect;

/**
 * The invite page before sign-up (T-0129): anyone, signed in or not. Registered
 * before the data routes' session check, like the waitlist. Only a pending,
 * unexpired invite answers, with the minimum (name, kind, profession, scope
 * asked for, practice); every other code is the same 404, so a guess learns
 * nothing about used or cancelled codes. Every request counts against the
 * client's limit, before the lookup.
 */
export function publicCoachInviteRoutes(routes: DataApp, { db }: DataDeps) {
  const limiter = createRateLimiter(PUBLIC_LOOKUP_LIMIT);
  routes.get(
    "/coach-invites/:code/preview",
    rateLimit<DataEnv>(limiter, (c) => clientIp(c)),
    async (c) => {
      const code = normaliseCode(c.req.param("code"));
      const [invite] = await db
        .select({ coachId: coachInvites.coachId, coachName: coachInvites.coachName, practice: coachInvites.practice })
        .from(coachInvites)
        .where(and(eq(coachInvites.codeHash, hashCode(code)), eq(coachInvites.status, "pending"), gt(coachInvites.expiresAt, new Date())));
      if (!invite) fail("not-found");
      const coach = await loadProfile(db, invite.coachId, false);
      const preview: PublicCoachInvite = {
        coachName: invite.coachName,
        coachKind: kindOf(coach),
        coachProfession: coach?.proProfile?.profession ?? null,
        scopeRequested: coach?.proProfile?.scopeRequested ?? null,
        practice: invite.practice ?? null,
      };
      return c.json(preview);
    },
  );
}

export function coachInviteRoutes(routes: DataApp, { db, auth, notify }: DataDeps) {
  // One budget per person for everything that takes a code from them: the lookup and the answer (T-0133).
  const byCode = createRateLimiter(SIGNED_IN_LOOKUP_LIMIT);
  const perPerson = rateLimit<DataEnv>(byCode, (c) => c.get("uid"));

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
    // Practice set with the invite (T-0123): one of the professional's kind's session or plan templates.
    const { practice } = parsed.data;
    const template = practice == null ? null : invitePractice(kindOf(coach), practice);
    if (practice != null && !template) fail("invalid-input", "practice: one of your kind's session or plan templates");

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
        practice: template?.id ?? null,
      };
      return (await db.insert(coachInvites).values(values).returning())[0];
    });
    const code = codeOf(coachId, row.createdAt);
    await notify.coachInvite({ contact, athleteName, coachName: coach.displayName, code });
    return c.json(toInvite(row, code));
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

  // What the athlete sees on opening the link: anyone signed in, without the contact details. Who's
  // asking in their own terms and what they ask to see are read from the professional's profile now,
  // as the local adapter does (T-0123).
  // Limited per person (T-0129), so an account isn't a way round the public lookup's limit.
  routes.get("/coach-invites/:code", perPerson, async (c) => {
    const code = normaliseCode(c.req.param("code"));
    const [invite] = await db.select().from(coachInvites).where(eq(coachInvites.codeHash, hashCode(code)));
    if (!invite) fail("not-found");
    const { coachId, coachName, status } = invite;
    const coach = await loadProfile(db, coachId, false);
    const lookup: CoachInviteLookup = {
      code,
      coachId,
      coachName,
      expiresAt: invite.expiresAt.toISOString(),
      status,
      practice: invite.practice ?? null,
      coachKind: kindOf(coach),
      coachProfession: coach?.proProfile?.profession ?? null,
      scopeRequested: coach?.proProfile?.scopeRequested ?? null,
    };
    return c.json(lookup);
  });

  // Limited per person with the lookup (T-0133): each answer is a guess at a code too.
  routes.post("/athletes/:athleteId/coach-invites/:code/response", perPerson, async (c) => {
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
      .returning({ coachId: coachInvites.coachId, practice: coachInvites.practice });
    if (!claimed) fail("invite-invalid");
    if (!answer.accept) return c.json(null);

    // An existing link takes the scope just chosen, as on the local adapter.
    const [link] = await db
      .insert(coachLinks)
      .values({ coachId: claimed.coachId, athleteId, scope: answer.scope })
      .onConflictDoUpdate({ target: [coachLinks.coachId, coachLinks.athleteId], set: { scope: answer.scope, updatedAt: new Date() } })
      .returning();
    // Practice set with the invite becomes the athlete's assignment, set by the professional, due from now (T-0123).
    const template = claimed.practice ? invitePractice(kindOf(await loadProfile(db, claimed.coachId, false)), claimed.practice) : null;
    if (template) {
      const set = practiceAssignment(template, new Date());
      await db.insert(assignments).values({ ...set, dueAt: new Date(set.dueAt), coachId: claimed.coachId, athleteId, cancelled: false });
    }
    await notify.inviteAccepted(claimed.coachId, athleteId);
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
    // Only when one was set, as the local adapter stores it.
    ...(row.practice ? { practice: row.practice } : {}),
  };
}
