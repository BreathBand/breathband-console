// The product's own emails (L2), beside Better Auth's confirm and reset: an
// invite, an invite accepted, practice set, a deletion asked for and done. The
// optional ones honour the person's switches (`preferences.emails`) and carry a
// one-click unsubscribe link, signed so nobody can turn off someone else's.
// Sending never fails the request that caused it: a lost email is logged.

import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { emailOn, type EmailKind } from "@/lib/domain/preferences";
import type { UserPreferences } from "@/lib/domain/types";
import type { Db } from "./db/client";
import { profiles, user } from "./db/schema";
import {
  accountDeletedEmail,
  coachInviteEmail,
  deletionRequestedEmail,
  inviteAcceptedEmail,
  practiceEmail,
  type Email,
  type Mailer,
  type Unsubscribe,
} from "./mailer";

export interface Notifier {
  /** A professional invited someone by email address (a phone number gets nothing). */
  coachInvite(invite: { contact: string; athleteName: string; coachName: string; code: string }): Promise<void>;
  inviteAccepted(coachId: string, athleteId: string): Promise<void>;
  practiceSet(coachId: string, athleteId: string, practice: { mode: "paced" | "open"; durationSec: number; target: number }): Promise<void>;
  deletionRequested(uid: string, deleteAfter: Date): Promise<void>;
  /** Sent by the deletion job just before the account goes, while the address is still known. */
  accountDeleted(to: { email: string; name: string }): Promise<void>;
}

export const silentNotifier: Notifier = {
  async coachInvite() {},
  async inviteAccepted() {},
  async practiceSet() {},
  async deletionRequested() {},
  async accountDeleted() {},
};

export type NotifierDeps = {
  db: Db;
  mailer: Mailer;
  /** The web app, for links into BreathCloud. */
  appUrl: string;
  /** The API's own origin, for the unsubscribe link (it answers there). */
  apiUrl: string;
  /** AUTH_SECRET: signs unsubscribe links. */
  secret: string;
  log?: (message: string, error?: unknown) => void;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What each switch is called in the email's footer. */
const KIND_WORDS: Record<EmailKind, string> = { practice: "practice", reminders: "reminder", digest: "weekly summary" };

export function unsubscribeSignature(secret: string, uid: string, kind: EmailKind): string {
  return createHmac("sha256", secret).update(`unsubscribe\0${uid}\0${kind}`).digest("base64url");
}

export function validUnsubscribe(secret: string, uid: string, kind: EmailKind, signature: string): boolean {
  const expected = Buffer.from(unsubscribeSignature(secret, uid, kind));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function unsubscribeLink(deps: Pick<NotifierDeps, "apiUrl" | "secret">, uid: string, kind: EmailKind): Unsubscribe {
  const query = new URLSearchParams({ u: uid, k: kind, s: unsubscribeSignature(deps.secret, uid, kind) });
  return { url: `${deps.apiUrl}/api/v1/unsubscribe?${query}`, what: KIND_WORDS[kind] };
}

export type Recipient = { email: string; name: string; preferences: UserPreferences | null };

export async function recipient(db: Db, uid: string): Promise<Recipient | null> {
  const [row] = await db
    .select({ email: user.email, name: profiles.displayName, preferences: profiles.preferences })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(eq(user.id, uid));
  return row ? { email: row.email, name: row.name ?? "there", preferences: (row.preferences as UserPreferences | null) ?? null } : null;
}

function practiceWords(p: { mode: "paced" | "open"; durationSec: number; target: number }): string {
  const minutes = Math.max(1, Math.round(p.durationSec / 60));
  return `${p.target} ${p.mode} session${p.target === 1 ? "" : "s"} of ${minutes} min`;
}

export function createNotifier(deps: NotifierDeps): Notifier {
  const { db, mailer, appUrl } = deps;
  const log = deps.log ?? ((message, error) => console.error(message, error));
  const cloud = (path = "") => `${new URL(appUrl).origin}/cloud/${path}`;

  const send = async (email: Email) => {
    try {
      await mailer.send(email);
    } catch (error) {
      log(`[notify] couldn't send "${email.subject}"`, error);
    }
  };

  return {
    async coachInvite({ contact, athleteName, coachName, code }) {
      if (!EMAIL.test(contact)) return;
      await send(coachInviteEmail(contact, athleteName, coachName, cloud(`join/?code=${encodeURIComponent(code)}`)));
    },

    async inviteAccepted(coachId, athleteId) {
      const [coach, person] = await Promise.all([recipient(db, coachId), recipient(db, athleteId)]);
      if (!coach || !person || !emailOn(coach.preferences, "practice")) return;
      await send(inviteAcceptedEmail(coach.email, coach.name, person.name, cloud(), unsubscribeLink(deps, coachId, "practice")));
    },

    async practiceSet(coachId, athleteId, practice) {
      const [coach, person] = await Promise.all([recipient(db, coachId), recipient(db, athleteId)]);
      if (!coach || !person || !emailOn(person.preferences, "practice")) return;
      await send(practiceEmail(person.email, person.name, coach.name, practiceWords(practice), cloud(), unsubscribeLink(deps, athleteId, "practice")));
    },

    async deletionRequested(uid, deleteAfter) {
      const person = await recipient(db, uid);
      if (!person) return;
      const when = `${deleteAfter.toUTCString().replace(/:\d\d GMT$/, " UTC")}`;
      await send(deletionRequestedEmail(person.email, person.name, when, cloud("login/")));
    },

    async accountDeleted(to) {
      await send(accountDeletedEmail(to.email, to.name));
    },
  };
}
