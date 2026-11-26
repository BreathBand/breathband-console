// Writes the demo (rows.ts) into the database and the signals into the
// StorageService. Idempotent: every row has a fixed key and is inserted only
// when missing, so a second run adds nothing. Safe on a database with real
// people in it: it only ever inserts, and it touches no row outside the demo.
// `refresh` first removes the demo people (and, by cascade, what hangs off
// them) so the sessions are placed relative to today again.

import { hashPassword } from "better-auth/crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { StorageService } from "../../storage";
import type { Db } from "../client";
import {
  account,
  assignments,
  breathSessions,
  coachInvites,
  coachLinks,
  coachNotes,
  comments,
  consents,
  kudos,
  moodCheckins,
  profiles,
  proProfiles,
  seenSessions,
  squadMembers,
  squads,
  user,
} from "../schema";
import { DEMO_PASSWORD, DEMO_UIDS, demoRows, type DemoRows } from "./rows";

export const SEED_TABLES = [
  "user",
  "account",
  "profiles",
  "pro_profiles",
  "consents",
  "breath_sessions",
  "coach_links",
  "assignments",
  "comments",
  "kudos",
  "seen_sessions",
  "coach_notes",
  "squads",
  "squad_members",
  "coach_invites",
  "mood_checkins",
] as const;

export type SeedTable = (typeof SEED_TABLES)[number];

export interface SeedOptions {
  db: Db;
  storage: StorageService;
  /** Sessions are placed relative to this, as the local adapter does. */
  now?: Date;
  /** Remove the demo people and their data first, then seed afresh. */
  refresh?: boolean;
  /** The API's AUTH_SECRET (server/auth.ts authSecret): the coach invite's code is derived under it. */
  secret: string;
}

export interface SeedResult {
  /** New rows by table: zero everywhere when the demo is already there. */
  inserted: Record<SeedTable, number>;
  /** Signals written: one per new session, plus any seeded session whose signal was missing. */
  waveformsWritten: number;
  /** Demo emails left out because someone else already holds them. */
  skipped: string[];
  /** Demo people removed first (`refresh` only). */
  removed: number;
}

/** Rows per insert statement; keeps statements small on a remote database. */
const CHUNK = 25;

