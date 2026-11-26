// The data routes with app.request(): what the shared contract sections
// (src/lib/backend/contract) can't reach through the adapter: unsigned and
// malformed requests, and values the server assigns itself.

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

const APP = "http://localhost:3000";
const API = "http://localhost:8787";
const PASSWORD = "correct horse battery";

const dir = mkdtempSync(join(tmpdir(), "breathband-data-"));
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
  assertLocalDatabaseUrl(url, "the data routes test's database");
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

const auth = () => createAuth({ db, mode: "test", secret: authSecret("test", undefined), baseUrl: API, appUrl: APP, mailer });
const build = (withStorage = true) => createApp({ db, mode: "test", appUrl: APP, auth: auth(), storage: withStorage ? storage : undefined });
type App = ReturnType<typeof build>;

let lastIp = 0;
let lastEmail = 0;

function call(app: App, method: string, path: string, options: { body?: unknown; cookie?: string; raw?: string } = {}) {
  return app.request(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: APP,
      "X-Forwarded-For": `198.51.101.${++lastIp % 250}`,
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
}

/** A confirmed, signed-in athlete: their id and session cookie. */
async function signedIn(app: App) {
  const email = `data${++lastEmail}-${Date.now()}@example.test`;
  const body = { name: "Ana", email, password: PASSWORD, birthYear: 1990, consents: currentConsents() };
  const created = (await (await call(app, "POST", "/api/auth/sign-up/email", { body })).json()) as { user: { id: string } };
  const link = outbox.filter((e) => e.to === email).at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
  expect((await app.request(link!)).status).toBe(302);
  const response = await call(app, "POST", "/api/auth/sign-in/email", { body: { email, password: PASSWORD } });
  const cookie = response.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
  return { uid: created.user.id, cookie };
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

describe("data routes", () => {
  it("answer 401 not-signed-in without a session", async () => {
    const response = await call(build(), "GET", "/api/v1/users/anyone");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "not-signed-in", message: "Sign in first." } });
  });

  it("are not mounted without a StorageService", async () => {
    expect((await call(build(false), "GET", "/api/v1/users/anyone")).status).toBe(404);
  });

  it("refuse a body that isn't a JSON object", async () => {
    const app = build();
    const { uid, cookie } = await signedIn(app);
    for (const raw of ["[]", "not json", "null"]) {
      const response = await call(app, "PATCH", `/api/v1/users/${uid}`, { cookie, raw });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "invalid-input" } });
    }
  });

  it("refuse preferences that would crash the validators, and a malformed session", async () => {
    const app = build();
    const { uid, cookie } = await signedIn(app);
    for (const preferences of ["train", [], { goal: "train" }]) {
      const response = await call(app, "PATCH", `/api/v1/users/${uid}`, { cookie, body: { preferences } });
      expect(response.status, JSON.stringify(preferences)).toBe(400);
    }
    for (const bad of [{ ...session, mode: "free" }, { ...session, startedAt: "yesterday" }, { ...session, durationSec: "60" }]) {
      const response = await call(app, "POST", `/api/v1/athletes/${uid}/sessions`, { cookie, body: { session: bad, waveform } });
      expect(response.status, JSON.stringify(bad)).toBe(400);
    }
  });

  it("assign the id, owner and waveformPath themselves, whatever the request says", async () => {
    const app = build();
    const { uid, cookie } = await signedIn(app);
    const body = { session: { ...session, id: "mine", athleteId: "someone-else", waveformPath: "../../escape.json.gz", groupSessionId: "g-1" }, waveform };
    const response = await call(app, "POST", `/api/v1/athletes/${uid}/sessions`, { cookie, body });
    expect(response.status).toBe(200);
    const saved = (await response.json()) as Record<string, unknown>;
    expect(saved.id).not.toBe("mine");
    expect(saved).toMatchObject({ athleteId: uid, waveformPath: `waveforms/${uid}/${String(saved.id)}.json.gz` });
    expect(saved).not.toHaveProperty("groupSessionId");
    expect(await storage.getJson(String(saved.waveformPath))).toEqual(waveform);
  });

  it("refuse a session whose signal is over 5 MB", async () => {
    const app = build();
    const { uid, cookie } = await signedIn(app);
    const big = { ...waveform, user: new Array(1_200_000).fill(0.123456) };
    const response = await call(app, "POST", `/api/v1/athletes/${uid}/sessions`, { cookie, body: { session, waveform: big } });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid-input", message: "signal over 5 MB" } });
  });

  it("answer 404 for a waveform whose blob is missing", async () => {
    const app = build();
    const { uid, cookie } = await signedIn(app);
    const saved = (await (await call(app, "POST", `/api/v1/athletes/${uid}/sessions`, { cookie, body: { session, waveform } })).json()) as {
      id: string;
      waveformPath: string;
    };
    await storage.delete(saved.waveformPath);
    const response = await call(app, "GET", `/api/v1/athletes/${uid}/sessions/${saved.id}/waveform`, { cookie });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "not-found" } });
  });
});
