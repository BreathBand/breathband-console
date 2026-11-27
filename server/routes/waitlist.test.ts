// The waitlist is public, so it's limited per client IP: past the limit an
// address gets a 429 while another address still gets in.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { authSecret, createAuth } from "../auth";
import { createDb, type Db } from "../db/client";
import { MIGRATIONS_DIR } from "../db/env";
import { assertLocalDatabaseUrl } from "../db/guard";
import { createApp } from "../index";
import { createFsStorage } from "../storage";
import { WAITLIST_LIMIT } from "./waitlist";

const APP = "http://localhost:3000";
const API = "http://localhost:8787";

const dir = mkdtempSync(join(tmpdir(), "breathband-waitlist-"));
const url = `file:${join(dir, "data.db").replaceAll("\\", "/")}`;
let handle: ReturnType<typeof createDb>;
let db: Db;

beforeAll(async () => {
  assertLocalDatabaseUrl(url, "the waitlist test's database");
  handle = createDb(url);
  db = handle.db;
  await migrate(db, { migrationsFolder: resolve(MIGRATIONS_DIR) });
});

afterAll(() => {
  handle?.client.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // On Windows libSQL keeps the file open until the process exits; the OS temp folder gets it.
  }
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/v1/waitlist", () => {
  it("answers 429 past the limit for one address, and still takes another", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    const mailer = { async send() {} };
    const app = createApp({
      db,
      mode: "test",
      appUrl: APP,
      auth: createAuth({ db, mode: "test", secret: authSecret("test", undefined), baseUrl: API, appUrl: APP, mailer }),
      storage: createFsStorage(join(dir, "blobs")),
    });
    const join_ = (ip: string, n: number) =>
      app.request(`${API}/api/v1/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: APP, "X-Forwarded-For": ip },
        body: JSON.stringify({ email: `wait${n}@example.test`, source: "site" }),
      });

    for (let n = 0; n < WAITLIST_LIMIT.limit; n++) expect((await join_("203.0.113.7", n)).status).toBe(200);
    expect((await join_("203.0.113.7", 999)).status).toBe(429);
    expect((await join_("203.0.113.8", 1000)).status).toBe(200);
  });
});
