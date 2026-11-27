// The auth contract against the real API: server/ started in-process on an
// ephemeral port, a temp migrated file database, and a mailer that keeps the
// emails in memory so the tests can follow their links. No Docker needed.

import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { serve, type ServerType } from "@hono/node-server";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { currentConsents } from "@/lib/domain/consent";
import { authSecret, createAuth } from "../../../../server/auth";
import { createDb } from "../../../../server/db/client";
import { MIGRATIONS_DIR } from "../../../../server/db/env";
import { assertLocalDatabaseUrl } from "../../../../server/db/guard";
import { user as userTable } from "../../../../server/db/schema";
import { createApp } from "../../../../server/index";
import type { Email, Mailer } from "../../../../server/mailer";
import { describeAuthContract } from "../contract/auth.contract";
import { BackendError } from "../types";
import type { Fetch } from "./client";
import { createHttpBackend } from "./index";

const APP = "http://localhost:3000";

let dir: string;
let handle: ReturnType<typeof createDb>;
let server: ServerType;
let api: string;

const outbox: Email[] = [];
const mailer: Mailer = {
  async send(email) {
    outbox.push(email);
  },
};

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "breathband-http-adapter-"));
  const url = `file:${join(dir, "auth.db").replaceAll("\\", "/")}`;
  assertLocalDatabaseUrl(url, "the http adapter test's database");
  handle = createDb(url);
  await migrate(handle.db, { migrationsFolder: resolve(MIGRATIONS_DIR) });

  // Listen first, so the links in the emails can name the real port.
  const started: { app?: ReturnType<typeof createApp> } = {};
  server = serve({
    fetch: (request) => (started.app ? started.app.fetch(request) : new Response("starting", { status: 503 })),
    port: 0,
  });
  await new Promise<void>((ready) => server.once("listening", ready));
  api = `http://localhost:${(server.address() as AddressInfo).port}`;

  const auth = createAuth({ db: handle.db, mode: "test", secret: authSecret("test", undefined), baseUrl: api, appUrl: APP, mailer });
  started.app = createApp({ db: handle.db, mode: "test", appUrl: APP, auth });
});

afterAll(async () => {
  await new Promise((done) => (server ? server.close(done) : done(undefined)));
  handle?.client.close();
  try {
    if (dir) rmSync(dir, { recursive: true, force: true });
  } catch {
    // On Windows libSQL keeps the file open until the process exits; the OS temp folder gets it.
  }
});

// Better Auth rate-limits per client IP; every request here gets its own so the
// suite's many sign-ups and sign-ins don't trip it (server/routes/auth.test.ts tests the limit).
let lastIp = 0;
const nextIp = () => {
  lastIp++;
  return `198.18.${Math.floor(lastIp / 250) % 250}.${(lastIp % 250) + 1}`;
};

/**
 * Node's fetch dressed as one browser on the web app: it sends the app's Origin
 * and keeps the API's cookies, as `credentials: "include"` does in a browser.
 */
function browser(): Fetch {
  const jar = new Map<string, string>();
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("Origin", APP);
    headers.set("X-Forwarded-For", nextIp());
    if (jar.size > 0) headers.set("Cookie", [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
    const response = await fetch(input, { ...init, headers });
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(";");
      const name = pair.slice(0, pair.indexOf("="));
      const value = pair.slice(pair.indexOf("=") + 1);
      const expired = attributes.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === "";
      if (expired) jar.delete(name);
      else jar.set(name, value);
    }
    return response;
  };
}

function linkIn(email: Email | undefined): string {
  const match = email?.text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`no link in ${JSON.stringify(email)}`);
  return match[0];
}

const lastEmailTo = (address: string, subject: RegExp) =>
  outbox.filter((email) => email.to === address && subject.test(email.subject)).at(-1);

