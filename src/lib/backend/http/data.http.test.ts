// The DataService contract sections against the real API: server/ in-process on
// an ephemeral port, a temp migrated file database, a temp STORAGE_DIR, and a
// mailer that keeps emails in memory so each person can confirm their address.
// Built like auth.http.test.ts. No Docker needed.

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { serve, type ServerType } from "@hono/node-server";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { currentConsents } from "@/lib/domain/consent";
import { authSecret, createAuth } from "../../../../server/auth";
import { createDb } from "../../../../server/db/client";
import { MIGRATIONS_DIR } from "../../../../server/db/env";
import { assertLocalDatabaseUrl } from "../../../../server/db/guard";
import { coachLinks, consents, user as userTable } from "../../../../server/db/schema";
import { createApp } from "../../../../server/index";
import type { Email, Mailer } from "../../../../server/mailer";
import { createFsStorage } from "../../../../server/storage";
import type { DataContractHarness } from "../contract/data.harness";
import { PASSWORD, refusal, signUpInput, uniqueEmail } from "../contract/data.harness";
import { describeProfileContract } from "../contract/profile.contract";
import { describeSessionsContract } from "../contract/sessions.contract";
import type { AuthUser } from "../types";
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
  dir = mkdtempSync(join(tmpdir(), "breathband-http-data-"));
  const url = `file:${join(dir, "data.db").replaceAll("\\", "/")}`;
  assertLocalDatabaseUrl(url, "the http data test's database");
  handle = createDb(url);
  await migrate(handle.db, { migrationsFolder: resolve(MIGRATIONS_DIR) });

  const started: { app?: ReturnType<typeof createApp> } = {};
  server = serve({
    fetch: (request) => (started.app ? started.app.fetch(request) : new Response("starting", { status: 503 })),
    port: 0,
  });
  await new Promise<void>((ready) => server.once("listening", ready));
  api = `http://localhost:${(server.address() as AddressInfo).port}`;

  const auth = createAuth({ db: handle.db, mode: "test", secret: authSecret("test", undefined), baseUrl: api, appUrl: APP, mailer });
  const storage = createFsStorage(join(dir, "blobs"));
  started.app = createApp({ db: handle.db, mode: "test", appUrl: APP, auth, storage });
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

// Better Auth rate-limits sign-in per client IP; every request gets its own (server/routes/auth.test.ts tests the limit).
let lastIp = 0;
const nextIp = () => {
  lastIp++;
  return `198.19.${Math.floor(lastIp / 250) % 250}.${(lastIp % 250) + 1}`;
};

/** Node's fetch as one browser on the web app: the app's Origin, and the API's cookies kept. */
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

async function confirmEmail(address: string) {
  const email = outbox.filter((e) => e.to === address && /confirm your email/i.test(e.subject)).at(-1);
  const link = email?.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`no confirmation email to ${address}`);
  const confirmed = await fetch(link, { redirect: "manual" });
  if (confirmed.status !== 302) throw new Error(`confirming ${address} failed: ${confirmed.status}`);
}

const open = (fetchImpl: Fetch = browser()) => createHttpBackend({ baseUrl: api, appUrl: APP, fetch: fetchImpl });

const harness = (): DataContractHarness => ({
  async person(role = "athlete") {
    const backend = open();
    const input = signUpInput(role);
    await backend.auth.signUp(input);
    await confirmEmail(input.email);
    const user = await backend.auth.signIn(input.email, input.password);
    return { uid: user.uid, email: user.email, birthYear: input.birthYear, backend };
  },
  signedOut: () => open(),
  async link(coachId, athleteId, scope) {
    const where = and(eq(coachLinks.coachId, coachId), eq(coachLinks.athleteId, athleteId));
    if (!scope) await handle.db.delete(coachLinks).where(where);
    else await handle.db.insert(coachLinks).values({ coachId, athleteId, scope }).onConflictDoUpdate({ target: [coachLinks.coachId, coachLinks.athleteId], set: { scope } });
  },
});

