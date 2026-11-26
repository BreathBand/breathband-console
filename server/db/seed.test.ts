// The demo seed (I-12) on a temp file database: the demo people sign in with
// "breathband" through Better Auth and read their data through the API; a
// second run adds nothing; real people are never touched; db:reset refuses
// anything but a file database.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { count, eq, getTableName, is } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_ATHLETE, DEMO_COACH, DEMO_PASSWORD, generateWaveform, seedSessions } from "@/lib/backend/local/seed";
import type { CoachInvite, SessionSummary, UserProfile, Waveform } from "@/lib/domain/types";
import { authSecret, createAuth } from "../auth";
import { createApp } from "../index";
import type { Mailer } from "../mailer";
import { createFsStorage, type StorageService } from "../storage";
import { createDb, type Db } from "./client";
import { MIGRATIONS_DIR } from "./env";
import { assertLocalDatabaseUrl } from "./guard";
import * as schema from "./schema";
import { fileDatabasePath, resetFileDatabase } from "./seed/reset";
import { demoSessionId } from "./seed/rows";
import { seedDemo, SEED_TABLES } from "./seed/write";

const APP = "http://localhost:3000";
const API = "http://localhost:8787";
const NOW = new Date("2026-11-26T12:00:00.000Z");
/** The API's secret in tests; the seed derives the coach invite's code under the same one. */
const SECRET = authSecret("test", undefined);

const dir = mkdtempSync(join(tmpdir(), "breathband-seed-"));
const fileUrl = (name: string) => `file:${join(dir, name).replaceAll("\\", "/")}`;
const url = fileUrl("seed.db");
let handle: ReturnType<typeof createDb>;
let db: Db;
let storage: StorageService;

const mailer: Mailer = { async send() {} };

beforeAll(async () => {
  assertLocalDatabaseUrl(url, "the seed test's database");
  handle = createDb(url);
  db = handle.db;
  await migrate(db, { migrationsFolder: resolve(MIGRATIONS_DIR) });
  storage = createFsStorage(join(dir, "blobs"));
});

afterAll(() => {
  handle?.client.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // On Windows libSQL keeps the file open until the process exits; the OS temp folder gets it.
  }
});

/** Rows in every table of the schema, by table name. */
async function rowCounts(database: Db): Promise<Record<string, number>> {
  const tables = (Object.values(schema) as unknown[]).filter((value): value is SQLiteTable => is(value, SQLiteTable));
  const entries = await Promise.all(
    tables.map(async (table) => [getTableName(table), (await database.select({ n: count() }).from(table))[0].n] as const),
  );
  return Object.fromEntries(entries);
}

const build = () =>
  createApp({
    db,
    mode: "test",
    appUrl: APP,
    auth: createAuth({ db, mode: "test", secret: SECRET, baseUrl: API, appUrl: APP, mailer }),
    storage,
  });
type App = ReturnType<typeof build>;

