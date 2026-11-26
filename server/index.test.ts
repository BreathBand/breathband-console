import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HTTPException } from "hono/http-exception";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createDb } from "./db/client";
import { assertLocalDatabaseUrl } from "./db/guard";
import { createApp, SECURITY_HEADERS, type AppDeps } from "./index";

const dir = mkdtempSync(join(tmpdir(), "breathband-api-"));
const fileUrl = (name: string) => `file:${join(dir, name).replaceAll("\\", "/")}`;

const good = createDb(fileUrl("health.db"));
// Nothing listens on port 1. A local URL, so the test guard allows it; never a remote one.
const brokenUrl = "http://127.0.0.1:1";
assertLocalDatabaseUrl(brokenUrl, "the API test's broken database");
const broken = createDb(brokenUrl);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  good.client.close();
  broken.client.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // On Windows libSQL keeps the file open until the process exits; the OS temp folder gets it.
  }
});

function app(overrides: Partial<AppDeps> = {}) {
  return createApp({ db: good.db, mode: "test", appUrl: "http://localhost:3000", ...overrides });
}

function expectSecurityHeaders(response: Response) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    expect(response.headers.get(name), name).toBe(value);
  }
}

describe("GET /api/health", () => {
  it("reports the database up when select 1 works", async () => {
    assertLocalDatabaseUrl(fileUrl("health.db"), "the API test's database");
    const response = await app().request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, db: "up" });
    expectSecurityHeaders(response);
  });

  it("reports the database down, still with 200, when select 1 fails", async () => {
    const response = await app({ db: broken.db }).request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: false, db: "down" });
  });
});

describe("unknown routes", () => {
  it("answers JSON 404 with the security headers for an unknown /api route", async () => {
    const response = await app().request("/api/nope");
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toMatch(/^application\/json/);
    expect(await response.json()).toEqual({ error: { code: "not-found", message: "Not found" } });
    expectSecurityHeaders(response);
  });

  it("answers JSON 404 outside /api when no static export is served", async () => {
    const response = await app().request("/cloud/login/");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "not-found" } });
  });
});

describe("errors", () => {
  function failing(mode: AppDeps["mode"]) {
    const instance = app({ mode });
    instance.get("/api/boom", () => {
      throw new Error("secret detail");
    });
    instance.get("/api/forbidden", () => {
      throw new HTTPException(403, { message: "Not yours" });
    });
    return instance;
  }

  it("hides the message and stack in production", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await failing("production").request("/api/boom");
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: { code: "internal", message: "Internal server error" } });
    expect(text).not.toContain("secret detail");
    expect(text).not.toContain("index.test.ts");
    expectSecurityHeaders(response);
  });

  it("includes the message and stack in development", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await failing("development").request("/api/boom");
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { message: string; stack: string } };
    expect(body.error.message).toBe("secret detail");
    expect(body.error.stack).toContain("secret detail");
  });

  it("keeps the status and message of an HTTPException", async () => {
    const response = await failing("production").request("/api/forbidden");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: "permission-denied", message: "Not yours" } });
    expectSecurityHeaders(response);
  });
});

describe("CORS", () => {
  const preflight = {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  };

  it("allows the web app's origin with credentials in development", async () => {
    const response = await app({ mode: "development" }).request("/api/health", preflight);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");

    const get = await app({ mode: "development" }).request("/api/health", {
      headers: { Origin: "http://localhost:3000" },
    });
    expect(get.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    expect(get.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("does not allow another origin in development", async () => {
    const response = await app({ mode: "development" }).request("/api/health", {
      headers: { Origin: "https://evil.example" },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it.each(["production", "test"] as const)("sends no CORS headers in %s", async (mode) => {
    const instance = app({ mode });
    const options = await instance.request("/api/health", preflight);
    expect(options.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const get = await instance.request("/api/health", { headers: { Origin: "http://localhost:3000" } });
    expect(get.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(get.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });
});
