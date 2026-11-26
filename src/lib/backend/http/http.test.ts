import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentConsents } from "@/lib/domain/consent";
import { backendKind, createBackend } from "../index";
import { createSeededDb, memoryStore } from "../local/db";
import { createLocalBackend } from "../local";
import type { SessionSummary, Waveform } from "@/lib/domain/types";
import { BackendError, type BackendErrorCode, type NewAssignment, type NewSession, type SignUpInput } from "../types";
import { LIVE_POLL_MS } from "./data";
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
      consents: currentConsents(),
      callbackURL: "/cloud/",
    });
  });

  it("sends the consents, which the API checks and stores (I-08)", async () => {
    const { fetch, calls } = fakeFetch(json({ token: null, user: apiUser }));
    await httpBackend(fetch).auth.signUp(signUpInput());
    expect(calls[0].body).toHaveProperty("consents", currentConsents());
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
  const session = { id: "s 1", athleteId: "a/1" } as SessionSummary;

  it("I-08: serves profile, sessions and waveforms under /api/v1, path parameters encoded", async () => {
    const { fetch, calls } = fakeFetch();
    const { data } = httpBackend(fetch);
    await data.getProfile("u-1");
    await data.updateProfile("u-1", { displayName: "Ana" });
    await data.listSessions("a/1", { limit: 5, before: "2026-11-18T00:00:00.000Z" });
    await data.getSession("a/1", "s 1");
    await data.getWaveform(session);
    await data.updateSessionNote("a/1", "s 1", "ok");
    await data.saveSession("a/1", {} as NewSession, {} as Waveform);
    await data.deleteSession("a/1", "s 1");
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      `GET ${API}/api/v1/users/u-1`,
      `PATCH ${API}/api/v1/users/u-1`,
      `GET ${API}/api/v1/athletes/a%2F1/sessions?limit=5&before=2026-11-18T00%3A00%3A00.000Z`,
      `GET ${API}/api/v1/athletes/a%2F1/sessions/s%201`,
      `GET ${API}/api/v1/athletes/a%2F1/sessions/s%201/waveform`,
      `PUT ${API}/api/v1/athletes/a%2F1/sessions/s%201/note`,
      `POST ${API}/api/v1/athletes/a%2F1/sessions`,
      `DELETE ${API}/api/v1/athletes/a%2F1/sessions/s%201`,
    ]);
    expect(calls.every((c) => c.init.credentials === "include")).toBe(true);
    expect(calls[1].body).toEqual({ displayName: "Ana" });
    expect(calls[5].body).toEqual({ note: "ok" });
    expect(calls[6].body).toEqual({ session: {}, waveform: {} });
  });

  it("I-08: answers null for a profile or session the API says isn't there", async () => {
    const notFound = () => json({ error: { code: "not-found", message: "Not found" } }, 404);
    const { fetch } = fakeFetch(notFound(), notFound(), notFound());
    const { data } = httpBackend(fetch);
    expect(await data.getProfile("u-1")).toBeNull();
    expect(await data.getSession("a-1", "s-1")).toBeNull();
    await expect(data.deleteSession("a-1", "s-1")).rejects.toMatchObject({ code: "not-found" });
  });

  it("I-08: a data route's 409 isn't 'email in use'", async () => {
    const { fetch } = fakeFetch(json({ message: "conflict" }, 409));
    await expect(httpBackend(fetch).data.getProfile("u-1")).rejects.toMatchObject({ code: "invalid-input" });
  });

  it("I-09: serves coaching under /api/v1: verbs, encoded path parameters and bodies", async () => {
    const { fetch, calls } = fakeFetch();
    const { data } = httpBackend(fetch);
    const targets = { score: 8, rateLow: 10, rateHigh: 14, sessionsPerWeek: 4 };
    const assignment = { athleteId: "a/1" } as NewAssignment;
    await data.listAthletes("c 1");
    await data.listCoaches("a/1");
    await data.getCoachLink("c 1", "a/1");
    await data.setCoachScope("a/1", "c 1", "scores");
    await data.createInvite("a/1", "curves");
    await data.redeemInvite("c 1", "ABCD2345");
    await data.revokeCoach("a/1", "c 1");
    await data.listAssignments("a/1");
    await data.createAssignment("c 1", assignment);
    await data.cancelAssignment("a/1", "x 1");
    await data.listComments("a/1", "s 1");
    await data.addComment("a/1", "s 1", { kind: "comment", text: "Nice" });
    await data.deleteComment("a/1", "s 1", "m 1");
    await data.listSeenSessions("c 1");
    await data.markSessionSeen("c 1", "a/1", "s 1");
    await data.saveCoachNote("c 1", "a/1", "private");
    await data.setTargets("c 1", "a/1", targets);
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      `GET ${API}/api/v1/coaches/c%201/athletes`,
      `GET ${API}/api/v1/athletes/a%2F1/coaches`,
      `GET ${API}/api/v1/coach-links/c%201/a%2F1`,
      `PATCH ${API}/api/v1/athletes/a%2F1/coaches/c%201/scope`,
      `POST ${API}/api/v1/athletes/a%2F1/invites`,
      `POST ${API}/api/v1/coaches/c%201/invites/redeem`,
      `DELETE ${API}/api/v1/athletes/a%2F1/coaches/c%201`,
      `GET ${API}/api/v1/athletes/a%2F1/assignments`,
      `POST ${API}/api/v1/coaches/c%201/assignments`,
      `POST ${API}/api/v1/athletes/a%2F1/assignments/x%201/cancel`,
      `GET ${API}/api/v1/athletes/a%2F1/comments?sessionId=s+1`,
      `POST ${API}/api/v1/athletes/a%2F1/sessions/s%201/comments`,
      `DELETE ${API}/api/v1/athletes/a%2F1/sessions/s%201/comments/m%201`,
      `GET ${API}/api/v1/coaches/c%201/seen`,
      `PUT ${API}/api/v1/coaches/c%201/seen/a%2F1/s%201`,
      `PUT ${API}/api/v1/coaches/c%201/athletes/a%2F1/note`,
      `PUT ${API}/api/v1/coaches/c%201/athletes/a%2F1/targets`,
    ]);
    expect(calls.map((c) => c.body)).toEqual([
      null, null, null, { scope: "scores" }, { scope: "curves" }, { code: "ABCD2345" }, {},
      null, assignment, {}, null, { kind: "comment", text: "Nice" }, {},
      null, {}, { text: "private" }, targets,
    ]);
  });

  it("I-09: reads a coach note out of its answer, and a missing link as null", async () => {
    const { fetch } = fakeFetch(json({ text: "private" }), json({ error: { code: "not-found", message: "Not found" } }, 404));
    const { data } = httpBackend(fetch);
    expect(await data.getCoachNote("c-1", "a-1")).toBe("private");
    expect(await data.getCoachLink("c-1", "a-1")).toBeNull();
  });

  it("I-10: serves mood check-ins, squads, alert rules, a coach's invites, group sessions and the waitlist: verbs, encoded path parameters and bodies", async () => {
    const { fetch, calls } = fakeFetch();
    const { data } = httpBackend(fetch);
    const rules = { missedDays: 3, scoreDrop: 2, belowTarget: 4, trendingDown: true, rateOutOfRange: true, practiceBehind: true };
    const group = { title: "Morning", athleteIds: ["a/1", "a 2"], pacerHalfCycleSec: 5 as const, durationSec: 300 };
    await data.saveMoodCheckins("a/1", "s 1", { before: 2, after: null });
    await data.listMoodCheckins("a/1", { limit: 5 });
    await data.listSquads("c 1");
    await data.saveSquad("c 1", { id: "q 1", name: "Sprint", athleteIds: ["a/1"] });
    await data.deleteSquad("c 1", "q 1");
    await data.getAlertRules("c 1");
    await data.saveAlertRules("c 1", rules);
    await data.createCoachInvite("c 1", { athleteName: "Jo", contact: "jo@example.com" });
    await data.listCoachInvites("c 1");
    await data.revokeCoachInvite("c 1", "ABCD/234");
    await data.getCoachInvite("ABCD/234");
    await data.respondToCoachInvite("a/1", "ABCD/234", { accept: true, scope: "scores" });
    await data.createGroupSession("c 1", group);
    await data.getGroupSession("g/1");
    await data.listGroupSessions("u 1");
    await data.startGroupSession("g/1");
    await data.setGroupPacer("g/1", 2);
    await data.addGroupMarker("g/1");
    await data.endGroupSession("g/1");
    await data.cancelGroupSession("g/1");
    await data.joinWaitlist({ email: "fan@example.test", source: "hero" });
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      `PUT ${API}/api/v1/athletes/a%2F1/sessions/s%201/mood`,
      `GET ${API}/api/v1/athletes/a%2F1/mood-checkins?limit=5`,
      `GET ${API}/api/v1/coaches/c%201/squads`,
      `PUT ${API}/api/v1/coaches/c%201/squads`,
      `DELETE ${API}/api/v1/coaches/c%201/squads/q%201`,
      `GET ${API}/api/v1/coaches/c%201/alert-rules`,
      `PUT ${API}/api/v1/coaches/c%201/alert-rules`,
      `POST ${API}/api/v1/coaches/c%201/coach-invites`,
      `GET ${API}/api/v1/coaches/c%201/coach-invites`,
      `POST ${API}/api/v1/coaches/c%201/coach-invites/ABCD%2F234/revoke`,
      `GET ${API}/api/v1/coach-invites/ABCD%2F234`,
      `POST ${API}/api/v1/athletes/a%2F1/coach-invites/ABCD%2F234/response`,
      `POST ${API}/api/v1/coaches/c%201/group-sessions`,
      `GET ${API}/api/v1/group-sessions/g%2F1`,
      `GET ${API}/api/v1/users/u%201/group-sessions`,
      `POST ${API}/api/v1/group-sessions/g%2F1/start`,
      `PUT ${API}/api/v1/group-sessions/g%2F1/pacer`,
      `POST ${API}/api/v1/group-sessions/g%2F1/markers`,
      `POST ${API}/api/v1/group-sessions/g%2F1/end`,
      `POST ${API}/api/v1/group-sessions/g%2F1/cancel`,
      `POST ${API}/api/v1/waitlist`,
    ]);
    expect(calls.map((c) => c.body)).toEqual([
      { before: 2, after: null }, null,
      null, { id: "q 1", name: "Sprint", athleteIds: ["a/1"] }, {}, null, rules,
      { athleteName: "Jo", contact: "jo@example.com" }, null, {}, null, { accept: true, scope: "scores" },
      group, null, null, {}, { pacerHalfCycleSec: 2 }, {}, {}, {},
      { email: "fan@example.test", source: "hero" },
    ]);
  });

  it("I-10: answers null for a coach's invite or group session the API says isn't there", async () => {
    const notFound = () => json({ error: { code: "not-found", message: "Not found" } }, 404);
    const { fetch } = fakeFetch(notFound(), notFound());
    const { data } = httpBackend(fetch);
    expect(await data.getCoachInvite("ZZZZ2222")).toBeNull();
    expect(await data.getGroupSession("g-1")).toBeNull();
  });

  it("I-10: serves every DataService method: none answers 'unavailable' without asking the API", async () => {
    const { fetch } = fakeFetch(...Object.keys(HTTP_ROUTES.data).map(() => json({})));
    const { data } = httpBackend(fetch);
    for (const method of Object.keys(HTTP_ROUTES.data) as (keyof typeof data)[]) {
      if (method === "watchGroupLive") continue;
      const args = method === "getWaveform" ? [{ athleteId: "a", id: "s" }] : ["x", "y", {}];
      await (data[method] as (...args: unknown[]) => Promise<unknown>)(...args);
    }
    expect(fetch).toHaveBeenCalledTimes(Object.keys(HTTP_ROUTES.data).length - 1);
  });

  describe("I-10: watchGroupLive until a realtime channel arrives", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const live = (status: string, presence: Record<string, string>) => json({ status, presence });

    it("polls the live route for presence, reports it when it changes, and stops when asked", async () => {
      const { fetch, calls } = fakeFetch(
        live("lobby", { a: "invited" }),
        live("lobby", { a: "invited" }),
        live("live", { a: "joined" }),
        live("live", { a: "joined" }),
      );
      const presence: unknown[] = [];
      const frames: unknown[] = [];
      const stop = httpBackend(fetch).data.watchGroupLive("g/1", { onPresence: (p) => presence.push(p), onFrame: (f) => frames.push(f) });
      await vi.advanceTimersByTimeAsync(3 * LIVE_POLL_MS);
      expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual(Array(4).fill(`GET ${API}/api/v1/group-sessions/g%2F1/live`));
      expect(presence).toEqual([{ a: "invited" }, { a: "joined" }]);
      expect(frames).toEqual([]);
      stop();
      await vi.advanceTimersByTimeAsync(5 * LIVE_POLL_MS);
      expect(calls).toHaveLength(4);
    });

    it("stops once the session is over, or the API refuses, and tries again after a lost connection", async () => {
      const over = fakeFetch(live("ended", { a: "left" }));
      httpBackend(over.fetch).data.watchGroupLive("g-1", { onPresence() {}, onFrame() {} });
      const refused = fakeFetch(json({ error: { code: "permission-denied", message: "no" } }, 403));
      httpBackend(refused.fetch).data.watchGroupLive("g-1", { onPresence() {}, onFrame() {} });
      const lost = fakeFetch(new TypeError("offline"), live("live", { a: "joined" }));
      const presence: unknown[] = [];
      const stop = httpBackend(lost.fetch).data.watchGroupLive("g-1", { onPresence: (p) => presence.push(p), onFrame() {} });
      await vi.advanceTimersByTimeAsync(3 * LIVE_POLL_MS);
      stop();
      expect(over.calls).toHaveLength(1);
      expect(refused.calls).toHaveLength(1);
      expect(presence).toEqual([{ a: "joined" }]);
    });
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