export async function seedDemo({ db, storage, now = new Date(), refresh = false, secret }: SeedOptions): Promise<SeedResult> {
  const removed = refresh ? await removeDemo(db, storage) : 0;
  const rows = demoRows(now, secret);
  const inserted = Object.fromEntries(SEED_TABLES.map((t) => [t, 0])) as Record<SeedTable, number>;
  const add = async <T>(table: SeedTable, list: T[], run: (chunk: T[]) => Promise<unknown[]>) => {
    for (let i = 0; i < list.length; i += CHUNK) inserted[table] += (await run(list.slice(i, i + CHUNK))).length;
  };

  // People: each one is either already there under its demo uid, added now, or skipped
  // because the email belongs to another account (never touched).
  const present = new Set<string>();
  const skipped: string[] = [];
  for (const person of rows.people) {
    const uid = person.user.id!;
    const [mine] = await db.select({ id: user.id }).from(user).where(eq(user.id, uid));
    if (!mine) {
      const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.email, person.user.email));
      if (taken) {
        skipped.push(person.user.email);
        continue;
      }
      await add("user", [person.user], (v) => db.insert(user).values(v).onConflictDoNothing().returning({ id: user.id }));
    }
    present.add(uid);

    // A password Better Auth's own sign-in accepts (its default hasher), on a "credential" account.
    const [credential] = await db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, uid), eq(account.providerId, "credential")));
    if (!credential) {
      const row = { id: `${uid}-credential`, accountId: uid, providerId: "credential", userId: uid, password: await hashPassword(DEMO_PASSWORD) };
      await add("account", [row], (v) => db.insert(account).values(v).onConflictDoNothing().returning({ id: account.id }));
    }
    await add("profiles", [person.profileRow], (v) => db.insert(profiles).values(v).onConflictDoNothing().returning({ id: profiles.userId }));
  }

  const has = (...uids: (string | null | undefined)[]) => uids.every((uid) => !uid || present.has(uid));

  // What professional onboarding and sign-up record: the pro profile, the consent records.
  await add("pro_profiles", rows.proProfiles.filter((p) => has(p.userId)), (v) =>
    db.insert(proProfiles).values(v).onConflictDoNothing().returning({ id: proProfiles.userId }),
  );
  await add("consents", rows.consents.filter((c) => has(c.userId)), (v) =>
    db.insert(consents).values(v).onConflictDoNothing().returning({ id: consents.id }),
  );

  // Sessions: the signal first, then the row (as the API saves one).
  const sessions = rows.sessions.filter((s) => has(s.row.athleteId));
  const ids = sessions.map((s) => s.row.id);
  const existing = new Set<string>();
  for (let i = 0; i < ids.length; i += CHUNK * 4) {
    const found = await db.select({ id: breathSessions.id }).from(breathSessions).where(inArray(breathSessions.id, ids.slice(i, i + CHUNK * 4)));
    for (const { id } of found) existing.add(id);
  }
  let waveformsWritten = 0;
  for (const s of sessions) {
    if (existing.has(s.row.id) && (await storage.getJson(s.row.waveformPath)) !== null) continue;
    await storage.putJson(s.row.waveformPath, s.waveform());
    waveformsWritten++;
  }
  const fresh = sessions.filter((s) => !existing.has(s.row.id)).map((s) => s.row);
  await add("breath_sessions", fresh, (v) => db.insert(breathSessions).values(v).onConflictDoNothing().returning({ id: breathSessions.id }));

  // The coaching layer and mood check-ins, where everyone they name is present.
  await add("coach_links", rows.coachLinks.filter((l) => has(l.coachId, l.athleteId)), (v) =>
    db.insert(coachLinks).values(v).onConflictDoNothing().returning({ id: coachLinks.coachId }),
  );
  await add("assignments", rows.assignments.filter((a) => has(a.coachId, a.athleteId)), (v) =>
    db.insert(assignments).values(v).onConflictDoNothing().returning({ id: assignments.id }),
  );
  await add("comments", rows.comments.filter((c) => has(c.athleteId, c.authorId)), (v) =>
    db.insert(comments).values(v).onConflictDoNothing().returning({ id: comments.id }),
  );
  await add("kudos", rows.kudos.filter((k) => has(k.athleteId, k.authorId)), (v) =>
    db.insert(kudos).values(v).onConflictDoNothing().returning({ id: kudos.id }),
  );
  await add("seen_sessions", rows.seenSessions.filter((s) => has(s.coachId, s.athleteId)), (v) =>
    db.insert(seenSessions).values(v).onConflictDoNothing().returning({ id: seenSessions.sessionId }),
  );
  await add("coach_notes", rows.coachNotes.filter((n) => has(n.coachId, n.athleteId)), (v) =>
    db.insert(coachNotes).values(v).onConflictDoNothing().returning({ id: coachNotes.coachId }),
  );
  await add("squads", rows.squads.filter((q) => has(q.coachId)), (v) =>
    db.insert(squads).values(v).onConflictDoNothing().returning({ id: squads.id }),
  );
  const members = rows.squadMembers.filter((m) => has(m.coachId, m.athleteId)).map(({ squadId, athleteId }) => ({ squadId, athleteId }));
  await add("squad_members", members, (v) =>
    db.insert(squadMembers).values(v).onConflictDoNothing().returning({ id: squadMembers.squadId }),
  );
  // A coach invite's key (its code's hash) depends on when it was made, which moves with `now`:
  // the demo's is there already when its coach has one for the same person and contact.
  const invites: DemoRows["coachInvites"] = [];
  for (const invite of rows.coachInvites.filter((i) => has(i.coachId, i.athleteId))) {
    const [held] = await db
      .select({ id: coachInvites.codeHash })
      .from(coachInvites)
      .where(and(eq(coachInvites.coachId, invite.coachId), eq(coachInvites.athleteName, invite.athleteName), eq(coachInvites.contact, invite.contact)));
    if (!held) invites.push(invite);
  }
  await add("coach_invites", invites, (v) =>
    db.insert(coachInvites).values(v).onConflictDoNothing().returning({ id: coachInvites.codeHash }),
  );
  await add("mood_checkins", rows.moodCheckins.filter((m) => has(m.userId)), (v) =>
    db.insert(moodCheckins).values(v).onConflictDoNothing().returning({ id: moodCheckins.id }),
  );

  return { inserted, waveformsWritten, skipped, removed };
}

/**
 * Removes the demo people by their demo uids: their signals, then their user
 * rows (foreign keys cascade to everything that names them). Nobody else's rows
 * are deleted, except what a real person attached to a demo person (a link, a comment).
 */
async function removeDemo(db: Db, storage: StorageService): Promise<number> {
  const uids = [...DEMO_UIDS];
  const signals = await db.select({ path: breathSessions.waveformPath }).from(breathSessions).where(inArray(breathSessions.athleteId, uids));
  for (const { path } of signals) await storage.delete(path);
  const gone = await db.delete(user).where(inArray(user.id, uids)).returning({ id: user.id });
  return gone.length;
}
