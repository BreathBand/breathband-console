// Test fixture for account deletion and export: one person with rows in every
// table that can hold their data, on both sides of every relation with another
// person. Used by server/jobs/deletion.test.ts and server/routes/account.test.ts.

import { getTableName, is } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Waveform } from "@/lib/domain/types";
import type { Db } from "../db/client";
import * as schema from "../db/schema";
import { waveformKey, type StorageService } from "../storage";

/** Every table in the schema, by SQL name. */
export const ALL_TABLES: Record<string, SQLiteTable> = Object.fromEntries(
  (Object.values(schema) as unknown[])
    .filter((value): value is SQLiteTable => is(value, SQLiteTable))
    .map((table) => [getTableName(table), table]),
);

export const WAVEFORM: Waveform = {
  sampleIntervalMs: 50,
  user: [0, 1, 0],
  pacer: null,
  markers: [],
  calibration: { min: 0, max: 1, a100: 0.8, midline: 0.5, peaks: [1], troughs: [0, 2] },
};

export type Seeded = {
  /** `me`'s sessions, and the session of `other` that `me` comments on, marks seen and so on. */
  mySessions: string[];
  otherSession: string;
  /** Secrets that must never leave in an export. */
  secrets: string[];
};

/**
 * Rows for `me` (with `myEmail`) in every table, half of them shared with `other`,
 * plus `other`'s private working data about `me` (notes, seen marks, a squad).
 * Both users must exist. Ids are unique per (me, other) pair.
 */
