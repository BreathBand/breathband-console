import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { authSecret, createAuth, SIGN_IN_RATE_LIMIT } from "../auth";
import { createDb, type Db } from "../db/client";
import { MIGRATIONS_DIR } from "../db/env";
import { assertLocalDatabaseUrl } from "../db/guard";
import { user } from "../db/schema";
import type { Mode } from "../env";
import { createApp, SECURITY_HEADERS } from "../index";
import type { Email, Mailer } from "../mailer";

const APP = "http://localhost:3000";
const API = "http://localhost:8787";
const PASSWORD = "correct horse battery";

const dir = mkdtempSync(join(tmpdir(), "breathband-auth-"));
const url = `file:${join(dir, "auth.db").replaceAll("\\", "/")}`;
let handle: ReturnType<typeof createDb>;
let db: Db;

const outbox: Email[] = [];
const mailer: Mailer = {
  async send(email) {
    outbox.push(email);
  },
};

beforeAll(async () => {
  assertLocalDatabaseUrl(url, "the auth test's database");
  handle = createDb(url);
  db = handle.db;
  await migrate(db, { migrationsFolder: resolve(MIGRATIONS_DIR) });
});

beforeEach(() => {
  outbox.length = 0;
});

afterAll(() => {
  handle?.client.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // On Windows libSQL keeps the file open until the process exits; the OS temp folder gets it.
  }
});

function build(mode: Mode = "test") {
  const secret = authSecret(mode, mode === "production" ? "test-only-production-secret-0123456789abcdef" : undefined);
  const auth = createAuth({ db, mode, secret, baseUrl: API, appUrl: APP, mailer });
  return createApp({ db, mode, appUrl: APP, auth });
}

type App = ReturnType<typeof build>;

// Better Auth's rate limiter keys on the client IP. Each test gets its own unless it shares one on purpose.
let lastIp = 0;
const nextIp = () => `198.51.100.${++lastIp}`;

let lastEmail = 0;
const nextEmail = () => `person${++lastEmail}-${Date.now()}@example.test`;

type RequestOptions = { ip?: string; cookie?: string; origin?: string };

