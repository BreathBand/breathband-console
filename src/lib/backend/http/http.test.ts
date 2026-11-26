import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentConsents } from "@/lib/domain/consent";
import { backendKind, createBackend } from "../index";
import { createSeededDb, memoryStore } from "../local/db";
import { createLocalBackend } from "../local";
import { BackendError, type BackendErrorCode, type SignUpInput } from "../types";
import { createHttpBackend, HTTP_METHODS, HTTP_ROUTES, toBackendError } from "./index";

const NOW = new Date("2026-11-18T12:00:00.000Z");
const API = "http://api.test";
const APP = "http://app.test";

const methodNames = (service: object) =>
  Object.entries(service)
    .filter(([, value]) => typeof value === "function")
    .map(([name]) => name)
    .sort();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** A fetch that answers each request with the next queued response, and records what was asked. */
function fakeFetch(...answers: (Response | Error | Promise<Response>)[]) {
  const calls: { url: string; init: RequestInit; body: Record<string, unknown> | null }[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init, body: init.body ? JSON.parse(String(init.body)) : null });
    const answer = answers.shift() ?? json(null);
    if (answer instanceof Error) throw answer;
    return answer;
  });
  return { fetch, calls };
}

const httpBackend = (fetch: ReturnType<typeof fakeFetch>["fetch"]) =>
  createHttpBackend({ baseUrl: API, appUrl: APP, fetch, now: () => NOW });

const apiUser = { id: "u-1", email: "ana@example.test", emailVerified: true, name: "Ana" };

const signUpInput = (changes: Partial<SignUpInput> = {}): SignUpInput => ({
  email: "ana@example.test",
  password: "correct horse battery",
  displayName: "Ana",
  role: "athlete",
  consents: currentConsents(),
  birthYear: 1990,
  ...changes,
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createHttpBackend", () => {
  it("is the http kind and makes no request until auth state is asked for", () => {
    const { fetch } = fakeFetch();
    expect(httpBackend(fetch).kind).toBe("http");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends every request to NEXT_PUBLIC_API_BASE_URL with the browser's cookies", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", `${API}/`);
    const { fetch, calls } = fakeFetch(json({ user: apiUser }));
    await createHttpBackend({ fetch }).auth.signIn("ana@example.test", "correct horse battery");
    expect(calls[0].url).toBe(`${API}/api/auth/sign-in/email`);
    expect(calls[0].init).toMatchObject({ method: "POST", credentials: "include" });
    expect(new Headers(calls[0].init.headers).get("Content-Type")).toBe("application/json");
  });

  it("calls the page's own origin when no base URL is set", async () => {
    const { fetch, calls } = fakeFetch(json(null));
    await new Promise<void>((done) => createHttpBackend({ baseUrl: "", fetch }).auth.onAuthStateChanged(() => done()));
    expect(calls[0].url).toBe("/api/auth/get-session");
    expect(calls[0].init).toMatchObject({ method: "GET", credentials: "include" });
  });
});

