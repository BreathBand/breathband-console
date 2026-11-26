// T-0129: the invite page before sign-up. GET /api/v1/coach-invites/{code}/preview
// answers without a session, with the minimum, only for a pending, unexpired
// invite, and is rate limited per client IP; the signed-in lookup is limited
// per person. What the contract sections can't reach: other IPs, the 429, and
// invites the server expires itself.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { currentConsents } from "@/lib/domain/consent";
import { withProDefaults } from "@/lib/domain/pro-defaults";
import { defaultProProfile } from "@/lib/domain/pro-profile";
import { authSecret, createAuth } from "../auth";
import { createDb, type Db } from "../db/client";
import { MIGRATIONS_DIR } from "../db/env";
import { assertLocalDatabaseUrl } from "../db/guard";
import { coachInvites } from "../db/schema";
import { createApp } from "../index";
import type { Email, Mailer } from "../mailer";
import { createFsStorage, type StorageService } from "../storage";
import { hashCode } from "./codes";
import { PUBLIC_LOOKUP_LIMIT, SIGNED_IN_LOOKUP_LIMIT } from "./coach-invites";

const APP = "http://localhost:3000";
const API = "http://localhost:8787";
const PASSWORD = "correct horse battery";

const dir = mkdtempSync(join(tmpdir(), "breathband-public-invite-"));
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
  assertLocalDatabaseUrl(url, "the public invite test's database");
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

function call(app: App, method: string, path: string, options: { body?: unknown; cookie?: string; ip?: string } = {}) {
  return app.request(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: APP,
      "X-Forwarded-For": options.ip ?? `198.51.102.${++lastIp % 250}`,
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function signedIn(app: App, role: "athlete" | "coach", name: string) {
  const email = `public${++lastEmail}-${Date.now()}@example.test`;
  const body = { name, email, password: PASSWORD, birthYear: 1990, consents: currentConsents(), role };
  const created = (await (await call(app, "POST", "/api/auth/sign-up/email", { body })).json()) as { user: { id: string } };
  const link = outbox.filter((e) => e.to === email).at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
  expect((await app.request(link!)).status).toBe(302);
  const response = await call(app, "POST", "/api/auth/sign-in/email", { body: { email, password: PASSWORD } });
  const cookie = response.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
  return { uid: created.user.id, cookie };
}

const physio = withProDefaults({ ...defaultProProfile("clinician"), profession: "physiotherapist", country: "Ireland", useCases: ["between-visits"] });

async function clinicianWithInvite(app: App) {
  const aoife = await signedIn(app, "coach", "Aoife Byrne");
  expect((await call(app, "PATCH", `/api/v1/users/${aoife.uid}`, { cookie: aoife.cookie, body: { proKind: "clinician", proProfile: physio } })).status).toBe(200);
  const invite = async (practice?: string) => {
    const body = { athleteName: "Jordan Lee", contact: "jordan@example.com", ...(practice ? { practice } : {}) };
    const response = await call(app, "POST", `/api/v1/coaches/${aoife.uid}/coach-invites`, { cookie: aoife.cookie, body });
    expect(response.status).toBe(200);
    return ((await response.json()) as { code: string }).code;
  };
  return { aoife, invite };
}

const preview = (app: App, code: string, ip: string) => call(app, "GET", `/api/v1/coach-invites/${encodeURIComponent(code)}/preview`, { ip });

describe("the invite's public preview", () => {
  it("answers without a session with the minimum: name, kind, profession, scope asked for and practice", async () => {
    const app = build();
    const { invite } = await clinicianWithInvite(app);
    const code = await invite("between-visits");
    const response = await preview(app, ` ${code.toLowerCase()} `, "203.0.113.1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      coachName: "Aoife Byrne",
      coachKind: "clinician",
      coachProfession: "physiotherapist",
      scopeRequested: physio.scopeRequested,
      practice: "between-visits",
    });
  });

  it("answers the same 404 for an unknown code and for expired, revoked, declined and accepted invites", async () => {
    const app = build();
    const { aoife, invite } = await clinicianWithInvite(app);
    const jordan = await signedIn(app, "athlete", "Jordan Lee");
    const [expired, revoked, declined, accepted] = [await invite(), await invite(), await invite(), await invite()];
    await db.update(coachInvites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(coachInvites.codeHash, hashCode(expired)));
    await call(app, "POST", `/api/v1/coaches/${aoife.uid}/coach-invites/${revoked}/revoke`, { cookie: aoife.cookie });
    await call(app, "POST", `/api/v1/athletes/${jordan.uid}/coach-invites/${declined}/response`, { cookie: jordan.cookie, body: { accept: false } });
    await call(app, "POST", `/api/v1/athletes/${jordan.uid}/coach-invites/${accepted}/response`, { cookie: jordan.cookie, body: { accept: true, scope: "scores" } });

    const bodies = [];
    for (const code of ["ZZZZ2222", expired, revoked, declined, accepted, "not a code at all"]) {
      const response = await preview(app, code, "203.0.113.2");
      expect(response.status).toBe(404);
      bodies.push(await response.text());
    }
    expect(new Set(bodies.slice(0, 5)).size).toBe(1);
    expect(JSON.parse(bodies[0])).toEqual({ error: { code: "not-found", message: "not-found" } });
  });

  it(`refuses the ${PUBLIC_LOOKUP_LIMIT.limit + 1}th lookup in a minute from one IP, hits and misses alike, while another IP still answers`, async () => {
    const app = build();
    const { invite } = await clinicianWithInvite(app);
    const code = await invite();
    for (let i = 0; i < PUBLIC_LOOKUP_LIMIT.limit; i++) {
      const guess = i % 2 ? code : `ZZZZ${String(2222 + i).slice(-4).replace(/[01]/g, "2")}`;
      expect([200, 404]).toContain((await preview(app, guess, "203.0.113.3")).status);
    }
    const refused = await preview(app, code, "203.0.113.3");
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await refused.json()).toMatchObject({ error: { code: "unavailable" } });
    // A forged leftmost X-Forwarded-For entry doesn't buy a new bucket: the proxy's entry is the rightmost.
    expect((await preview(app, code, "1.2.3.4, 203.0.113.3")).status).toBe(429);
    expect((await preview(app, code, "203.0.113.4")).status).toBe(200);
  });

  it("keeps the signed-in lookup as it was, limited per person", async () => {
    const app = build();
    const { invite } = await clinicianWithInvite(app);
    const code = await invite();
    const jordan = await signedIn(app, "athlete", "Jordan Lee");
    const sam = await signedIn(app, "athlete", "Sam Kerr");
    for (let i = 0; i < SIGNED_IN_LOOKUP_LIMIT.limit; i++) {
      expect((await call(app, "GET", `/api/v1/coach-invites/${code}`, { cookie: jordan.cookie })).status).toBe(200);
    }
    expect((await call(app, "GET", `/api/v1/coach-invites/${code}`, { cookie: jordan.cookie })).status).toBe(429);
    expect((await call(app, "GET", `/api/v1/coach-invites/${code}`, { cookie: sam.cookie })).status).toBe(200);
    expect((await call(app, "GET", `/api/v1/coach-invites/${code}`)).status).toBe(401);
  });
});
