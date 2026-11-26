import { describe, expect, it } from "vitest";
import { DEFAULT_DATABASE_URL } from "./db/env";
import { readEnv } from "./env";

describe("readEnv", () => {
  it("defaults to production on 8787 with the local file database", () => {
    expect(readEnv({})).toEqual({
      mode: "production",
      port: 8787,
      appUrl: "http://localhost:3000",
      databaseUrl: DEFAULT_DATABASE_URL,
      databaseAuthToken: undefined,
      storageDir: "./data/blobs",
      smtp: { host: undefined, port: undefined, from: undefined },
    });
  });

  it("reads the given values", () => {
    const env = readEnv({
      NODE_ENV: "development",
      API_PORT: "8790",
      APP_URL: "https://breathband.example",
      TURSO_DATABASE_URL: "file:./data/other.db",
      STORAGE_DIR: "/srv/blobs",
      SMTP_HOST: "localhost",
      SMTP_PORT: "1025",
      SMTP_FROM: "Breathband <no-reply@breathband.local>",
    });
    expect(env).toMatchObject({
      mode: "development",
      port: 8790,
      appUrl: "https://breathband.example",
      databaseUrl: "file:./data/other.db",
      storageDir: "/srv/blobs",
      smtp: { host: "localhost", port: 1025, from: "Breathband <no-reply@breathband.local>" },
    });
  });

  it("treats empty values as unset", () => {
    expect(readEnv({ NODE_ENV: "", API_PORT: "", APP_URL: "", SMTP_PORT: "" })).toMatchObject({
      mode: "production",
      port: 8787,
      appUrl: "http://localhost:3000",
      smtp: { port: undefined },
    });
  });

  it("listens on PORT in production when API_PORT is unset (Cloud Run)", () => {
    expect(readEnv({ PORT: "8080" }).port).toBe(8080);
    expect(readEnv({ NODE_ENV: "production", PORT: "9000", API_PORT: "" }).port).toBe(9000);
  });

  it("lets API_PORT win over PORT", () => {
    expect(readEnv({ NODE_ENV: "production", PORT: "8080", API_PORT: "8790" }).port).toBe(8790);
  });

  it("ignores PORT outside production, where it is Next's dev port", () => {
    expect(readEnv({ NODE_ENV: "development", PORT: "3000" }).port).toBe(8787);
    expect(readEnv({ NODE_ENV: "test", PORT: "3201" }).port).toBe(8787);
  });

  it.each([
    ["PORT", "http"],
    ["API_PORT", "http"],
    ["API_PORT", "70000"],
    ["APP_URL", "not a url"],
    ["NODE_ENV", "staging"],
    ["SMTP_PORT", "mail"],
  ])("refuses %s=%s, naming the variable", (name, value) => {
    expect(() => readEnv({ [name]: value })).toThrow(name);
  });
});