describeProfileContract("http", harness);
describeSessionsContract("http", harness);

describe("the API behind the http DataService", () => {
  const post = (path: string, body: unknown) =>
    fetch(`${api}/api/auth${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP, "X-Forwarded-For": nextIp() },
      body: JSON.stringify(body),
    });
  const signUpBody = (fields: Record<string, unknown> = {}) => ({
    name: "Direct",
    email: uniqueEmail(),
    password: PASSWORD,
    birthYear: 1990,
    consents: currentConsents(),
    ...fields,
  });
  const userRow = async (email: string) => (await handle.db.select().from(userTable).where(eq(userTable.email, email)))[0];

  it("stores the consent records at sign-up, one per kind at its version", async () => {
    const body = signUpBody();
    expect((await post("/sign-up/email", body)).status).toBe(200);
    const row = await userRow(body.email);
    const stored = await handle.db.select().from(consents).where(eq(consents.userId, row.id));
    expect(stored.map((c) => [c.kind, c.version]).sort()).toEqual(currentConsents().map((c) => [c.kind, c.version]).sort());
  });

  it.each<[string, Record<string, unknown>, string]>([
    ["someone under 16", { birthYear: new Date().getUTCFullYear() - 15 }, "under-age"],
    ["a missing consent", { consents: currentConsents(["terms", "privacy"]) }, "invalid-input"],
    ["an outdated consent version", { consents: currentConsents().map((c) => ({ ...c, version: "old" })) }, "invalid-input"],
    ["consents that aren't a list", { consents: "yes" }, "invalid-input"],
  ])("refuses a direct sign-up from %s, and creates no account", async (_, fields, code) => {
    const body = signUpBody(fields);
    const response = await post("/sign-up/email", body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code });
    expect(await userRow(body.email)).toBeUndefined();
  });

  it("refuses under 16 on update-user too", async () => {
    const fetchImpl = browser();
    const backend = open(fetchImpl);
    const input = signUpInput();
    await backend.auth.signUp(input);
    await confirmEmail(input.email);
    await backend.auth.signIn(input.email, input.password);
    const response = await fetchImpl(`${api}/api/auth/update-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthYear: new Date().getUTCFullYear() - 10 }),
    });
    expect(response.status).toBe(400);
    expect((await userRow(input.email)).birthYear).toBe(input.birthYear);
  });

  it("counts the person as signed out when a data route answers 401", async () => {
    const fetchImpl = browser();
    const backend = open(fetchImpl);
    const input = signUpInput();
    await backend.auth.signUp(input);
    await confirmEmail(input.email);
    const user = await backend.auth.signIn(input.email, input.password);
    const seen: (AuthUser | null)[] = [];
    backend.auth.onAuthStateChanged((u) => seen.push(u));

    // The session ends elsewhere (another tab signs out, or it is revoked).
    await open(fetchImpl).auth.signOut();
    await refusal(backend.data.getProfile(user.uid), "not-signed-in");
    expect(backend.auth.currentUser()).toBeNull();
    expect(seen.at(-1)).toBeNull();
  });

  it("removes the stored signal with the session", async () => {
    const person = await harness().person();
    const saved = await person.backend.data.saveSession(
      person.uid,
      { startedAt: "2026-11-24T08:00:00.000Z", durationSec: 60, mode: "open", pacerHalfCycleSec: null, scores: null, scoringVersion: "transition-v1", respirationRateBpm: null, note: "", appVersion: "web" },
      { sampleIntervalMs: 50, user: [0, 1, 0], pacer: null, markers: [], calibration: { min: 0, max: 1 } },
    );
    const blob = join(dir, "blobs", ...saved.waveformPath.split("/"));
    expect(existsSync(blob)).toBe(true);
    await person.backend.data.deleteSession(person.uid, saved.id);
    expect(existsSync(blob)).toBe(false);
  });
});
