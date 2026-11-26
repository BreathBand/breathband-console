// /api/v1/account with app.request(): asking for deletion, cancelling inside
// the 24 h, what is hidden meanwhile, and "download my data".

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { currentConsents } from "@/lib/domain/consent";
import { authSecret, createAuth } from "../auth";
import { createDb, type Db } from "../db/client";
import { MIGRATIONS_DIR } from "../db/env";
import { assertLocalDatabaseUrl } from "../db/guard";
import { accountDeletions, coachLinks, user } from "../db/schema";
import { createApp } from "../index";
import { DELETION_DELAY_MS, deleteDueAccounts } from "../jobs/deletion";
import { ALL_TABLES, seedEverything, WAVEFORM } from "../jobs/fixture";
import type { Email, Mailer } from "../mailer";
import { createFsStorage, type StorageService } from "../storage";
import { EXPORT_FORMAT, NOT_EXPORTED, type AccountExport } from "./account-export";

const APP = "http://localhost:3000";
const API = "http://localhost:8787";
const PASSWORD = "correct horse battery";

const dir = mkdtempSync(join(tmpdir(), "breathband-account-"));
const url = `file:${join(dir, "account.db").replaceAll("\\", "/")}`;
let handle: ReturnType<typeof createDb>;
let db: Db;
let storage: StorageService;

const outbox: Email[] = [];
const mailer: Mailer = {
  async send(email) {
    outbox.push(email);
  },
};

