// T-0133: answering a professional's invite by code
// (POST /api/v1/athletes/{id}/coach-invites/{code}/response) is a guess at a
// code too: a miss says "invite-invalid", a hit declines or accepts. It is
// limited per signed-in person, sharing one budget with the signed-in lookup
// (GET /api/v1/coach-invites/{code}), so the two together stay within it.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { currentConsents } from "@/lib/domain/consent";
import { authSecret, createAuth } from "../auth";
import { createDb, type Db } from "../db/client";
import { MIGRATIONS_DIR } from "../db/env";
import { assertLocalDatabaseUrl } from "../db/guard";
import { createApp } from "../index";
import type { Email, Mailer } from "../mailer";
import { createFsStorage, type StorageService } from "../storage";
import { SIGNED_IN_LOOKUP_LIMIT } from "./coach-invites";

const APP = "http://localhost:3000";
const API = "http://localhost:8787";
const PASSWORD = "correct horse battery";
const LIMIT = SIGNED_IN_LOOKUP_LIMIT.limit;

const dir = mkdtempSync(join(tmpdir(), "breathband-invite-response-"));
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
  assertLocalDatabaseUrl(url, "the invite response limit test's database");
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
  createApp({ db, mode: "test", appUrl: APP, auth: createAuth({ db, mode: "test", secret: authSecret("test", undefined), baseUrl: API, appUrl: APP, mailer }), storage });
type App = ReturnType<typeof build>;

let lastIp = 0;
let lastEmail = 0;

function call(app: App, method: string, path: string, options: { body?: unknown; cookie?: string } = {}) {
  return app.request(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: APP,
      // Better Auth's own sign-up and sign-in limits read this header; the API's limits here key on the person.
      "X-Forwarded-For": `198.51.103.${++lastIp % 250}`,
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function signedIn(app: App, role: "athlete" | "coach", name: string) {
  const email = `response${++lastEmail}-${Date.now()}@example.test`;
  const body = { name, email, password: PASSWORD, birthYear: 1990, consents: currentConsents(), role };
  const created = (await (await call(app, "POST", "/api/auth/sign-up/email", { body })).json()) as { user: { id: string } };
  const link = outbox.filter((e) => e.to === email).at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
  expect((await app.request(link!)).status).toBe(302);
  const response = await call(app, "POST", "/api/auth/sign-in/email", { body: { email, password: PASSWORD } });
  const cookie = response.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
  return { uid: created.user.id, cookie };
}

async function coachWithInvite(app: App) {
  const lena = await signedIn(app, "coach", "Lena Vos");
  return async () => {
    const body = { athleteName: "Jordan Lee", contact: "jordan@example.com" };
    const response = await call(app, "POST", `/api/v1/coaches/${lena.uid}/coach-invites`, { cookie: lena.cookie, body });
    expect(response.status).toBe(200);
    return ((await response.json()) as { code: string }).code;
  };
}

type Person = { uid: string; cookie: string };
const guess = (i: number) => `ZZZZ${String(2222 + i).slice(-4).replace(/[01]/g, "2")}`;
const respond = (app: App, who: Person, code: string, body: unknown = { accept: false }) =>
  call(app, "POST", `/api/v1/athletes/${who.uid}/coach-invites/${encodeURIComponent(code)}/response`, { cookie: who.cookie, body });
const lookup = (app: App, who: Person, code: string) => call(app, "GET", `/api/v1/coach-invites/${encodeURIComponent(code)}`, { cookie: who.cookie });

describe("answering an invite by code", () => {
  it(`refuses the ${LIMIT + 1}th answer in a minute from one person, misses and hits alike, while another person still answers`, async () => {
    const app = build();
    const invite = await coachWithInvite(app);
    const jordan = await signedIn(app, "athlete", "Jordan Lee");
    const sam = await signedIn(app, "athlete", "Sam Kerr");
    for (let i = 0; i < LIMIT; i++) {
      const response = await respond(app, jordan, guess(i));
      expect(response.status).not.toBe(429);
      expect(await response.json()).toMatchObject({ error: { code: "invite-invalid" } });
    }
    const code = await invite();
    const refused = await respond(app, jordan, code, { accept: true, scope: "scores" });
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await refused.json()).toMatchObject({ error: { code: "unavailable" } });
    // The refused answer changed nothing: the invite is still pending, and Sam (his own budget) can accept it.
    expect(await (await lookup(app, sam, code)).json()).toMatchObject({ status: "pending" });
    const accepted = await respond(app, sam, code, { accept: true, scope: "scores" });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({ athleteId: sam.uid, scope: "scores" });
  });

  it("shares one budget with the signed-in lookup: lookups and answers together stop at the limit", async () => {
    const app = build();
    const invite = await coachWithInvite(app);
    const code = await invite();
    const jordan = await signedIn(app, "athlete", "Jordan Lee");
    for (let i = 0; i < LIMIT; i++) {
      const response = i % 2 ? await respond(app, jordan, guess(i)) : await lookup(app, jordan, code);
      expect(response.status).not.toBe(429);
    }
    expect((await lookup(app, jordan, code)).status).toBe(429);
    expect((await respond(app, jordan, code)).status).toBe(429);
    expect(await (await lookup(app, await signedIn(app, "athlete", "Priya Shah"), code)).json()).toMatchObject({ status: "pending" });
  });

  it("still needs a session: signed out is 401, not a guess", async () => {
    const app = build();
    const invite = await coachWithInvite(app);
    const code = await invite();
    const jordan = await signedIn(app, "athlete", "Jordan Lee");
    expect((await call(app, "POST", `/api/v1/athletes/${jordan.uid}/coach-invites/${code}/response`, { body: { accept: false } })).status).toBe(401);
  });
});