export async function seedEverything(db: Db, storage: StorageService, me: string, myEmail: string, other: string): Promise<Seeded> {
  const now = new Date();
  const later = new Date(now.getTime() + 7 * 86_400_000);
  const [s1, s2, otherSession] = [`${me}-s1`, `${me}-s2`, `${other}-s-${me}`];
  const session = (id: string, athleteId: string) => ({
    id,
    athleteId,
    startedAt: now,
    durationSec: 60,
    mode: "open" as const,
    scoringVersion: "transition-v1",
    waveformPath: waveformKey(athleteId, id),
    appVersion: "web",
  });
  for (const s of [session(s1, me), session(s2, me), session(otherSession, other)]) {
    await storage.putJson(s.waveformPath, WAVEFORM);
  }

  const program = `program-${crypto.randomUUID()}`;
  const secrets = [`token-${me}`, `hash-${me}`, `code-hash-${me}`, `coach-code-hash-${me}`, `access-${me}`, `answered-hash-${me}`];

  await db.insert(schema.programs).values({ id: program, slug: program, title: "Foundations", days: 7 });
  await db.insert(schema.profiles).values({ userId: me, displayName: "Me" }).onConflictDoNothing();
  await db.batch([
    db.insert(schema.session).values({ id: `${me}-auth-session`, token: secrets[0], userId: me, expiresAt: later }),
    db.insert(schema.account).values({ id: `${me}-account`, accountId: me, providerId: "google", userId: me, password: secrets[1], accessToken: secrets[4] }),
    db.insert(schema.verification).values([
      { id: `${me}-v1`, identifier: myEmail, value: "123456", expiresAt: later },
      { id: `${me}-v2`, identifier: `reset-password:${me}-token`, value: me, expiresAt: later },
    ]),
    db.insert(schema.proProfiles).values({ userId: me, kind: "coach", terminology: "athletes" }),
    db.insert(schema.consents).values({ id: `${me}-consent`, userId: me, kind: "terms", version: "fixture", acceptedAt: now }),
    db.insert(schema.devices).values({ id: `${me}-device`, userId: me, bleId: "BB-01" }),
    db.insert(schema.calibrations).values({ id: `${me}-cal`, userId: me, deviceId: `${me}-device`, a100: 0.8, midline: 0.5, min: 0, max: 1 }),
    db.insert(schema.breathSessions).values([session(s1, me), session(s2, me), session(otherSession, other)]),
    db.insert(schema.coachLinks).values([
      { coachId: me, athleteId: other, scope: "curves" },
      { coachId: other, athleteId: me, scope: "curves" },
    ]),
    db.insert(schema.invites).values({ codeHash: secrets[2], athleteId: me, scope: "scores", expiresAt: later }),
    db.insert(schema.coachInvites).values([
      { codeHash: secrets[3], coachId: me, coachName: "Me", athleteName: "Other", contact: "other@example.test", expiresAt: later },
      { codeHash: secrets[5], coachId: other, coachName: "Other", athleteName: "Me", contact: myEmail, expiresAt: later, athleteId: me, status: "accepted" },
    ]),
    db.insert(schema.assignments).values([
      { id: `${me}-as1`, coachId: me, athleteId: other, mode: "open", durationSec: 60, target: 7, dueAt: later },
      { id: `${me}-as2`, coachId: other, athleteId: me, mode: "open", durationSec: 60, target: 7, dueAt: later },
    ]),
    db.insert(schema.comments).values([
      { id: `${me}-c1`, athleteId: me, sessionId: s1, authorId: other, authorName: "Other", authorRole: "coach", text: "nice" },
      { id: `${me}-c2`, athleteId: other, sessionId: otherSession, authorId: me, authorName: "Me", authorRole: "coach", text: "good" },
    ]),
    db.insert(schema.kudos).values([
      { id: `${me}-k1`, athleteId: me, sessionId: s1, authorId: other, authorName: "Other", authorRole: "coach" },
      { id: `${me}-k2`, athleteId: other, sessionId: otherSession, authorId: me, authorName: "Me", authorRole: "coach" },
    ]),
    db.insert(schema.seenSessions).values([
      { coachId: me, athleteId: other, sessionId: otherSession },
      { coachId: other, athleteId: me, sessionId: s1 },
    ]),
    db.insert(schema.coachNotes).values([
      { coachId: me, athleteId: other, text: "my note about other" },
      { coachId: other, athleteId: me, text: "PRIVATE note by other" },
    ]),
    db.insert(schema.squads).values([
      { id: `${me}-squad`, coachId: me, name: "My squad" },
      { id: `${other}-squad-${me}`, coachId: other, name: "PRIVATE squad of other" },
    ]),
    db.insert(schema.squadMembers).values([
      { squadId: `${me}-squad`, athleteId: other },
      { squadId: `${other}-squad-${me}`, athleteId: me },
    ]),
    db.insert(schema.alertRules).values({ coachId: me, trendingDown: true, rateOutOfRange: false, practiceBehind: true }),
    db.insert(schema.groupSessions).values([
      { id: `${me}-g1`, hostId: me, hostName: "Me", title: "Mine", pacerHalfCycleSec: 5, durationSec: 60 },
      { id: `${other}-group-${me}`, hostId: other, hostName: "Other", title: "Theirs", pacerHalfCycleSec: 5, durationSec: 60 },
    ]),
    db.insert(schema.groupParticipants).values([
      { groupSessionId: `${me}-g1`, athleteId: other },
      { groupSessionId: `${other}-group-${me}`, athleteId: me },
    ]),
    db.insert(schema.waitlist).values({ id: `${me}-wait`, email: myEmail, source: "hero" }),
    db.insert(schema.accessLog).values([
      { id: `${me}-log1`, viewerId: other, athleteId: me, sessionId: s1 },
      { id: `${me}-log2`, viewerId: me, athleteId: other, sessionId: otherSession },
    ]),
    db.insert(schema.moodCheckins).values({ id: `${me}-mood`, userId: me, sessionId: s1, phase: "after", mood: 4 }),
    db.insert(schema.milestones).values({ id: `${me}-ms`, userId: me, kind: "first-session", achievedAt: now }),
    db.insert(schema.enrollments).values({ id: `${me}-en`, userId: me, programId: program, startedAt: now }),
  ]);
  return { mySessions: [s1, s2], otherSession, secrets };
}

/** Every row of every table, as JSON strings, by table name. */
export async function allRows(db: Db): Promise<Record<string, string[]>> {
  const rows: Record<string, string[]> = {};
  for (const [name, table] of Object.entries(ALL_TABLES)) {
    rows[name] = (await db.select().from(table)).map((row) => JSON.stringify(row));
  }
  return rows;
}
