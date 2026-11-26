// A coaching thread keeps write order even when a comment and a kudos land in the
// same millisecond. Comments and kudos live in two tables and are merged by createdAt,
// so the server must give each new one a createdAt after the athlete's newest.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { currentConsents } from "@/lib/domain/consent";
import type { SessionComment } from "@/lib/domain/types";
import { authSecret, createAuth } from "../auth";
import { createDb, type Db } from "../db/client";
import { MIGRATIONS_DIR } from "../db/env";
import { assertLocalDatabaseUrl } from "../db/guard";
import { comments, kudos } from "../db/schema";
import { createApp } from "../index";
import type { Email, Mailer } from "../mailer";
import { createFsStorage, type StorageService } from "../storage";

const APP = "http://localhost:3000";
const API = "http://localhost:8787";
const PASSWORD = "correct horse battery";

const dir = mkdtempSync(join(tmpdir(), "breathband-feedback-"));
const url = `file:${join(dir, "data.db").replaceAll("\\", "/")}`;
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
  assertLocalDatabaseUrl(url, "the coaching feedback test's database");
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
  return app.request(`${API}/api/v1${path}`, {
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

async function ok<T>(response: Response | Promise<Response>): Promise<T> {
  const settled = await response;
  expect(settled.status, await settled.clone().text()).toBe(200);
  return (await settled.json()) as T;
}

/** A confirmed, signed-in athlete: their id and session cookie. */
async function signedIn(app: App) {
  const email = `feedback${++lastEmail}-${Date.now()}@example.test`;
  const body = { name: "Ana", email, password: PASSWORD, birthYear: 1990, consents: currentConsents() };
  const created = (await (await app.request(`${API}/api/auth/sign-up/email`, post(body))).json()) as { user: { id: string } };
  const link = outbox.filter((e) => e.to === email).at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
  expect((await app.request(link!)).status).toBe(302);
  const response = await app.request(`${API}/api/auth/sign-in/email`, post({ email, password: PASSWORD }));
  const cookie = response.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
  return { uid: created.user.id, cookie };
}

function post(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP, "X-Forwarded-For": `198.51.102.${++lastIp % 250}` },
    body: JSON.stringify(body),
  };
}

const session = {
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

/** An athlete with two saved sessions. */
async function athleteWithSessions(app: App) {
  const { uid, cookie } = await signedIn(app);
  const save = () => ok<{ id: string }>(call(app, "POST", `/athletes/${uid}/sessions`, { cookie, body: { session, waveform } }));
  const [one, two] = [await save(), await save()];
  const write = (sessionId: string, kind: "comment" | "kudos", text = "") =>
    ok<SessionComment>(call(app, "POST", `/athletes/${uid}/sessions/${sessionId}/comments`, { cookie, body: { kind, text } }));
  const thread = (sessionId?: string) =>
    ok<SessionComment[]>(call(app, "GET", `/athletes/${uid}/comments${sessionId ? `?sessionId=${sessionId}` : ""}`, { cookie }));
  return { uid, one: one.id, two: two.id, write, thread };
}

/**
 * Puts a written row at the same instant the server's clock will read for the next write, or
 * later: the database clock can't be frozen, so the earlier row is moved to a minute ahead,
 * which ties or beats any "now" the next write sees.
 */
const AHEAD_MS = 60_000;

describe("a coaching thread", () => {
  it("lists a comment written in the same millisecond as the kudos before it after that kudos", async () => {
    const { one, two, write, thread } = await athleteWithSessions(build());
    const first = await write(one, "comment", "Smoother exhale.");
    const mark = await write(one, "kudos");
    const tick = Date.now() + AHEAD_MS;
    await db.update(kudos).set({ createdAt: new Date(tick) }).where(eq(kudos.id, mark.id));

    const reply = await write(one, "comment", "Thanks!");
    expect(Date.parse(reply.createdAt)).toBeGreaterThan(tick);
    expect((await thread(one)).map((c) => c.id)).toEqual([first.id, mark.id, reply.id]);

    const elsewhere = await write(two, "comment", "Tired today.");
    expect((await thread()).map((c) => c.id)).toEqual([first.id, mark.id, reply.id, elsewhere.id]);
  });

  it("lists a kudos written in the same millisecond as the comment before it after that comment", async () => {
    const { one, write, thread } = await athleteWithSessions(build());
    const said = await write(one, "comment", "Steady pacing.");
    const tick = Date.now() + AHEAD_MS;
    await db.update(comments).set({ createdAt: new Date(tick) }).where(eq(comments.id, said.id));

    const mark = await write(one, "kudos");
    expect(Date.parse(mark.createdAt)).toBeGreaterThan(tick);
    expect((await thread(one)).map((c) => c.id)).toEqual([said.id, mark.id]);
  });

  it("gives concurrent comments and kudos distinct, increasing times, in the order they list", async () => {
    const { one, two, write, thread } = await athleteWithSessions(build());
    // The athlete's own kudos and comments on two sessions, written all at once.
    const written = await Promise.all([
      write(one, "kudos"),
      write(two, "kudos"),
      ...Array.from({ length: 12 }, (_, i) => write(i % 2 ? one : two, "comment", `note ${i}`)),
    ]);
    const listed = await thread();
    expect(listed).toHaveLength(written.length);
    const times = listed.map((c) => Date.parse(c.createdAt));
    expect(new Set(times).size).toBe(times.length);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});
