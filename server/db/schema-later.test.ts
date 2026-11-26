import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_ALERTS } from "@/lib/domain/types";
import { createDb, type Db } from "./client";
import { MIGRATIONS_DIR } from "./env";
import { assertLocalDatabaseUrl } from "./guard";
import {
  accessLog,
  alertRules,
  assignments,
  breathSessions,
  coachInvites,
  coachNotes,
  comments,
  enrollments,
  groupParticipants,
  groupSessions,
  kudos,
  milestones,
  moodCheckins,
  programs,
  seenSessions,
  squadMembers,
  squads,
  user,
  verification,
  waitlist,
} from "./schema";

const dir = mkdtempSync(join(tmpdir(), "breathband-schema-later-"));
const handles: ReturnType<typeof createDb>[] = [];

function openDb(name: string): Db {
  const url = `file:${join(dir, name).replaceAll("\\", "/")}`;
  assertLocalDatabaseUrl(url, "the schema test's database");
  const handle = createDb(url);
  handles.push(handle);
  return handle.db;
}

/** A copy of the migrations folder that stops after the first `count` migrations. */
function migrationsUpTo(count: number): string {
  const folder = join(dir, `migrations-${count}`);
  mkdirSync(folder);
  cpSync(resolve(MIGRATIONS_DIR), folder, { recursive: true });
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  journal.entries = journal.entries.slice(0, count);
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

const now = new Date("2026-11-26T09:00:00.000Z");
const later = new Date("2026-12-03T09:00:00.000Z");

const sessionRow = (id: string, athleteId: string) => ({
  id,
  athleteId,
  startedAt: now,
  durationSec: 300,
  mode: "paced" as const,
  pacerHalfCycleSec: 5 as const,
  scoringVersion: "transition-v1",
  waveformPath: `waveforms/${athleteId}/${id}.json.gz`,
  appVersion: "web",
});

afterAll(() => {
  for (const handle of handles) handle.client.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // On Windows libSQL keeps the file open until the process exits; the OS temp folder gets it.
  }
});

describe("migration 0001 on a database that already has 0000", () => {
  it("adds the new tables and keeps the existing rows", async () => {
    const db = openDb("upgrade.db");
    await migrate(db, { migrationsFolder: migrationsUpTo(1) });
    await db.insert(user).values({ id: "u1", name: "Ana", email: "ana@example.test" });
    // A session written before 0001, pointing at a group session and an assignment that don't exist.
    await db.insert(breathSessions).values({ ...sessionRow("bs-old", "u1"), groupSessionId: "gone", assignmentId: "gone" });

    await migrate(db, { migrationsFolder: resolve(MIGRATIONS_DIR) });

    const [old] = await db.select().from(breathSessions);
    expect(old).toMatchObject({ id: "bs-old", groupSessionId: "gone", assignmentId: "gone", startedAt: now });
    await db.update(breathSessions).set({ note: "still editable" }).where(eq(breathSessions.id, "bs-old"));
    expect((await db.select().from(breathSessions))[0].note).toBe("still editable");
    expect(await db.select().from(waitlist)).toEqual([]);
  });
});