describe("http AuthService", () => {
  it("waits for the session read before the first onAuthStateChanged call", async () => {
    let answer!: (response: Response) => void;
    const { fetch } = fakeFetch(new Promise<Response>((resolve) => (answer = resolve)));
    const seen: unknown[] = [];
    httpBackend(fetch).auth.onAuthStateChanged((user) => seen.push(user));
    await Promise.resolve();
    expect(seen).toEqual([]);
    answer(json({ user: apiUser, session: {} }));
    await vi.waitFor(() => expect(seen).toEqual([{ uid: "u-1", email: "ana@example.test", emailVerified: true }]));
  });

  it("reads the session once, however many listeners and currentUser() calls", async () => {
    const { fetch } = fakeFetch(json({ user: apiUser, session: {} }));
    const { auth } = httpBackend(fetch);
    expect(auth.currentUser()).toBeNull();
    await new Promise<void>((done) => auth.onAuthStateChanged(() => done()));
    await new Promise<void>((done) => auth.onAuthStateChanged(() => done()));
    expect(auth.currentUser()).toMatchObject({ uid: "u-1" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("counts as signed out when the session can't be read", async () => {
    const { fetch } = fakeFetch(new TypeError("fetch failed"));
    const user = await new Promise((done) => httpBackend(fetch).auth.onAuthStateChanged(done));
    expect(user).toBeNull();
  });

  it("sends callbackURL /cloud/ on sign-up, so the emailed link lands on the console", async () => {
    const { fetch, calls } = fakeFetch(json({ token: null, user: { ...apiUser, emailVerified: false } }));
    const user = await httpBackend(fetch).auth.signUp(signUpInput({ email: " Ana@Example.TEST ", displayName: " Ana " }));
    expect(user).toEqual({ uid: "u-1", email: "ana@example.test", emailVerified: false });
    expect(calls[0].url).toBe(`${API}/api/auth/sign-up/email`);
    expect(calls[0].body).toEqual({
      name: "Ana",
      email: "ana@example.test",
      password: "correct horse battery",
      role: "athlete",
      birthYear: 1990,
      callbackURL: "/cloud/",
    });
  });

  it("I-08: checks the consents but doesn't send them: the API has no route that stores them yet", async () => {
    const { fetch, calls } = fakeFetch(json({ token: null, user: apiUser }));
    await httpBackend(fetch).auth.signUp(signUpInput());
    expect(calls[0].body).not.toHaveProperty("consents");
  });

  it.each<[string, Partial<SignUpInput>, BackendErrorCode]>([
    ["under 16", { birthYear: NOW.getUTCFullYear() - 15 }, "under-age"],
    ["a missing consent", { consents: currentConsents(["terms", "privacy"]) }, "invalid-input"],
  ])("refuses %s without asking the API", async (_, changes, code) => {
    const { fetch } = fakeFetch();
    await expect(httpBackend(fetch).auth.signUp(signUpInput(changes))).rejects.toMatchObject({ code });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends redirectTo on the app's /cloud/reset/ with a reset request", async () => {
    const { fetch, calls } = fakeFetch(json({ status: true }));
    await httpBackend(fetch).auth.sendPasswordReset(" Ana@Example.test");
    expect(calls[0].url).toBe(`${API}/api/auth/request-password-reset`);
    expect(calls[0].body).toEqual({ email: "ana@example.test", redirectTo: `${APP}/cloud/reset/` });
  });

  it("signs out locally even when the API can't be reached, and reports it", async () => {
    const { fetch } = fakeFetch(json({ user: apiUser }), new TypeError("fetch failed"));
    const { auth } = httpBackend(fetch);
    await auth.signIn("ana@example.test", "correct horse battery");
    await expect(auth.signOut()).rejects.toMatchObject({ code: "unavailable" });
    expect(auth.currentUser()).toBeNull();
  });

  it("turns a network failure into BackendError('unavailable')", async () => {
    const { fetch } = fakeFetch(new TypeError("fetch failed"));
    const error = await httpBackend(fetch).auth.signIn("ana@example.test", "x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BackendError);
    expect(error).toMatchObject({ code: "unavailable" });
  });
});

describe("toBackendError", () => {
  it.each<[number, unknown, BackendErrorCode]>([
    // Better Auth's own bodies: { code, message }
    [401, { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }, "invalid-credentials"],
    [403, { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" }, "permission-denied"],
    [422, { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", message: "User already exists." }, "email-in-use"],
    [400, { code: "INVALID_EMAIL", message: "Invalid email" }, "invalid-email"],
    [400, { code: "PASSWORD_TOO_SHORT", message: "Password too short" }, "weak-password"],
    [400, { code: "PASSWORD_TOO_LONG", message: "Password too long" }, "invalid-input"],
    [400, { code: "VALIDATION_ERROR", message: "Validation Error" }, "invalid-input"],
    [400, { code: "INVALID_TOKEN", message: "Invalid token" }, "invalid-input"],
    [403, { code: "INVALID_REDIRECT_URL", message: "Invalid redirectURL" }, "permission-denied"],
    [429, { message: "Too many requests. Please try again later." }, "unavailable"],
    // The API's own bodies: { error: { code, message } }, already in the adapter's codes
    [403, { error: { code: "permission-denied", message: "Not yours" } }, "permission-denied"],
    [404, { error: { code: "not-found", message: "Not found" } }, "not-found"],
    [500, { error: { code: "internal", message: "Internal server error" } }, "unavailable"],
    // No body to go on: the status decides
    [401, null, "not-signed-in"],
    [409, null, "email-in-use"],
    [502, null, "unavailable"],
  ])("maps %i %j to %s", (status, body, code) => {
    const error = toBackendError(status, body);
    expect(error).toBeInstanceOf(BackendError);
    expect(error.code).toBe(code);
  });

  it("tells an unconfirmed person what to do", () => {
    expect(toBackendError(403, { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" }).message).toMatch(
      /confirm your email/i,
    );
  });
});

describe("http DataService", () => {
  it("I-08: every method fails with BackendError('unavailable') until the API serves data", async () => {
    const { fetch } = fakeFetch();
    const { data } = httpBackend(fetch);
    for (const method of Object.keys(HTTP_ROUTES.data) as (keyof typeof data)[]) {
      let error: unknown;
      try {
        await (data[method] as () => unknown)();
      } catch (e) {
        error = e;
      }
      expect(error, method).toBeInstanceOf(BackendError);
      expect(error, method).toMatchObject({ code: "unavailable", message: expect.stringContaining("I-08") });
    }
    expect(fetch).not.toHaveBeenCalled();
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

  it("uses an HTTP verb for every route, Better Auth's /api/auth/ paths for auth and /v1/ proposals for data", () => {
    for (const route of Object.values(HTTP_ROUTES.auth)) {
      expect(HTTP_METHODS).toContain(route.method);
      expect(route.path).toMatch(/^\/api\/auth\//);
    }
    for (const route of Object.values(HTTP_ROUTES.data)) {
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
  it("returns the http adapter without calling fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(createBackend("http").kind).toBe("http");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is what an NEXT_PUBLIC_BACKEND=http build creates", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_BACKEND", "http");
    expect(createBackend().kind).toBe("http");
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