beforeAll(async () => {
  assertLocalDatabaseUrl(url, "the account routes test's database");
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

const build = () =>
  createApp({
    db,
    mode: "test",
    appUrl: APP,
    auth: createAuth({ db, mode: "test", secret: authSecret("test", undefined), baseUrl: API, appUrl: APP, mailer }),
    storage,
  });
type App = ReturnType<typeof build>;

let lastIp = 0;
let lastEmail = 0;

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

async function signIn(app: App, email: string): Promise<string> {
  const response = await call(app, "POST", "/api/auth/sign-in/email", { body: { email, password: PASSWORD } });
  expect(response.status).toBe(200);
  return response.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
}

/** A confirmed, signed-in person: id, email and session cookie. */
async function signedUp(app: App, name = "Ana") {
  const email = `acct${++lastEmail}-${Date.now()}@example.test`;
  const body = { name, email, password: PASSWORD, birthYear: 1990, consents: currentConsents() };
  const created = (await (await call(app, "POST", "/api/auth/sign-up/email", { body })).json()) as { user: { id: string } };
  const link = outbox.filter((e) => e.to === email).at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
  expect((await app.request(link!)).status).toBe(302);
  return { uid: created.user.id, email, cookie: await signIn(app, email) };
}

const newSession = {
  startedAt: "2026-11-24T08:00:00.000Z",
  durationSec: 60,
  mode: "open",
  pacerHalfCycleSec: null,
  scores: null,
  scoringVersion: "transition-v1",
  respirationRateBpm: null,
  note: "",
  appVersion: "web",
};
const waveform = { sampleIntervalMs: 50, user: [0, 1, 0], pacer: null, markers: [], calibration: { min: 0, max: 1 } };

const json = async <T = Record<string, unknown>>(response: Response | Promise<Response>) => (await (await response).json()) as T;

describe("account routes", () => {
  it("answer 401 not-signed-in without a session", async () => {
    const app = build();
    for (const [method, path] of [
      ["GET", "/api/v1/account/delete"],
      ["POST", "/api/v1/account/delete"],
      ["POST", "/api/v1/account/delete/cancel"],
      ["GET", "/api/v1/account/export"],
    ]) {
      const response = await call(app, method, path, { body: method === "POST" ? {} : undefined });
      expect(response.status, path).toBe(401);
    }
  });

  it("ask for the password, and change nothing when it's wrong", async () => {
    const app = build();
    const ana = await signedUp(app);
    const missing = await call(app, "POST", "/api/v1/account/delete", { cookie: ana.cookie, body: {} });
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ error: { code: "invalid-input" } });
    const wrong = await call(app, "POST", "/api/v1/account/delete", { cookie: ana.cookie, body: { password: "not it at all" } });
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toMatchObject({ error: { code: "invalid-credentials" } });

    expect(await json(call(app, "GET", "/api/v1/account/delete", { cookie: ana.cookie }))).toEqual({ deletion: null });
    expect((await call(app, "GET", `/api/v1/users/${ana.uid}`, { cookie: ana.cookie })).status).toBe(200);
  });

  it("mark the account, sign it out everywhere and hide it at once; cancelling inside 24 h restores it", async () => {
    const app = build();
    const ana = await signedUp(app, "Ana");
    const otherBrowser = await signIn(app, ana.email);
    const cole = await signedUp(app, "Cole");
    await db.insert(coachLinks).values({ coachId: cole.uid, athleteId: ana.uid, scope: "curves" });
    const saved = await json<{ id: string }>(call(app, "POST", `/api/v1/athletes/${ana.uid}/sessions`, { cookie: ana.cookie, body: { session: newSession, waveform } }));
    const anaPaths = [`/api/v1/users/${ana.uid}`, `/api/v1/athletes/${ana.uid}/sessions`, `/api/v1/athletes/${ana.uid}/sessions/${saved.id}/waveform`];
    const colesAthletes = async () => (await json<{ uid: string }[]>(call(app, "GET", `/api/v1/coaches/${cole.uid}/athletes`, { cookie: cole.cookie }))).map((p) => p.uid);

    for (const path of anaPaths) expect((await call(app, "GET", path, { cookie: cole.cookie })).status, path).toBe(200);
    expect(await colesAthletes()).toEqual([ana.uid]);

    const asked = Date.now();
    const response = await call(app, "POST", "/api/v1/account/delete", { cookie: ana.cookie, body: { password: PASSWORD } });
    expect(response.status).toBe(200);
    const { deletion } = await json<{ deletion: { requestedAt: string; deleteAfter: string } }>(response);
    expect(Date.parse(deletion.requestedAt)).toBeGreaterThanOrEqual(asked - 1000);
    expect(Date.parse(deletion.deleteAfter) - Date.parse(deletion.requestedAt)).toBe(DELETION_DELAY_MS);
    // This browser's session cookie is cleared, and every session is over.
    expect(response.headers.getSetCookie().some((line) => /session_token=;/.test(line) && /Max-Age=0/i.test(line))).toBe(true);
    for (const cookie of [ana.cookie, otherBrowser]) {
      expect((await call(app, "GET", `/api/v1/users/${ana.uid}`, { cookie })).status).toBe(401);
    }

    // Signed in again, Ana can only see the deletion, cancel it or download her data.
    const back = await signIn(app, ana.email);
    for (const path of anaPaths) {
      const refused = await call(app, "GET", path, { cookie: back });
      expect(refused.status, path).toBe(403);
      expect(await refused.json()).toMatchObject({ error: { code: "permission-denied" } });
    }
    expect(await json(call(app, "GET", "/api/v1/account/delete", { cookie: back }))).toEqual({ deletion });
    expect((await call(app, "GET", "/api/v1/account/export", { cookie: back })).status).toBe(200);
    // Asking again keeps the first request's time.
    const again = await json(call(app, "POST", "/api/v1/account/delete", { cookie: back, body: { password: PASSWORD } }));
    expect(again).toEqual({ deletion });

    // To Cole, Ana is gone: no profile, sessions or signal, off the athlete list, no coaching.
    const back2 = await signIn(app, ana.email);
    for (const path of anaPaths) expect((await call(app, "GET", path, { cookie: cole.cookie })).status, path).toBe(404);
    expect(await colesAthletes()).toEqual([]);
    const seen = await call(app, "PUT", `/api/v1/coaches/${cole.uid}/seen/${ana.uid}/${saved.id}`, { cookie: cole.cookie });
    expect(seen.status).toBe(404);

    const cancelled = await call(app, "POST", "/api/v1/account/delete/cancel", { cookie: back2 });
    expect(cancelled.status).toBe(200);
    expect(await cancelled.json()).toEqual({ deletion: null });
    expect((await call(app, "GET", `/api/v1/users/${ana.uid}`, { cookie: back2 })).status).toBe(200);
    for (const path of anaPaths) expect((await call(app, "GET", path, { cookie: cole.cookie })).status, path).toBe(200);
    expect(await colesAthletes()).toEqual([ana.uid]);
    expect((await deleteDueAccounts({ db, storage }, new Date(Date.now() + 2 * DELETION_DELAY_MS))).deleted).not.toContain(ana.uid);

    // Nothing to cancel any more.
    const nothing = await call(app, "POST", "/api/v1/account/delete/cancel", { cookie: back2 });
    expect(nothing.status).toBe(404);
  });

  it("refuse to cancel once the 24 h are up; the job then deletes the account", async () => {
    const app = build();
    const ben = await signedUp(app, "Ben");
    expect((await call(app, "POST", "/api/v1/account/delete", { cookie: ben.cookie, body: { password: PASSWORD } })).status).toBe(200);
    await db
      .update(accountDeletions)
      .set({ requestedAt: new Date(Date.now() - DELETION_DELAY_MS - 1000) })
      .where(eq(accountDeletions.userId, ben.uid));

    const back = await signIn(app, ben.email);
    const late = await call(app, "POST", "/api/v1/account/delete/cancel", { cookie: back });
    expect(late.status).toBe(403);
    expect(await late.json()).toMatchObject({ error: { code: "permission-denied" } });

    expect((await deleteDueAccounts({ db, storage })).deleted).toContain(ben.uid);
    expect(await db.select().from(user).where(eq(user.id, ben.uid))).toEqual([]);
    expect((await call(app, "GET", "/api/v1/account/delete", { cookie: back })).status).toBe(401);
    const signIn2 = await call(app, "POST", "/api/auth/sign-in/email", { body: { email: ben.email, password: PASSWORD } });
    expect(signIn2.status).toBe(401);
  });

  it("refuse a cancel once the job has claimed the request, even from a clock behind the job's", async () => {
    const app = build();
    const ivy = await signedUp(app, "Ivy");
    const saved = await json<{ waveformPath: string }>(call(app, "POST", `/api/v1/athletes/${ivy.uid}/sessions`, { cookie: ivy.cookie, body: { session: newSession, waveform } }));
    expect((await call(app, "POST", "/api/v1/account/delete", { cookie: ivy.cookie, body: { password: PASSWORD } })).status).toBe(200);

    // A job whose clock runs a day ahead claims the request, then stalls on the blobs.
    const stalled: StorageService = { ...storage, delete: () => Promise.reject(new Error("bucket down")) };
    const run = await deleteDueAccounts({ db, storage: stalled }, new Date(Date.now() + DELETION_DELAY_MS + 1000));
    expect(run.failed.map((f) => f.userId)).toEqual([ivy.uid]);

    // By this clock Ivy is inside her 24 h, but the claimed request can't be cancelled.
    const back = await signIn(app, ivy.email);
    const cancel = await call(app, "POST", "/api/v1/account/delete/cancel", { cookie: back });
    expect(cancel.status).toBe(403);
    expect(await cancel.json()).toMatchObject({ error: { code: "permission-denied" } });

    // The next run finishes it.
    expect((await deleteDueAccounts({ db, storage })).deleted).toContain(ivy.uid);
    expect(await db.select().from(user).where(eq(user.id, ivy.uid))).toEqual([]);
    expect(await storage.getJson(saved.waveformPath)).toBeNull();
  });

  it("export every table's rows for the person, with their waveforms, and no one else's private data", async () => {
    const app = build();
    const ana = await signedUp(app, "Ana");
    const cole = await signedUp(app, "Cole");
    const seeded = await seedEverything(db, storage, ana.uid, ana.email, cole.uid);
    // Exporting still works while a deletion waits.
    expect((await call(app, "POST", "/api/v1/account/delete", { cookie: ana.cookie, body: { password: PASSWORD } })).status).toBe(200);
    const cookie = await signIn(app, ana.email);

    const response = await call(app, "GET", "/api/v1/account/export", { cookie });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="breathband-data-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const text = await response.text();
    const data = JSON.parse(text) as AccountExport;
    expect(data).toMatchObject({ format: EXPORT_FORMAT, userId: ana.uid });

    // Every table in the schema is either exported or named, with a reason, as left out.
    const exported = Object.keys(data.tables);
    expect([...exported, ...Object.keys(NOT_EXPORTED)].sort()).toEqual(Object.keys(ALL_TABLES).sort());
    expect(exported.filter((name) => name in NOT_EXPORTED)).toEqual([]);
    for (const [name, rows] of Object.entries(data.tables)) {
      expect(rows.length, `${name} has Ana's rows`).toBeGreaterThan(0);
      for (const row of rows) expect(JSON.stringify(row), `${name} row is Ana's`).toMatch(new RegExp(`${ana.uid}|${ana.email}`));
    }
    // Both sides of what Ana shares, and her own working data as a coach.
    expect(data.tables.coach_links).toHaveLength(2);
    expect(data.tables.comments).toHaveLength(2);
    expect(data.tables.coach_notes).toEqual([expect.objectContaining({ coachId: ana.uid, text: "my note about other" })]);
    expect(data.tables.squads.map((s) => s.coachId)).toEqual([ana.uid]);
    expect(data.tables.seen_sessions.map((s) => s.coachId)).toEqual([ana.uid]);
    expect(data.tables.group_sessions).toHaveLength(2);
    expect(data.tables.group_participants).toHaveLength(2);
    expect(data.tables.account_deletions).toEqual([expect.objectContaining({ userId: ana.uid })]);

    // Cole's private notes, seen marks and squads about Ana are his, not hers.
    expect(text).not.toContain("PRIVATE");
    // No secrets, and not the method.
    for (const secret of seeded.secrets) expect(text).not.toContain(secret);
    for (const row of data.tables.account) expect(Object.keys(row)).not.toEqual(expect.arrayContaining(["password"]));
    for (const row of data.tables.session) expect(row).not.toHaveProperty("token");
    for (const row of data.tables.calibrations) expect(row).not.toHaveProperty("a100");
    expect(data.tables.calibrations[0]).not.toHaveProperty("midline");

    // Her sessions and their signals; not Cole's, though she coaches him.
    expect(data.tables.breath_sessions.map((s) => s.id).sort()).toEqual([...seeded.mySessions].sort());
    expect(Object.keys(data.waveforms).sort()).toEqual([...seeded.mySessions].sort());
    expect(data.waveforms[seeded.mySessions[0]]).toEqual({ ...WAVEFORM, calibration: { min: 0, max: 1 } });
  });

  it("export only the signed-in person's data, even for a coach with a curves link", async () => {
    const app = build();
    const ana = await signedUp(app, "Ana");
    const cole = await signedUp(app, "Cole");
    const seeded = await seedEverything(db, storage, ana.uid, ana.email, cole.uid);
    const data = await json<AccountExport>(call(app, "GET", "/api/v1/account/export", { cookie: cole.cookie }));
    expect(data.userId).toBe(cole.uid);
    expect(data.tables.user).toEqual([expect.objectContaining({ id: cole.uid })]);
    expect(data.tables.breath_sessions.map((s) => s.id)).toEqual([seeded.otherSession]);
    expect(Object.keys(data.waveforms)).toEqual([seeded.otherSession]);
    // His own note about Ana is his to take.
    expect(data.tables.coach_notes).toEqual([expect.objectContaining({ coachId: cole.uid, text: "PRIVATE note by other" })]);
    expect(data.tables.profiles.map((p) => p.userId)).toEqual([cole.uid]);
  });
});