describe("coaching, group, site, audit and later tables", () => {
  let db: Db;

  beforeAll(async () => {
    db = openDb("fresh.db");
    await migrate(db, { migrationsFolder: resolve(MIGRATIONS_DIR) });
    await db.insert(user).values([
      { id: "u-athlete", name: "Ana", email: "ana@example.test" },
      { id: "u-coach", name: "Lena", email: "lena@example.test", role: "coach", proKind: "coach" },
      { id: "u-other", name: "Sam", email: "sam@example.test" },
    ]);
    await db.insert(breathSessions).values(sessionRow("bs1", "u-athlete"));
  });

  it("stores assignments, and a session can point at one", async () => {
    await db.insert(assignments).values({
      id: "as1",
      coachId: "u-coach",
      athleteId: "u-athlete",
      mode: "paced",
      pacerHalfCycleSec: 5,
      durationSec: 300,
      target: 4,
      dueAt: later,
    });
    await db.update(breathSessions).set({ assignmentId: "as1" }).where(eq(breathSessions.id, "bs1"));

    expect((await db.select().from(assignments))[0]).toMatchObject({ note: "", cancelled: false, dueAt: later });
    expect((await db.select().from(breathSessions))[0].assignmentId).toBe("as1");
    await expect(
      db.update(breathSessions).set({ assignmentId: "missing" }).where(eq(breathSessions.id, "bs1")),
    ).rejects.toThrow();
  });

  it("stores comments and kudos, one kudos per person per session", async () => {
    await db.insert(comments).values({
      athleteId: "u-athlete",
      sessionId: "bs1",
      authorId: "u-coach",
      authorName: "Lena",
      authorRole: "coach",
      text: "Smoother exhales",
    });
    const kudo = { athleteId: "u-athlete", sessionId: "bs1", authorId: "u-coach", authorName: "Lena", authorRole: "coach" as const };
    await db.insert(kudos).values(kudo);

    expect((await db.select().from(comments))[0]).toMatchObject({ text: "Smoother exhales", authorRole: "coach" });
    expect(await db.select().from(kudos)).toHaveLength(1);
    await expect(db.insert(kudos).values(kudo)).rejects.toThrow();
  });

  it("stores seen sessions, coach notes, squads and alert rules", async () => {
    await db.insert(seenSessions).values({ coachId: "u-coach", athleteId: "u-athlete", sessionId: "bs1" });
    await db.insert(coachNotes).values({ coachId: "u-coach", athleteId: "u-athlete", text: "Asthma; go gently" });
    await db.insert(squads).values({ id: "sq1", coachId: "u-coach", name: "Juniors" });
    await db.insert(squadMembers).values([
      { squadId: "sq1", athleteId: "u-athlete" },
      { squadId: "sq1", athleteId: "u-other" },
    ]);
    await db.insert(alertRules).values({ coachId: "u-coach", ...DEFAULT_ALERTS, missedDays: null });

    expect((await db.select().from(seenSessions))[0]).toMatchObject({ sessionId: "bs1" });
    expect((await db.select().from(coachNotes))[0].text).toBe("Asthma; go gently");
    expect(await db.select().from(squadMembers)).toHaveLength(2);
    expect((await db.select().from(alertRules))[0]).toMatchObject({ ...DEFAULT_ALERTS, missedDays: null });
  });

  it("stores a group session with its participants", async () => {
    await db.insert(groupSessions).values({
      id: "gs1",
      hostId: "u-coach",
      hostName: "Lena",
      title: "Tuesday squad",
      pacerHalfCycleSec: 5,
      durationSec: 600,
      pacerChanges: [{ atSec: 120, pacerHalfCycleSec: 2 }],
    });
    await db.insert(groupParticipants).values([
      { groupSessionId: "gs1", athleteId: "u-athlete", sessionId: "bs1" },
      { groupSessionId: "gs1", athleteId: "u-other" },
    ]);
    await db.update(breathSessions).set({ groupSessionId: "gs1" }).where(eq(breathSessions.id, "bs1"));

    expect((await db.select().from(groupSessions))[0]).toMatchObject({
      status: "lobby",
      pacerChanges: [{ atSec: 120, pacerHalfCycleSec: 2 }],
      markers: [],
      startedAt: null,
      groupAverage: null,
    });
    expect(await db.select().from(groupParticipants)).toHaveLength(2);
    expect((await db.select().from(breathSessions))[0].groupSessionId).toBe("gs1");
  });

  it("keeps the waitlist to one row per email", async () => {
    await db.insert(waitlist).values({ email: "fan@example.test", source: "hero" });

    expect((await db.select().from(waitlist))[0]).toMatchObject({ email: "fan@example.test", source: "hero" });
    await expect(db.insert(waitlist).values({ email: "fan@example.test", source: "footer" })).rejects.toThrow();
  });

  it("stores access log, mood check-ins, milestones, programs and enrollments", async () => {
    await db.insert(accessLog).values({ viewerId: "u-coach", athleteId: "u-athlete", sessionId: "bs1" });
    await db.insert(moodCheckins).values([
      { userId: "u-athlete", sessionId: "bs1", phase: "before", mood: 2 },
      { userId: "u-athlete", sessionId: "bs1", phase: "after", mood: 4 },
    ]);
    await db.insert(milestones).values({ userId: "u-athlete", kind: "first-paced", achievedAt: now });
    await db.insert(programs).values({ id: "p1", slug: "exam-week", title: "Exam Week", goal: "focus", days: 7 });
    await db.insert(enrollments).values({ userId: "u-athlete", programId: "p1", startedAt: now });

    expect((await db.select().from(accessLog))[0]).toMatchObject({ viewerId: "u-coach", sessionId: "bs1" });
    expect(await db.select().from(moodCheckins)).toHaveLength(2);
    expect((await db.select().from(milestones))[0]).toMatchObject({ kind: "first-paced", achievedAt: now });
    await expect(db.insert(milestones).values({ userId: "u-athlete", kind: "first-paced", achievedAt: later })).rejects.toThrow();
    expect((await db.select().from(programs))[0]).toMatchObject({ steps: [], goal: "focus" });
    expect((await db.select().from(enrollments))[0]).toMatchObject({ status: "active", finishedAt: null, progress: null });
  });

  it("deleting a session removes its thread but keeps the log, the check-ins and the group result row", async () => {
    await db.insert(breathSessions).values(sessionRow("bs2", "u-athlete"));
    await db.insert(comments).values({ athleteId: "u-athlete", sessionId: "bs2", authorId: "u-athlete", authorName: "Ana", authorRole: "athlete", text: "x" });
    await db.insert(accessLog).values({ viewerId: "u-coach", athleteId: "u-athlete", sessionId: "bs2" });

    await db.delete(breathSessions).where(eq(breathSessions.id, "bs2"));

    expect(await db.select().from(comments).where(eq(comments.sessionId, "bs2"))).toHaveLength(0);
    const log = await db.select().from(accessLog).where(eq(accessLog.athleteId, "u-athlete"));
    expect(log.map((row) => row.sessionId).sort()).toEqual(["bs1", null].sort());
  });

  it("deleting a group session or an assignment keeps the athlete's session", async () => {
    await db.delete(groupSessions).where(eq(groupSessions.id, "gs1"));
    await db.delete(assignments).where(eq(assignments.id, "as1"));

    expect(await db.select().from(groupParticipants)).toHaveLength(0);
    expect((await db.select().from(breathSessions))[0]).toMatchObject({ id: "bs1", groupSessionId: null, assignmentId: null });
  });

  it("deleting a user removes everything they own, on either side", async () => {
    await db.insert(groupSessions).values({ id: "gs2", hostId: "u-coach", hostName: "Lena", title: "Again", pacerHalfCycleSec: 5, durationSec: 300 });
    await db.insert(groupParticipants).values({ groupSessionId: "gs2", athleteId: "u-athlete" });
    await db.insert(assignments).values({ id: "as2", coachId: "u-coach", athleteId: "u-other", mode: "open", durationSec: 180, target: 3, dueAt: later });
    await db.insert(coachInvites).values([
      { codeHash: "ci-coach", coachId: "u-coach", coachName: "Lena", athleteName: "Sam", contact: "sam@example.test", expiresAt: later },
      {
        codeHash: "ci-athlete",
        coachId: "u-other",
        coachName: "Sam",
        athleteName: "Ana",
        contact: "ana@example.test",
        expiresAt: later,
        status: "accepted",
        athleteId: "u-athlete",
      },
    ]);
    await db.insert(verification).values({ id: "v1", identifier: "ana@example.test", value: "code", expiresAt: later });

    // The athlete goes: their own rows, and rows where they are the other side.
    await db.delete(user).where(eq(user.id, "u-athlete"));
    for (const table of [comments, kudos, seenSessions, coachNotes, accessLog, moodCheckins, milestones, enrollments]) {
      expect(await db.select().from(table)).toHaveLength(0);
    }
    expect(await db.select().from(squadMembers)).toEqual([expect.objectContaining({ athleteId: "u-other" })]);
    expect(await db.select().from(groupParticipants)).toHaveLength(0);
    expect((await db.select().from(coachInvites)).map((row) => row.codeHash)).toEqual(["ci-coach"]);
    // Verification rows are keyed by email, not by user: deleting the account leaves them to expire.
    expect(await db.select().from(verification)).toHaveLength(1);

    // The coach goes: everything they host, wrote or set.
    await db.delete(user).where(eq(user.id, "u-coach"));
    for (const table of [assignments, squads, squadMembers, alertRules, groupSessions, coachInvites]) {
      expect(await db.select().from(table)).toHaveLength(0);
    }
    expect(await db.select().from(programs)).toHaveLength(1);
    expect(await db.select().from(waitlist)).toHaveLength(1);
    const [{ violations }] = await db.all<{ violations: number }>(sql`select count(*) as violations from pragma_foreign_key_check`);
    expect(violations).toBe(0);
  });
});
