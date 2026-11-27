import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS as SERVER_SECURITY_HEADERS } from "../../server/index";
import { IMMUTABLE as SERVER_IMMUTABLE } from "../../server/static";
import {
  CONTAINER_ENV,
  HEALTH,
  IMMUTABLE,
  PAGES,
  ROUTES,
  SECURITY_HEADERS,
  SMOKE,
  baseUrl,
  buildArgs,
  checkResponse,
  checkScripts,
  checkSecurityHeaders,
  checkStaticCaching,
  containerName,
  describeError,
  execArgs,
  run,
  runArgs,
  scriptPaths,
  smokeSecretEnv,
  waitUntilReady,
} from "../../scripts/docker-smoke-lib.mjs";

const login = PAGES.find((route) => route.path === "/cloud/login/")!;
const home = PAGES.find((route) => route.path === "/")!;

const loginHtml =
  '<!DOCTYPE html><html><head><title>BreathCloud · Breathband</title></head><body>' +
  '<script src="/_next/static/chunks/a1.js" async=""></script>' +
  '<script>self.__next_f.push([1,"\\"/_next/static/chunks/b2.js\\""])</script>' +
  '<script src="/_next/static/chunks/a1.js"></script></body></html>';

describe("docker smoke config", () => {
  it("builds the production image with the http backend and maps port 8080", () => {
    expect(buildArgs("/repo")).toEqual([
      "build",
      "--build-arg",
      "NEXT_PUBLIC_BACKEND=http",
      "-t",
      "breathband-console:smoke",
      "/repo",
    ]);
    expect(runArgs("smoke-1")).toEqual([
      "run",
      "-d",
      "--name",
      "smoke-1",
      "-p",
      "8080:8080",
      "-e",
      "APP_URL=http://localhost:8080",
      "-e",
      "SMTP_HOST=127.0.0.1",
      "-e",
      "SMTP_PORT=1025",
      "-e",
      "AUTH_SECRET",
      "breathband-console:smoke",
    ]);
    expect(baseUrl()).toBe("http://localhost:8080");
    expect(SMOKE.port).toBe(8080);
  });

  it("names each container uniquely with the smoke prefix", () => {
    expect(containerName(42, 1000)).toBe("breathband-smoke-42-1000");
  });

  it("checks the API's health, that the root sends people to BreathCloud, and the console sign-in page", () => {
    expect(ROUTES.map((route) => route.path)).toEqual(["/api/health", "/", "/cloud/login/"]);
    expect(HEALTH.json).toEqual({ ok: true, db: "up" });
    expect(login.scripts).toContain("Sign in to BreathCloud");
  });

  it("runs the migrations inside the container", () => {
    expect(execArgs("smoke-1")).toEqual(["exec", "smoke-1", "node", "build/server/migrate.mjs"]);
  });

  it("passes AUTH_SECRET through the docker CLI's environment, never on the command line", () => {
    const env = smokeSecretEnv({ PATH: "/bin" }, Buffer.alloc(32, 7));
    expect(env).toEqual({ PATH: "/bin", AUTH_SECRET: Buffer.alloc(32, 7).toString("base64") });
    expect(env.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(smokeSecretEnv({}).AUTH_SECRET).not.toBe(smokeSecretEnv({}).AUTH_SECRET);
    expect(runArgs("smoke-1").join(" ")).not.toContain(env.AUTH_SECRET);
    expect(Object.keys(CONTAINER_ENV)).not.toContain("AUTH_SECRET");
  });

  it("expects the headers and caching the API actually sends", () => {
    expect(SECURITY_HEADERS).toEqual(
      Object.fromEntries(Object.entries(SERVER_SECURITY_HEADERS).map(([name, value]) => [name.toLowerCase(), value])),
    );
    expect(IMMUTABLE).toBe(SERVER_IMMUTABLE);
  });
});

describe("health check", () => {
  const ok = { status: 200, contentType: "application/json", body: '{"ok":true,"db":"up"}' };

  it("passes when the database is up", () => {
    expect(checkResponse(ok, HEALTH)).toBeNull();
    expect(checkResponse({ ...ok, contentType: "application/json; charset=UTF-8" }, HEALTH)).toBeNull();
  });

  it("fails when the database is down, the body isn't JSON or the status is wrong", () => {
    expect(checkResponse({ ...ok, body: '{"ok":false,"db":"down"}' }, HEALTH)).toBe(
      '/api/health: expected {"ok":true,"db":"up"}, got {"ok":false,"db":"down"}',
    );
    expect(checkResponse({ ...ok, body: "<html>" }, HEALTH)).toMatch(/^\/api\/health: body isn't JSON/);
    expect(checkResponse({ ...ok, contentType: "text/html" }, HEALTH)).toMatch(/expected a JSON content-type/);
    expect(checkResponse({ ...ok, status: 503 }, HEALTH)).toBe("/api/health: expected status 200, got 503");
  });
});

describe("headers", () => {
  const secure = new Headers({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
  });

  it("passes a response with every security header", () => {
    expect(checkSecurityHeaders(secure, "/")).toBeNull();
  });

  it("names each missing or wrong header", () => {
    const headers = new Headers(secure);
    headers.delete("x-frame-options");
    headers.set("referrer-policy", "no-referrer");
    expect(checkSecurityHeaders(headers, "/")).toBe(
      '/: referrer-policy should be "strict-origin-when-cross-origin", got "no-referrer"; ' +
        'x-frame-options should be "DENY", got null',
    );
  });

  it("wants hashed static files cached for good", () => {
    expect(checkStaticCaching(new Headers({ "Cache-Control": IMMUTABLE }), "/_next/static/a.js")).toBeNull();
    expect(checkStaticCaching(new Headers(), "/_next/static/a.js")).toBe(
      '/_next/static/a.js: expected Cache-Control "public, max-age=31536000, immutable", got null',
    );
  });
});

describe("checkResponse", () => {
  const ok = {
    status: 200,
    contentType: "text/html",
    body: '<head><meta http-equiv="refresh" content="0; url=/cloud/"/></head>',
  };

  it("passes a 200 HTML page with the expected text", () => {
    expect(checkResponse(ok, home)).toBeNull();
    expect(checkResponse({ ...ok, contentType: "text/html; charset=utf-8" }, home)).toBeNull();
  });

  it("names the path and status when the status isn't 200", () => {
    expect(checkResponse({ ...ok, status: 404 }, login)).toBe("/cloud/login/: expected status 200, got 404");
    expect(checkResponse({ ...ok, status: 301 }, home)).toMatch(/^\/: .*got 301/);
  });

  it("rejects a page that isn't HTML", () => {
    expect(checkResponse({ ...ok, contentType: "application/octet-stream" }, home)).toMatch(
      /^\/: expected an HTML content-type, got "application\/octet-stream"/,
    );
    expect(checkResponse({ ...ok, contentType: null }, home)).toMatch(/got "none"/);
  });

  it("lists the expected text that is missing", () => {
    expect(checkResponse({ ...ok, body: "<html></html>" }, login)).toBe(
      '/cloud/login/: HTML is missing "<title>BreathCloud"',
    );
  });
});

describe("page scripts", () => {
  it("finds each Next.js script once, including ones in the RSC payload", () => {
    expect(scriptPaths(loginHtml)).toEqual(["/_next/static/chunks/a1.js", "/_next/static/chunks/b2.js"]);
    expect(scriptPaths("<html></html>")).toEqual([]);
  });

  it("passes when any script carries the expected text", () => {
    expect(checkScripts(["var a=1", 'children:"Sign in to BreathCloud"'], login)).toBeNull();
    expect(checkScripts([], home)).toBeNull();
  });

  it("fails when no script carries the expected text", () => {
    expect(checkScripts(["var a=1"], login)).toBe(
      '/cloud/login/: none of the page\'s 1 scripts contain "Sign in to BreathCloud"',
    );
  });
});

describe("waitUntilReady", () => {
  it("retries until the server answers", async () => {
    let calls = 0;
    const response = new Response("ok");
    const fetchImpl = (async () => {
      calls += 1;
      if (calls < 3) throw new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED") });
      return response;
    }) as unknown as typeof fetch;
    await expect(waitUntilReady("http://localhost:8080/", { timeoutMs: 1000, intervalMs: 1, fetchImpl })).resolves.toBe(
      response,
    );
    expect(calls).toBe(3);
  });

  it("names the URL and the last error when it times out", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED 127.0.0.1:8080") });
    }) as unknown as typeof fetch;
    await expect(waitUntilReady("http://localhost:8080/", { timeoutMs: 20, intervalMs: 5, fetchImpl })).rejects.toThrow(
      "http://localhost:8080/ was not ready after 20 ms (last error: fetch failed: connect ECONNREFUSED 127.0.0.1:8080)",
    );
  });
});

describe("describeError", () => {
  it("includes the cause and handles non-errors", () => {
    expect(describeError(new Error("outer", { cause: new Error("inner") }))).toBe("outer: inner");
    expect(describeError("plain")).toBe("plain");
  });
});

describe("run", () => {
  it("captures output and the exit code", async () => {
    const result = await run(process.execPath, ["-e", "process.stdout.write('hi'); process.stderr.write('oops'); process.exit(3)"]);
    expect(result).toEqual({ code: 3, stdout: "hi", stderr: "oops" });
  });

  it("explains a missing CLI", async () => {
    await expect(run("breathband-no-such-cli", ["info"])).rejects.toThrow("breathband-no-such-cli CLI not found on PATH");
  });
});