function post(app: App, path: string, body: unknown, options: RequestOptions = {}) {
  return app.request(`${API}/api/auth${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: options.origin ?? APP,
      "X-Forwarded-For": options.ip ?? nextIp(),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function get(app: App, target: string, options: RequestOptions = {}) {
  const href = target.startsWith("http") ? target : `${API}/api/auth${target}`;
  return app.request(href, {
    headers: { "X-Forwarded-For": options.ip ?? nextIp(), ...(options.cookie ? { Cookie: options.cookie } : {}) },
  });
}

/** The `name=value` pairs a browser would send back. */
function cookiesFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
}

function linkIn(email: Email | undefined): string {
  const match = email?.text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`no link in ${JSON.stringify(email)}`);
  return match[0];
}

function lastEmailTo(address: string): Email | undefined {
  return outbox.filter((email) => email.to === address).at(-1);
}

async function signUp(app: App, fields: Record<string, unknown> = {}) {
  const email = nextEmail();
  const response = await post(app, "/sign-up/email", {
    name: "Ana",
    email,
    password: PASSWORD,
    callbackURL: `${APP}/cloud/`,
    ...fields,
  });
  return { email, response };
}

async function signUpVerified(app: App, fields: Record<string, unknown> = {}) {
  const { email } = await signUp(app, fields);
  const verified = await get(app, linkIn(lastEmailTo(email)));
  expect(verified.status).toBe(302);
  return email;
}

async function session(app: App, cookie: string) {
  const response = await get(app, "/get-session", { cookie });
  expect(response.status).toBe(200);
  return (await response.json()) as { user: Record<string, unknown> } | null;
}

describe("sign up", () => {
  it("creates the user with role, pro kind and birth year, sends a verification email and no session", async () => {
    const app = build();
    const { email, response } = await signUp(app, { role: "coach", proKind: "clinician", birthYear: 1988 });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      token: null,
      user: { email, name: "Ana", emailVerified: false, role: "coach", proKind: "clinician", birthYear: 1988 },
    });
    expect(response.headers.getSetCookie()).toEqual([]);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(response.headers.get(name)).toBe(value);

    const [row] = await db.select().from(user).where(eq(user.email, email));
    expect(row).toMatchObject({ role: "coach", proKind: "clinician", birthYear: 1988, emailVerified: false });

    const mail = lastEmailTo(email);
    expect(mail?.subject).toMatch(/confirm your email/i);
    expect(linkIn(mail)).toMatch(new RegExp(`^${API}/api/auth/verify-email\\?token=`));
  });

  it("defaults the role to athlete with no pro kind", async () => {
    const app = build();
    const { email, response } = await signUp(app);
    expect(response.status).toBe(200);
    const [row] = await db.select().from(user).where(eq(user.email, email));
    expect(row).toMatchObject({ role: "athlete", proKind: null, birthYear: null });
  });

  it.each([
    ["an unknown role", { role: "admin" }],
    ["an unknown pro kind", { role: "coach", proKind: "wizard" }],
    ["a birth year in the future", { birthYear: new Date().getUTCFullYear() + 1 }],
    ["a birth year that isn't a number", { birthYear: "1988" }],
  ])("refuses %s", async (_, fields) => {
    const app = build();
    const { email, response } = await signUp(app, fields);
    expect(response.status).toBe(400);
    expect(await db.select().from(user).where(eq(user.email, email))).toEqual([]);
    expect(outbox).toEqual([]);
  });

  it("refuses a short password", async () => {
    const { response } = await signUp(build(), { password: "short" });
    expect(response.status).toBe(400);
  });

  it("answers a duplicate sign-up like a new one, without a second account", async () => {
    const app = build();
    const email = await signUpVerified(app);
    const again = await post(app, "/sign-up/email", { name: "Someone", email, password: "another password" });
    expect(again.status).toBe(200);
    expect(await db.select().from(user).where(eq(user.email, email))).toHaveLength(1);
  });

  it("refuses a callback URL on another site", async () => {
    const { response } = await signUp(build(), { callbackURL: "https://evil.example/" });
    expect(response.status).toBe(403);
  });
});

describe("sign in", () => {
  it("refuses an unverified email and sends a fresh verification link", async () => {
    const app = build();
    const { email } = await signUp(app);
    outbox.length = 0;

    const response = await post(app, "/sign-in/email", { email, password: PASSWORD });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(lastEmailTo(email)?.subject).toMatch(/confirm your email/i);

    // No callbackURL on sign-in: the link still lands on the web app, not on the API's port.
    const verified = await get(app, linkIn(lastEmailTo(email)));
    expect(verified.status).toBe(302);
    expect(verified.headers.get("Location")).toBe(`${APP}/`);
  });

  it("works after the verification link, and the session carries role and pro kind", async () => {
    const app = build();
    const { email } = await signUp(app, { role: "coach", proKind: "educator" });

    const verified = await get(app, linkIn(lastEmailTo(email)));
    expect(verified.status).toBe(302);
    expect(verified.headers.get("Location")).toBe(`${APP}/cloud/`);
    const [row] = await db.select().from(user).where(eq(user.email, email));
    expect(row.emailVerified).toBe(true);

    const response = await post(app, "/sign-in/email", { email, password: PASSWORD });
    expect(response.status).toBe(200);
    const cookie = cookiesFrom(response);
    expect(cookie).toContain("breathband.session_token=");
    expect(await session(app, cookie)).toMatchObject({
      user: { email, emailVerified: true, role: "coach", proKind: "educator" },
    });
  });

  it("signs the person in from the verification link", async () => {
    const app = build();
    const { email } = await signUp(app);
    const verified = await get(app, linkIn(lastEmailTo(email)));
    expect(await session(app, cookiesFrom(verified))).toMatchObject({ user: { email } });
  });

  it("refuses a tampered verification token", async () => {
    const app = build();
    const { email } = await signUp(app);
    const link = linkIn(lastEmailTo(email)).replace(/token=([^&]+)/, (_, token: string) => `token=${token.slice(0, -2)}xx`);
    const response = await get(app, link);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toMatch(new RegExp(`^${APP}/cloud/\\?error=`));
    expect(response.headers.getSetCookie()).toEqual([]);
    const [row] = await db.select().from(user).where(eq(user.email, email));
    expect(row.emailVerified).toBe(false);
  });

  it("refuses a wrong password", async () => {
    const app = build();
    const email = await signUpVerified(app);
    const response = await post(app, "/sign-in/email", { email, password: "wrong password" });
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it(`rate limits sign-in: ${SIGN_IN_RATE_LIMIT.max} attempts per ${SIGN_IN_RATE_LIMIT.window} s per IP`, async () => {
    const app = build();
    const email = await signUpVerified(app);
    const ip = nextIp();

    for (let attempt = 1; attempt <= SIGN_IN_RATE_LIMIT.max; attempt++) {
      const response = await post(app, "/sign-in/email", { email, password: "wrong password" }, { ip });
      expect(response.status, `attempt ${attempt}`).toBe(401);
    }
    const blocked = await post(app, "/sign-in/email", { email, password: PASSWORD }, { ip });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("X-Retry-After"))).toBeGreaterThan(0);
    expect(blocked.headers.getSetCookie()).toEqual([]);

    const elsewhere = await post(app, "/sign-in/email", { email, password: PASSWORD });
    expect(elsewhere.status).toBe(200);
  });
});

describe("sign out", () => {
  it("ends the session", async () => {
    const app = build();
    const email = await signUpVerified(app);
    const cookie = cookiesFrom(await post(app, "/sign-in/email", { email, password: PASSWORD }));
    expect(await session(app, cookie)).not.toBeNull();

    const response = await post(app, "/sign-out", {}, { cookie });
    expect(response.status).toBe(200);
    expect(await session(app, cookie)).toBeNull();
  });

  it("refuses a request from another origin that carries the cookie", async () => {
    const app = build();
    const email = await signUpVerified(app);
    const cookie = cookiesFrom(await post(app, "/sign-in/email", { email, password: PASSWORD }));

    const response = await post(app, "/sign-out", {}, { cookie, origin: "https://evil.example" });
    expect(response.status).toBe(403);
    expect(await session(app, cookie)).not.toBeNull();
  });

  it("has no session without a cookie", async () => {
    expect(await session(build(), "")).toBeNull();
  });
});

describe("password reset", () => {
  it("emails a link that leads to a new password and ends existing sessions", async () => {
    const app = build();
    const email = await signUpVerified(app);
    const oldCookie = cookiesFrom(await post(app, "/sign-in/email", { email, password: PASSWORD }));

    const requested = await post(app, "/request-password-reset", { email, redirectTo: `${APP}/cloud/reset/` });
    expect(requested.status).toBe(200);
    const mail = lastEmailTo(email);
    expect(mail?.subject).toMatch(/reset your breathband password/i);
    const link = linkIn(mail);
    expect(link).toMatch(new RegExp(`^${API}/api/auth/reset-password/`));

    const landed = await get(app, link);
    expect(landed.status).toBe(302);
    const location = new URL(landed.headers.get("Location") ?? "");
    expect(`${location.origin}${location.pathname}`).toBe(`${APP}/cloud/reset/`);
    const token = location.searchParams.get("token");
    expect(token).toBeTruthy();

    const reset = await post(app, "/reset-password", { token, newPassword: "a brand new password" });
    expect(reset.status).toBe(200);

    expect(await session(app, oldCookie)).toBeNull();
    expect((await post(app, "/sign-in/email", { email, password: PASSWORD })).status).toBe(401);
    expect((await post(app, "/sign-in/email", { email, password: "a brand new password" })).status).toBe(200);

    const reused = await post(app, "/reset-password", { token, newPassword: "yet another password" });
    expect(reused.status).toBe(400);
  });

  it("answers the same for an unknown email and sends nothing", async () => {
    const response = await post(build(), "/request-password-reset", {
      email: nextEmail(),
      redirectTo: `${APP}/cloud/reset/`,
    });
    expect(response.status).toBe(200);
    expect(outbox).toEqual([]);
  });

  it("refuses a redirect to another site", async () => {
    const app = build();
    const email = await signUpVerified(app);
    outbox.length = 0;
    const response = await post(app, "/request-password-reset", { email, redirectTo: "https://evil.example/reset" });
    expect(response.status).toBe(403);
    expect(outbox).toEqual([]);
  });
});

describe("cookies", () => {
  async function signInCookies(mode: Mode) {
    const app = build(mode);
    const { email } = await signUp(app);
    await db.update(user).set({ emailVerified: true }).where(eq(user.email, email));
    const response = await post(app, "/sign-in/email", { email, password: PASSWORD });
    expect(response.status).toBe(200);
    return response.headers.getSetCookie();
  }

  it("are Secure, HttpOnly, SameSite=Lax and __Secure- prefixed in production", async () => {
    const [cookie] = await signInCookies("production");
    expect(cookie).toMatch(/^__Secure-breathband\.session_token=/);
    expect(cookie).toMatch(/; Secure/i);
    expect(cookie).toMatch(/; HttpOnly/i);
    expect(cookie).toMatch(/; SameSite=Lax/i);
  });

  it("are HttpOnly but not Secure in development and tests (plain http on localhost)", async () => {
    const [cookie] = await signInCookies("test");
    expect(cookie).toMatch(/^breathband\.session_token=/);
    expect(cookie).toMatch(/; HttpOnly/i);
    expect(cookie).not.toMatch(/; Secure/i);
  });
});

describe("without auth", () => {
  it("has no /api/auth routes when the app is built without it", async () => {
    const app = createApp({ db, mode: "test", appUrl: APP });
    const response = await app.request("/api/auth/get-session");
    expect(response.status).toBe(404);
  });
});
