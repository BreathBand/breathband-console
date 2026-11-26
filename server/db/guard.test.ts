import { describe, expect, it, vi } from "vitest";
import { assertLocalDatabaseUrl, isLocalDatabaseUrl } from "./guard";

describe("test database guard", () => {
  it("refuses a Turso libsql:// URL", () => {
    expect(() => assertLocalDatabaseUrl("libsql://breathband-someone.turso.io")).toThrow(/remote database/);
  });

  it("refuses Turso's https:// and wss:// forms", () => {
    expect(isLocalDatabaseUrl("https://breathband-someone.turso.io")).toBe(false);
    expect(isLocalDatabaseUrl("wss://breathband-someone.turso.io")).toBe(false);
  });

  it("allows file databases, memory and a local sqld", () => {
    expect(isLocalDatabaseUrl("file:./data/breathband.db")).toBe(true);
    expect(isLocalDatabaseUrl(":memory:")).toBe(true);
    expect(isLocalDatabaseUrl("http://127.0.0.1:8080")).toBe(true);
    expect(() => assertLocalDatabaseUrl(undefined)).not.toThrow();
  });

  it("names the variable it refused", () => {
    expect(() => assertLocalDatabaseUrl("libsql://x.turso.io", "DB_URL")).toThrow(/DB_URL/);
  });
});

describe("vitest setup", () => {
  it("stops the run when TURSO_DATABASE_URL is a libsql:// URL", async () => {
    vi.stubEnv("TURSO_DATABASE_URL", "libsql://breathband-someone.turso.io");
    vi.resetModules();
    try {
      await expect(import("./test-setup")).rejects.toThrow(/remote database/);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