let lastIp = 0;
function call(app: App, method: string, path: string, options: { body?: unknown; cookie?: string } = {}) {
  return app.request(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: APP,
      "X-Forwarded-For": `198.51.102.${++lastIp % 250}`,
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function signIn(app: App, email: string, password = DEMO_PASSWORD): Promise<string> {
  const response = await call(app, "POST", "/api/auth/sign-in/email", { body: { email, password } });
  expect(response.status, `sign in as ${email}`).toBe(200);
  return response.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
}

async function json<T>(response: Response): Promise<T> {
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()) as T;
}

describe("the demo seed", () => {
  let first: Awaited<ReturnType<typeof seedDemo>>;
  let afterFirst: Record<string, number>;

  beforeAll(async () => {
    // Someone real, already here: the seed must leave them alone.
    await db.insert(schema.user).values({ id: "real-person", name: "Real Person", email: "real@example.test", emailVerified: true });
    first = await seedDemo({ db, storage, now: NOW, secret: SECRET });
    afterFirst = await rowCounts(db);
  }, 120_000);

  it("writes the local seed's people, sessions, signals, coaching and mood check-ins", () => {
    expect(first.skipped).toEqual([]);
    expect(first.inserted.user).toBe(6);
    expect(first.inserted.account).toBe(6);
    expect(first.inserted.profiles).toBe(6);
    expect(first.inserted.breath_sessions).toBeGreaterThan(100);
    expect(first.waveformsWritten).toBe(first.inserted.breath_sessions);
    for (const table of ["coach_links", "assignments", "comments", "kudos", "seen_sessions", "coach_notes", "squads", "squad_members", "coach_invites", "mood_checkins"] as const) {
      expect(first.inserted[table], table).toBeGreaterThan(0);
    }
  });

  it("lets the demo coach sign in with the demo password and read Alex's sessions and a signal", async () => {
    const app = build();
    const cookie = await signIn(app, DEMO_COACH.email);
    const athletes = await json<UserProfile[]>(await call(app, "GET", `/api/v1/coaches/${DEMO_COACH.uid}/athletes`, { cookie }));
    expect(athletes.map((a) => a.displayName)).toContain(DEMO_ATHLETE.displayName);

    const sessions = await json<SessionSummary[]>(await call(app, "GET", `/api/v1/athletes/${DEMO_ATHLETE.uid}/sessions`, { cookie }));
    const local = seedSessions(DEMO_ATHLETE.uid, NOW);
    expect(sessions).toHaveLength(local.length);
    // Same sessions, same scores as the local adapter shows.
    const newest = local[0];
    expect(sessions[0]).toMatchObject({ id: demoSessionId(DEMO_ATHLETE.uid, newest.id), startedAt: newest.startedAt, scores: newest.scores, mode: newest.mode });

    const signal = await json<Waveform>(
      await call(app, "GET", `/api/v1/athletes/${DEMO_ATHLETE.uid}/sessions/${sessions[0].id}/waveform`, { cookie }),
    );
    // As stored: through JSON, so -0 reads back as 0.
    expect(signal).toEqual(JSON.parse(JSON.stringify(generateWaveform(newest))));
  });

  it("lets Alex sign in and read his own sessions, signal, coach and comments", async () => {
    const app = build();
    const cookie = await signIn(app, DEMO_ATHLETE.email);
    const sessions = await json<SessionSummary[]>(await call(app, "GET", `/api/v1/athletes/${DEMO_ATHLETE.uid}/sessions`, { cookie }));
    expect(sessions.length).toBeGreaterThan(20);
    const signal = await json<Waveform>(
      await call(app, "GET", `/api/v1/athletes/${DEMO_ATHLETE.uid}/sessions/${sessions[1].id}/waveform`, { cookie }),
    );
    expect(signal.user.length).toBeGreaterThan(0);
    const coaches = await json<UserProfile[]>(await call(app, "GET", `/api/v1/athletes/${DEMO_ATHLETE.uid}/coaches`, { cookie }));
    expect(coaches.map((c) => c.uid)).toEqual([DEMO_COACH.uid]);
    const thread = await json<{ kind: string }[]>(await call(app, "GET", `/api/v1/athletes/${DEMO_ATHLETE.uid}/comments`, { cookie }));
    expect(thread.map((c) => c.kind).sort()).toEqual(["comment", "comment", "kudos", "kudos"]);
  });

  it("lists the demo coach's invite with a code that works through the API", async () => {
    const app = build();
    const cookie = await signIn(app, DEMO_COACH.email);
    const invites = await json<CoachInvite[]>(await call(app, "GET", `/api/v1/coaches/${DEMO_COACH.uid}/coach-invites`, { cookie }));
    expect(invites).toHaveLength(1);
    const [invite] = invites;
    expect(invite).toMatchObject({ coachId: DEMO_COACH.uid, coachName: DEMO_COACH.displayName, athleteName: "Jordan Lee", status: "pending", athleteId: null });
    expect(invite.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(Date.parse(invite.expiresAt)).toBeGreaterThan(NOW.getTime());

    // Alex opens the link: the code finds the invite.
    const alex = await signIn(app, DEMO_ATHLETE.email);
    const opened = await json<{ coachId: string; status: string }>(await call(app, "GET", `/api/v1/coach-invites/${invite.code}`, { cookie: alex }));
    expect(opened).toMatchObject({ coachId: DEMO_COACH.uid, status: "pending" });

    // The coach can revoke it by its code (a status change; no rows added or removed).
    await json(await call(app, "POST", `/api/v1/coaches/${DEMO_COACH.uid}/coach-invites/${invite.code}/revoke`, { cookie }));
    const after = await json<CoachInvite[]>(await call(app, "GET", `/api/v1/coaches/${DEMO_COACH.uid}/coach-invites`, { cookie }));
    expect(after).toMatchObject([{ code: invite.code, status: "revoked" }]);
  });

  it("refuses the wrong password", async () => {
    const response = await call(build(), "POST", "/api/auth/sign-in/email", { body: { email: DEMO_ATHLETE.email, password: "not-the-demo-password" } });
    expect(response.status).toBe(401);
  });

  it("adds nothing when run again, even on another day", async () => {
    const before = await rowCounts(db);
    const again = await seedDemo({ db, storage, now: new Date(NOW.getTime() + 3 * 86_400_000), secret: SECRET });
    expect(SEED_TABLES.every((t) => again.inserted[t] === 0)).toBe(true);
    expect(again.waveformsWritten).toBe(0);
    expect(await rowCounts(db)).toEqual(before);
  });

  it("rewrites a seeded session's signal when it is missing", async () => {
    const path = `waveforms/${DEMO_ATHLETE.uid}/${demoSessionId(DEMO_ATHLETE.uid, "s001")}.json.gz`;
    await storage.delete(path);
    const before = await rowCounts(db);
    const again = await seedDemo({ db, storage, now: NOW, secret: SECRET });
    expect(again.waveformsWritten).toBe(1);
    expect(await storage.getJson(path)).not.toBeNull();
    expect(await rowCounts(db)).toEqual(before);
  });

  it("refreshes the demo without touching anyone else", async () => {
    const again = await seedDemo({ db, storage, now: NOW, refresh: true, secret: SECRET });
    expect(again.removed).toBe(6);
    expect(again.inserted).toEqual(first.inserted);
    // Their sign-in sessions went with them, so the counts are those of the first run.
    expect(await rowCounts(db)).toEqual(afterFirst);
    expect(await db.select().from(schema.user).where(eq(schema.user.id, "real-person"))).toHaveLength(1);
  }, 120_000);

  it("skips a demo person whose email someone else already holds, and what hangs off them", async () => {
    const other = createDb(fileUrl("taken.db"));
    try {
      await migrate(other.db, { migrationsFolder: resolve(MIGRATIONS_DIR) });
      await other.db.insert(schema.user).values({ id: "someone", name: "Someone", email: DEMO_COACH.email });
      const result = await seedDemo({ db: other.db, storage: createFsStorage(join(dir, "blobs-taken")), now: NOW, secret: SECRET });
      expect(result.skipped).toEqual([DEMO_COACH.email]);
      expect(result.inserted.user).toBe(5);
      expect(result.inserted.coach_links).toBe(0);
      const [someone] = await other.db.select().from(schema.user).where(eq(schema.user.id, "someone"));
      expect(someone).toMatchObject({ name: "Someone", email: DEMO_COACH.email });
    } finally {
      other.client.close();
    }
  }, 120_000);
});

describe("db:reset", () => {
  it("refuses anything but a file database", async () => {
    for (const remote of ["libsql://example.turso.io", "https://example.turso.io", "http://127.0.0.1:8080", ":memory:", "file::memory:"]) {
      expect(fileDatabasePath(remote), remote).toBeNull();
      await expect(resetFileDatabase(remote), remote).rejects.toThrow(/file databases only/);
    }
  });

  it("drops a file database and migrates a fresh one", async () => {
    // Not opened through libSQL here: on Windows it holds the file until the process exits.
    const resetUrl = fileUrl("reset.db");
    const path = fileDatabasePath(resetUrl)!;
    writeFileSync(path, "not a database");
    writeFileSync(`${path}-wal`, "stale log");

    await resetFileDatabase(resetUrl);
    expect(existsSync(`${path}-wal`) && readFileSync(`${path}-wal`, "utf8") === "stale log").toBe(false);

    const after = createDb(resetUrl);
    try {
      const counts = await rowCounts(after.db);
      expect(Object.keys(counts)).toContain("user");
      expect(Object.values(counts).every((n) => n === 0)).toBe(true);
    } finally {
      after.client.close();
    }
  });
});
