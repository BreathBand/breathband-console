// Auth against real Mailpit and a real HTTP server: sign up, read the
// verification email through Mailpit's API, follow its link, sign in.
//
//   npm run infra:up
//   MAILPIT_E2E=1 npx vitest run server/auth.mailpit.test.ts
//
// Skipped unless MAILPIT_E2E is set, so `npm run check` needs no Docker.
// MAILPIT_URL (default http://localhost:8025) and SMTP_HOST/SMTP_PORT
// (default localhost:1025) point it elsewhere.

import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { serve, type ServerType } from "@hono/node-server";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authSecret, createAuth } from "./auth";
import { createDb } from "./db/client";
import { MIGRATIONS_DIR } from "./db/env";
import { assertLocalDatabaseUrl } from "./db/guard";
import { createApp } from "./index";
import { createSmtpMailer } from "./mailer";

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";
const APP = "http://localhost:3000";
const PASSWORD = "correct horse battery";
const WAIT_FOR_EMAIL_MS = 10_000;

type MailpitSummary = { ID: string; Subject: string };

async function waitForEmail(to: string): Promise<{ Subject: string; Text: string }> {
  const deadline = Date.now() + WAIT_FOR_EMAIL_MS;
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    expect(search.ok, `Mailpit search answered ${search.status}`).toBe(true);
    const { messages } = (await search.json()) as { messages: MailpitSummary[] };
    if (messages.length > 0) {
      const message = await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`);
      return (await message.json()) as { Subject: string; Text: string };
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`No email to ${to} in Mailpit after ${WAIT_FOR_EMAIL_MS} ms`);
}

describe.skipIf(!process.env.MAILPIT_E2E)("auth with Mailpit", () => {
  let dir: string;
  let handle: ReturnType<typeof createDb>;
  let server: ServerType;
  let api: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "breathband-mailpit-"));
    const url = `file:${join(dir, "auth.db").replaceAll("\\", "/")}`;
    assertLocalDatabaseUrl(url, "the Mailpit test's database");
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

    const mailer = createSmtpMailer({
      host: process.env.SMTP_HOST ?? "localhost",
      port: Number(process.env.SMTP_PORT ?? 1025),
    });
    const secret = authSecret("test", undefined);
    const auth = createAuth({ db: handle.db, mode: "test", secret, baseUrl: api, appUrl: APP, mailer });
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

  function post(path: string, body: unknown) {
    return fetch(`${api}/api/auth${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP },
      body: JSON.stringify(body),
    });
  }

  it("sign-up email arrives, its link verifies, sign-in works", async () => {
    const email = `t0111-${Date.now()}@example.test`;

    const signUp = await post("/sign-up/email", {
      name: "Mailpit Ana",
      email,
      password: PASSWORD,
      role: "coach",
      callbackURL: `${APP}/cloud/`,
    });
    expect(signUp.status).toBe(200);

    const message = await waitForEmail(email);
    expect(message.Subject).toMatch(/confirm your email/i);
    const link = message.Text.match(/https?:\/\/\S+/)?.[0] ?? "";
    expect(link).toMatch(new RegExp(`^${api}/api/auth/verify-email\\?token=`));

    // Not verified yet. (This sends a second email, so it comes after reading the first.)
    expect((await post("/sign-in/email", { email, password: PASSWORD })).status).toBe(403);

    const verified = await fetch(link, { redirect: "manual" });
    expect(verified.status).toBe(302);
    expect(verified.headers.get("Location")).toBe(`${APP}/cloud/`);

    const signIn = await post("/sign-in/email", { email, password: PASSWORD });
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers
      .getSetCookie()
      .map((line) => line.split(";")[0])
      .join("; ");

    const session = await fetch(`${api}/api/auth/get-session`, { headers: { Cookie: cookie } });
    expect(await session.json()).toMatchObject({
      user: { email, emailVerified: true, role: "coach", proKind: null },
    });
  });
});