async function confirmEmail(address: string) {
  const confirmed = await fetch(linkIn(lastEmailTo(address, /confirm your email/i)), { redirect: "manual" });
  const location = confirmed.headers.get("Location") ?? "";
  if (confirmed.status !== 302 || location.includes("error=")) {
    throw new Error(`confirming ${address} failed: ${confirmed.status} ${location}`);
  }
}

function open(fetchImpl: Fetch) {
  return createHttpBackend({ baseUrl: api, appUrl: APP, fetch: fetchImpl });
}

describeAuthContract("http", { confirmsEmail: true, revealsEmailInUse: false }, () => {
  const fetchImpl = browser();
  return { backend: open(fetchImpl), reload: () => open(fetchImpl), confirmEmail };
});

describe("http adapter against the API", () => {
  const PASSWORD = "correct horse battery";
  let last = 0;
  const email = () => `http${++last}-${Date.now()}@example.test`;
  const input = (address: string) => ({
    email: address,
    password: PASSWORD,
    displayName: "  Ana Http ",
    role: "coach" as const,
    consents: currentConsents(),
    birthYear: 1990,
  });

  it("sends the name, role and birth year, and the emailed link lands on /cloud/", async () => {
    const backend = open(browser());
    const address = email();
    const created = await backend.auth.signUp(input(address));

    const [row] = await handle.db.select().from(userTable).where(eq(userTable.email, address));
    expect(row).toMatchObject({ id: created.uid, name: "Ana Http", role: "coach", birthYear: 1990, emailVerified: false });

    const confirmed = await fetch(linkIn(lastEmailTo(address, /confirm your email/i)), { redirect: "manual" });
    expect(confirmed.headers.get("Location")).toBe(`${APP}/cloud/`);
  });

  it("says why an unconfirmed sign-in is refused, and the fresh link lands on /cloud/", async () => {
    const backend = open(browser());
    const address = email();
    await backend.auth.signUp(input(address));
    outbox.length = 0;

    const error = await backend.auth.signIn(address, PASSWORD).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BackendError);
    expect(error).toMatchObject({ code: "email-not-verified", message: expect.stringMatching(/confirm your email/i) });

    const confirmed = await fetch(linkIn(lastEmailTo(address, /confirm your email/i)), { redirect: "manual" });
    expect(confirmed.headers.get("Location")).toBe(`${APP}/cloud/`);
  });

  it("sends a fresh confirmation link on request, which lands on /cloud/ and lets the person sign in", async () => {
    const backend = open(browser());
    const address = email();
    await backend.auth.signUp(input(address));
    outbox.length = 0;

    await backend.auth.sendVerificationEmail(` ${address.toUpperCase()} `);
    const fresh = outbox.filter((mail) => mail.to === address && /confirm your email/i.test(mail.subject));
    expect(fresh).toHaveLength(1);
    const confirmed = await fetch(linkIn(fresh[0]), { redirect: "manual" });
    expect(confirmed.headers.get("Location")).toBe(`${APP}/cloud/`);
    expect(await backend.auth.signIn(address, PASSWORD)).toMatchObject({ email: address, emailVerified: true });
  });

  it("sends nothing for an address with no account, and answers the same", async () => {
    const backend = open(browser());
    const address = email();
    outbox.length = 0;
    await expect(backend.auth.sendVerificationEmail(address)).resolves.toBeUndefined();
    expect(outbox.filter((mail) => mail.to === address)).toEqual([]);
  });

  it("emails a reset link that lands on the app's /cloud/reset/ with a token", async () => {
    const backend = open(browser());
    const address = email();
    await backend.auth.signUp(input(address));
    await confirmEmail(address);

    await backend.auth.sendPasswordReset(` ${address.toUpperCase()} `);
    const landed = await fetch(linkIn(lastEmailTo(address, /reset your breathband password/i)), { redirect: "manual" });
    expect(landed.status).toBe(302);
    const location = new URL(landed.headers.get("Location") ?? "");
    expect(`${location.origin}${location.pathname}`).toBe(`${APP}/cloud/reset/`);
    expect(location.searchParams.get("token")).toBeTruthy();
  });
});
