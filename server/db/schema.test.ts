import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_TARGETS, type TransitionScores } from "@/lib/domain/types";
import { createDb, type Db } from "./client";
import { MIGRATIONS_DIR } from "./env";
import { assertLocalDatabaseUrl } from "./guard";
import {
  account,
  breathSessions,
  calibrations,
  coachInvites,
  coachLinks,
  consents,
  devices,
  invites,
  profiles,
  proProfiles,
  session,
  user,
  verification,
} from "./schema";

const dir = mkdtempSync(join(tmpdir(), "breathband-schema-"));
const url = `file:${join(dir, "test.db").replaceAll("\\", "/")}`;
let handle: ReturnType<typeof createDb>;
let db: Db;

const now = new Date("2026-11-26T09:00:00.000Z");
const later = new Date("2026-12-03T09:00:00.000Z");

beforeAll(async () => {
  assertLocalDatabaseUrl(url, "the schema test's database");
  handle = createDb(url);
  db = handle.db;
  await migrate(db, { migrationsFolder: resolve(MIGRATIONS_DIR) });
  await db.insert(user).values([
    { id: "u-athlete", name: "Ana", email: "ana@example.test" },
    { id: "u-coach", name: "Lena", email: "lena@example.test", role: "coach", proKind: "clinician", birthYear: 1988 },
  ]);
});

afterAll(() => {
  handle?.client.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // On Windows libSQL keeps the file open until the process exits; the OS temp folder gets it.
  }
});

describe("core schema", () => {
  it("stores a user with the extra fields and the defaults", async () => {
    const [coach] = await db.select().from(user).where(eq(user.id, "u-coach"));
    expect(coach).toMatchObject({ role: "coach", proKind: "clinician", birthYear: 1988, emailVerified: false });
    expect(coach.createdAt).toBeInstanceOf(Date);
    expect(coach.updatedAt).toBeInstanceOf(Date);
    const [athlete] = await db.select().from(user).where(eq(user.id, "u-athlete"));
    expect(athlete).toMatchObject({ role: "athlete", proKind: null, birthYear: null });
  });

  it("stores Better Auth's session, account and verification rows", async () => {
    await db.insert(session).values({ id: "s1", token: "t1", expiresAt: later, userId: "u-athlete" });
    await db.insert(account).values({ id: "a1", accountId: "u-athlete", providerId: "credential", userId: "u-athlete", password: "hash" });
    await db.insert(verification).values({ id: "v1", identifier: "ana@example.test", value: "code", expiresAt: later });

    expect((await db.select().from(session))[0]).toMatchObject({ token: "t1", expiresAt: later });
    expect((await db.select().from(account))[0]).toMatchObject({ providerId: "credential", password: "hash" });
    expect((await db.select().from(verification))[0]).toMatchObject({ identifier: "ana@example.test" });
  });

  it("stores profiles and professional profiles with JSON columns", async () => {
    const preferences = {
      goal: "calm" as const,
      skillLevel: "beginner" as const,
      session: { mode: "open" as const, pacerHalfCycleSec: 5 as const, durationSec: 180, view: "circle" as const, sound: true },
      sessionsPerWeek: 4,
      onboardedAt: null,
      dailyMinutes: 3,
    };
    await db.insert(profiles).values({ userId: "u-athlete", displayName: "Ana", preferences, onboarding: { step: "goal" } });
    await db.insert(proProfiles).values({
      userId: "u-coach",
      kind: "clinician",
      profession: "physiotherapist",
      terminology: "clients",
      useCases: ["Recovery after injury or surgery"],
      defaultTargets: { sessionsPerWeek: 5 },
      scopeRequested: "curves",
    });

    expect((await db.select().from(profiles))[0]).toMatchObject({ displayName: "Ana", preferences, onboarding: { step: "goal" } });
    expect((await db.select().from(proProfiles))[0]).toMatchObject({
      kind: "clinician",
      sports: [],
      useCases: ["Recovery after injury or surgery"],
      defaultTargets: { sessionsPerWeek: 5 },
      defaultFlags: null,
    });
  });

  it("stores consents, devices and calibrations", async () => {
    await db.insert(consents).values({ userId: "u-athlete", kind: "terms", version: "2026-11", acceptedAt: now });
    await db.insert(devices).values({ id: "d1", userId: "u-athlete", bleId: "AA:BB", name: "Breathband", firmware: "1.2", batteryPct: 80, lastSeenAt: now });
    await db.insert(calibrations).values({ id: "c1", userId: "u-athlete", deviceId: "d1", a100: 412.5, midline: 210, min: 5, max: 417.5 });

    const [consent] = await db.select().from(consents);
    expect(consent).toMatchObject({ kind: "terms", version: "2026-11", acceptedAt: now });
    expect(consent.id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await db.select().from(devices))[0]).toMatchObject({ bleId: "AA:BB", batteryPct: 80, lastSeenAt: now });
    expect((await db.select().from(calibrations))[0]).toMatchObject({ deviceId: "d1", a100: 412.5, normalReference: null });
  });

  it("stores a breath session with its score details", async () => {
    const scores: TransitionScores = { total: 7.5, timing: { inhale: 8, exhale: 7 }, depth: { inhale: 7, exhale: 8 }, smoothness: null };
    await db.insert(breathSessions).values({
      id: "bs1",
      athleteId: "u-athlete",
      startedAt: now,
      durationSec: 300,
      mode: "paced",
      pacerHalfCycleSec: 5,
      scoringVersion: "transition-v1",
      respirationRateBpm: 6,
      total: scores.total,
      source: "web",
      skillLevel: "beginner",
      scores,
      calibrationId: "c1",
      deviceId: "d1",
      waveformPath: "waveforms/u-athlete/bs1.json.gz",
      appVersion: "web",
    });

    expect((await db.select().from(breathSessions))[0]).toMatchObject({ scores, note: "", tags: [], open: null, startedAt: now });
  });

  it("stores coach links, invites and coach invites", async () => {
    await db.insert(coachLinks).values({ coachId: "u-coach", athleteId: "u-athlete", scope: "curves", targets: DEFAULT_TARGETS });
    await db.insert(invites).values({ codeHash: "h1", athleteId: "u-athlete", scope: "scores", expiresAt: later });
    await db.insert(coachInvites).values({
      codeHash: "h2",
      coachId: "u-coach",
      coachName: "Lena",
      athleteName: "Ana",
      contact: "ana@example.test",
      expiresAt: later,
    });

    expect((await db.select().from(coachLinks))[0]).toMatchObject({ scope: "curves", targets: DEFAULT_TARGETS });
    expect((await db.select().from(invites))[0]).toMatchObject({ status: "pending", expiresAt: later });
    expect((await db.select().from(coachInvites))[0]).toMatchObject({ status: "pending", athleteId: null });
  });

  it("deletes everything a user owns when the user is deleted", async () => {
    await db.delete(user).where(eq(user.id, "u-athlete"));

    for (const table of [session, account, profiles, consents, devices, calibrations, breathSessions, coachLinks, invites]) {
      expect(await db.select().from(table)).toHaveLength(0);
    }
    expect(await db.select().from(proProfiles)).toHaveLength(1);
  });
});
