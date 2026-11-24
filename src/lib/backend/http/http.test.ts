import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { backendKind, createBackend } from "../index";
import { createSeededDb, memoryStore } from "../local/db";
import { createLocalBackend } from "../local";
import { createHttpBackend, HTTP_METHODS, HTTP_ROUTES } from "./index";

const NOW = new Date("2026-11-18T12:00:00.000Z");

const methodNames = (service: object) =>
  Object.entries(service)
    .filter(([, value]) => typeof value === "function")
    .map(([name]) => name)
    .sort();

const stubError = () => {
  try {
    createHttpBackend();
  } catch (error) {
    return error;
  }
  throw new Error("createHttpBackend() returned instead of throwing");
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createHttpBackend", () => {
  it("throws an Error naming the setting and the stub's file", () => {
    const error = stubError();
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("NEXT_PUBLIC_BACKEND=http");
    expect((error as Error).message).toContain("src/lib/backend/http/index.ts");
  });
});

describe("HTTP_ROUTES", () => {
  const local = createLocalBackend({ store: memoryStore(createSeededDb(NOW)), latencyMs: 0, now: () => NOW });

  it("has one route per AuthService method", () => {
    expect(Object.keys(HTTP_ROUTES.auth).sort()).toEqual(methodNames(local.auth));
  });

  it("has one route per DataService method", () => {
    expect(Object.keys(HTTP_ROUTES.data).sort()).toEqual(methodNames(local.data));
  });

  it("uses an HTTP verb and a /v1/ path for every route", () => {
    const routes = [...Object.values(HTTP_ROUTES.auth), ...Object.values(HTTP_ROUTES.data)];
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(HTTP_METHODS).toContain(route.method);
      expect(route.path).toMatch(/^\/v1\//);
    }
  });

  it("matches the route table in the README", () => {
    const readme = readFileSync(path.resolve(process.cwd(), "src/lib/backend/http/README.md"), "utf8");
    for (const [name, route] of [...Object.entries(HTTP_ROUTES.auth), ...Object.entries(HTTP_ROUTES.data)]) {
      expect(readme).toContain(`| \`${name}\` | \`${route.method}\` | \`${route.path}\` |`);
    }
  });
});

describe("backendKind", () => {
  it("returns http for NEXT_PUBLIC_BACKEND=http", () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND", "http");
    expect(backendKind()).toBe("http");
  });

  it("returns firebase for NEXT_PUBLIC_BACKEND=firebase", () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND", "firebase");
    expect(backendKind()).toBe("firebase");
  });

  it.each(["local", "", "other"])("returns local for NEXT_PUBLIC_BACKEND=%j", (value) => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND", value);
    expect(backendKind()).toBe("local");
  });
});

describe("createBackend('http')", () => {
  it("throws the stub's error without calling fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(() => createBackend("http")).toThrow((stubError() as Error).message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is what an NEXT_PUBLIC_BACKEND=http build creates", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_BACKEND", "http");
    expect(() => createBackend()).toThrow("NEXT_PUBLIC_BACKEND=http");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe(".env.example", () => {
  const env = readFileSync(path.resolve(process.cwd(), ".env.example"), "utf8");

  it("lists http as an allowed NEXT_PUBLIC_BACKEND value", () => {
    expect(env).toMatch(/^#\s*local \| firebase \| http\s*$/m);
  });

  it("has a commented placeholder for the API base URL", () => {
    expect(env).toMatch(/^#\s*NEXT_PUBLIC_API_BASE_URL=/m);
  });
});
