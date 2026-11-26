import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../db/client";
import { MIGRATIONS_DIR } from "../db/env";
import { assertLocalDatabaseUrl } from "../db/guard";
import { invites, user } from "../db/schema";
import { codeFrom, hashCode, inviteCode, isUniqueViolation, normaliseCode, withFreshCode } from "./codes";

const dir = mkdtempSync(join(tmpdir(), "breathband-codes-"));
const url = `file:${join(dir, "codes.db").replaceAll("\\", "/")}`;
let handle: ReturnType<typeof createDb>;

beforeAll(async () => {
  assertLocalDatabaseUrl(url, "the invite codes test's database");
  handle = createDb(url);
  await migrate(handle.db, { migrationsFolder: resolve(MIGRATIONS_DIR) });
  await handle.db.insert(user).values({ id: "ana", name: "Ana", email: "ana@example.test" });
});

afterAll(() => {
  handle?.client.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // On Windows libSQL keeps the file open until the process exits; the OS temp folder gets it.
  }
});

const invite = (code: string) =>
  handle.db.insert(invites).values({ codeHash: hashCode(code), athleteId: "ana", scope: "curves", expiresAt: new Date(Date.now() + 60_000) });

describe("invite codes", () => {
  it("are 8 characters without look-alikes, read the same with spaces or in lower case", () => {
    expect(inviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(codeFrom(new Uint8Array([0, 1, 31, 32, 255, 8, 14, 24]))).toBe("AB9A9JQ2");
    expect(normaliseCode(" abcd2345 ")).toBe("ABCD2345");
  });

  it("recognise a primary-key collision from libSQL through drizzle's wrapper, and nothing else", async () => {
    await invite("SAMECODE");
    const collision = await invite("SAMECODE").then(() => null, (e: unknown) => e);
    expect(isUniqueViolation(collision)).toBe(true);
    const missingUser = await handle.db
      .insert(invites)
      .values({ codeHash: hashCode("OTHER234"), athleteId: "nobody", scope: "curves", expiresAt: new Date() })
      .then(() => null, (e: unknown) => e);
    expect(missingUser).toBeInstanceOf(Error);
    expect(isUniqueViolation(missingUser)).toBe(false);
  });

  it("try again with a fresh code after a collision", async () => {
    await invite("TAKEN234");
    const tried: string[] = [];
    const code = await withFreshCode(async (attempt) => {
      const fresh = attempt === 0 ? "TAKEN234" : "FRESH234";
      tried.push(fresh);
      await invite(fresh);
      return fresh;
    });
    expect(code).toBe("FRESH234");
    expect(tried).toEqual(["TAKEN234", "FRESH234"]);
  });

  it("give up after the last try, and at once on any other error", async () => {
    let calls = 0;
    const collide = () => {
      calls++;
      return invite("TAKEN234");
    };
    await expect(withFreshCode(collide, 3)).rejects.toSatisfy(isUniqueViolation);
    expect(calls).toBe(3);

    calls = 0;
    await expect(
      withFreshCode(async () => {
        calls++;
        throw new Error("disk full");
      }),
    ).rejects.toThrow("disk full");
    expect(calls).toBe(1);
  });
});
