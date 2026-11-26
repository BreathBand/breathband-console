// The 24 h deletion job against a file database and the fs StorageService, with
// a fake clock: deleteDueAccounts(deps, now).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Db } from "../db/client";
import { MIGRATIONS_DIR } from "../db/env";
import { assertLocalDatabaseUrl } from "../db/guard";
import { accountDeletions, user } from "../db/schema";
import { createFsStorage, waveformKey, type StorageService } from "../storage";
import { DELETION_DELAY_MS, deleteAccount, deleteDueAccounts, pendingDeletions, startDeletionJob } from "./deletion";
import { ALL_TABLES, allRows, seedEverything } from "./fixture";

const dir = mkdtempSync(join(tmpdir(), "breathband-deletion-"));
const url = `file:${join(dir, "deletion.db").replaceAll("\\", "/")}`;
let handle: ReturnType<typeof createDb>;
let db: Db;
let storage: StorageService;

beforeAll(async () => {
  assertLocalDatabaseUrl(url, "the deletion job test's database");
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

let lastUser = 0;

async function person(name: string) {
  const id = `${name}${++lastUser}`;
  const email = `${id}@example.test`;
  await db.insert(user).values({ id, name, email });
  return { id, email };
}

/** Does any column of this JSON row name the person: their id, their email, or an id of theirs (the fixture's `${id}-...`)? */
const holdsAny = (row: string, [id, email]: readonly [string, string]) =>
  Object.values(JSON.parse(row) as Record<string, unknown>).some((v) => v === id || v === email || (typeof v === "string" && v.startsWith(`${id}-`)));

const T0 = new Date("2026-11-26T12:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

describe("deleteDueAccounts", () => {
  it("removes every row and blob of the account 24 h after the request, and nothing of anyone else's", async () => {
    const [ana, ben, cy] = [await person("ana"), await person("ben"), await person("cy")];
    const anas = await seedEverything(db, storage, ana.id, ana.email, ben.id);
    // Cy has the same spread of data, all of it with Ben: none of it touches Ana.
    const cys = await seedEverything(db, storage, cy.id, cy.email, ben.id);
    const anaValues = [ana.id, ana.email] as const;

    const before = await allRows(db);
    // The fixture really does put Ana in every table but the program content.
    for (const [name, rows] of Object.entries(before)) {
      if (name === "programs" || name === "account_deletions") continue;
      expect(rows.some((row) => holdsAny(row, anaValues)), `fixture: ${name} has a row for Ana`).toBe(true);
    }
    const untouched = (rows: Record<string, string[]>) =>
      Object.fromEntries(Object.entries(rows).map(([name, list]) => [name, list.filter((row) => !holdsAny(row, anaValues)).sort()]));

    await db.insert(accountDeletions).values({ userId: ana.id, requestedAt: T0 });

    // Inside the 24 h: nothing goes.
    expect(await deleteDueAccounts({ db, storage }, at(DELETION_DELAY_MS - 1))).toEqual({ deleted: [], failed: [] });
    expect(await allRows(db)).toEqual({ ...before, account_deletions: expect.any(Array) });
    expect(await storage.getJson(waveformKey(ana.id, anas.mySessions[0]))).not.toBeNull();

    // At 24 h: Ana's account goes.
    expect(await deleteDueAccounts({ db, storage }, at(DELETION_DELAY_MS))).toEqual({ deleted: [ana.id], failed: [] });
    const after = await allRows(db);
    for (const [name, rows] of Object.entries(after)) {
      expect(rows.filter((row) => holdsAny(row, anaValues)), `${name} still holds Ana`).toEqual([]);
      expect(rows.join("\n"), `${name} still names Ana's email`).not.toContain(ana.email);
    }
    for (const id of anas.mySessions) expect(await storage.getJson(waveformKey(ana.id, id))).toBeNull();

    // Everyone else's rows are exactly as they were, and so are their blobs.
    expect(untouched(after)).toEqual(untouched(before));
    expect(after.user.map((row) => JSON.parse(row).id)).toEqual(expect.arrayContaining([ben.id, cy.id]));
    expect(await storage.getJson(waveformKey(ben.id, anas.otherSession))).not.toBeNull();
    for (const id of [...cys.mySessions]) expect(await storage.getJson(waveformKey(cy.id, id))).not.toBeNull();
    expect(Object.keys(after)).toEqual(Object.keys(ALL_TABLES));
  });

  it("leaves an account whose deletion was cancelled", async () => {
    const [dee, eve] = [await person("dee"), await person("eve")];
    await seedEverything(db, storage, dee.id, dee.email, eve.id);
    await db.insert(accountDeletions).values({ userId: dee.id, requestedAt: T0 });
    await db.delete(accountDeletions).where(eq(accountDeletions.userId, dee.id));

    const run = await deleteDueAccounts({ db, storage }, at(10 * DELETION_DELAY_MS));
    expect(run.deleted).not.toContain(dee.id);
    expect(await db.select().from(user).where(eq(user.id, dee.id))).toHaveLength(1);
  });

  it("deletes nothing when the request was cancelled after the run picked the account", async () => {
    const [ida, jon] = [await person("ida"), await person("jon")];
    const seeded = await seedEverything(db, storage, ida.id, ida.email, jon.id);
    await db.insert(accountDeletions).values({ userId: ida.id, requestedAt: T0 });
    const before = await allRows(db);

    // The run has selected Ida; her cancel lands before it deletes anything.
    await db.delete(accountDeletions).where(eq(accountDeletions.userId, ida.id));
    expect(await deleteAccount({ db, storage }, ida.id, at(DELETION_DELAY_MS))).toBe(false);

    expect({ ...(await allRows(db)), account_deletions: [] }).toEqual({ ...before, account_deletions: [] });
    for (const id of seeded.mySessions) expect(await storage.getJson(waveformKey(ida.id, id))).not.toBeNull();
  });

  it("deletes nothing for a request that isn't due by the run's clock", async () => {
    const kim = await person("kim");
    await db.insert(accountDeletions).values({ userId: kim.id, requestedAt: T0 });
    expect(await deleteAccount({ db, storage }, kim.id, at(DELETION_DELAY_MS - 1))).toBe(false);
    expect(await pendingDeletions(db, [kim.id])).toEqual(new Set([kim.id]));
    expect(await db.select().from(user).where(eq(user.id, kim.id))).toHaveLength(1);
    await db.delete(accountDeletions).where(eq(accountDeletions.userId, kim.id));
  });

  it("carries on past an account that fails, and finishes it on a later run", async () => {
    const [fay, gus] = [await person("fay"), await person("gus")];
    await db.insert(accountDeletions).values([
      { userId: fay.id, requestedAt: T0 },
      { userId: gus.id, requestedAt: T0 },
    ]);
    const failing: StorageService = { ...storage, delete: (key) => (key.includes(`/${fay.id}/`) ? Promise.reject(new Error("bucket down")) : storage.delete(key)) };
    await seedEverything(db, storage, fay.id, fay.email, gus.id);

    const first = await deleteDueAccounts({ db, storage: failing }, at(DELETION_DELAY_MS));
    expect(first.failed.map((f) => f.userId)).toEqual([fay.id]);
    expect(first.deleted).toEqual([gus.id]);
    expect(await pendingDeletions(db, [fay.id, gus.id])).toEqual(new Set([fay.id]));

    expect((await deleteDueAccounts({ db, storage }, at(DELETION_DELAY_MS))).deleted).toEqual([fay.id]);
    expect(await db.select().from(user).where(eq(user.id, fay.id))).toHaveLength(0);
  });
});

describe("startDeletionJob", () => {
  it("runs at once and then on its interval, until stopped", async () => {
    const hal = await person("hal");
    await db.insert(accountDeletions).values({ userId: hal.id, requestedAt: T0 });
    const log = vi.fn();
    let clock = at(0);
    const stop = startDeletionJob({ db, storage }, { intervalMs: 20, now: () => clock, log });
    try {
      // The first run is too early.
      await new Promise((done) => setTimeout(done, 60));
      expect(await pendingDeletions(db, [hal.id])).toEqual(new Set([hal.id]));
      clock = at(DELETION_DELAY_MS);
      await vi.waitFor(async () => expect(await db.select().from(user).where(eq(user.id, hal.id))).toHaveLength(0));
      expect(log).toHaveBeenCalledWith("Deletion job: deleted 1 account(s).");
    } finally {
      stop();
    }
  });
});
