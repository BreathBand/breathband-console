import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

export const SMOKE = {
  image: "breathband-console:smoke",
  containerPrefix: "breathband-smoke",
  port: 8080,
  backend: "http",
  readyTimeoutMs: 30_000,
  readyIntervalMs: 500,
  requestTimeoutMs: 5_000,
};

/** The container's settings. AUTH_SECRET is not here: see smokeSecretEnv(). */
export const CONTAINER_ENV = {
  APP_URL: `http://localhost:${SMOKE.port}`,
  // Production refuses to start without SMTP. Nothing listens here, and the
  // smoke test sends no email.
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1025",
};

/** The migration runner inside the image (scripts/build-server.mjs). */
export const MIGRATE = ["node", "build/server/migrate.mjs"];

/** server/index.ts's SECURITY_HEADERS: on every response, static or API. */
export const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
};

/** server/static.ts's IMMUTABLE: hashed files under /_next/static/. */
export const IMMUTABLE = "public, max-age=31536000, immutable";

export const HEALTH = { path: "/api/health", json: { ok: true, db: "up" } };

export const PAGES = [
  { path: "/", html: ['<meta http-equiv="refresh" content="0; url=/cloud/"/>'], scripts: [] },
  { path: "/cloud/login/", html: ["<title>BreathCloud"], scripts: ["Sign in to BreathCloud"] },
  // The help and legal pages (T-0151) are readable signed out, with their text in the exported HTML.
  { path: "/cloud/help/", html: ["<title>Help · BreathCloud", "Guide for professionals"], scripts: [] },
  { path: "/cloud/privacy/", html: ["<title>Privacy policy · BreathCloud", "Draft: pending legal review"], scripts: [] },
  { path: "/cloud/terms/", html: ["<title>Terms of use · BreathCloud", "Draft: pending legal review"], scripts: [] },
  {
    path: "/cloud/accessibility/",
    html: ["<title>Accessibility statement · BreathCloud", "Draft: pending legal review"],
    scripts: [],
  },
];

export const ROUTES = [HEALTH, ...PAGES];

export function baseUrl(port = SMOKE.port) {
  return `http://localhost:${port}`;
}

export function containerName(pid = process.pid, now = Date.now()) {
  return `${SMOKE.containerPrefix}-${pid}-${now}`;
}

export function buildArgs(root, image = SMOKE.image) {
  return ["build", "--build-arg", `NEXT_PUBLIC_BACKEND=${SMOKE.backend}`, "-t", image, root];
}

/**
 * `docker run` for the smoke container. AUTH_SECRET is passed by name only, so
 * its value comes from the docker CLI's environment (smokeSecretEnv()) and never
 * appears on a command line.
 */
export function runArgs(name, image = SMOKE.image, port = SMOKE.port) {
  const env = Object.entries(CONTAINER_ENV).flatMap(([key, value]) => ["-e", `${key}=${value}`]);
  return ["run", "-d", "--name", name, "-p", `${port}:8080`, ...env, "-e", "AUTH_SECRET", image];
}

export function execArgs(name, command = MIGRATE) {
  return ["exec", name, ...command];
}

/**
 * A throwaway AUTH_SECRET for one smoke run, added to the docker CLI's environment.
 * @param {Record<string, string | undefined>} [base]
 * @param {Buffer} [bytes]
 */
export function smokeSecretEnv(base = process.env, bytes = randomBytes(32)) {
  return { ...base, AUTH_SECRET: bytes.toString("base64") };
}

export function checkResponse({ status, contentType, body }, route) {
  if (status !== 200) return `${route.path}: expected status 200, got ${status}`;
  if (route.json) return checkJson(contentType, body, route);
  if (!/^text\/html\b/i.test(contentType ?? "")) {
    return `${route.path}: expected an HTML content-type, got "${contentType ?? "none"}"`;
  }
  const missing = route.html.filter((text) => !body.includes(text));
  if (missing.length > 0) {
    return `${route.path}: HTML is missing ${missing.map((text) => JSON.stringify(text)).join(", ")}`;
  }
  return null;
}

function checkJson(contentType, body, route) {
  if (!/^application\/json\b/i.test(contentType ?? "")) {
    return `${route.path}: expected a JSON content-type, got "${contentType ?? "none"}"`;
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return `${route.path}: body isn't JSON: ${JSON.stringify(body.slice(0, 200))}`;
  }
  const matches = Object.entries(route.json).every(([key, value]) => parsed?.[key] === value);
  return matches ? null : `${route.path}: expected ${JSON.stringify(route.json)}, got ${JSON.stringify(parsed)}`;
}

/** The security headers every response must carry; `headers` is a Headers object. */
export function checkSecurityHeaders(headers, path) {
  const wrong = Object.entries(SECURITY_HEADERS)
    .filter(([name, value]) => headers.get(name) !== value)
    .map(([name, value]) => `${name} should be "${value}", got ${JSON.stringify(headers.get(name))}`);
  return wrong.length > 0 ? `${path}: ${wrong.join("; ")}` : null;
}

/** /_next/static/ files have hashed names, so they are cached for good. */
export function checkStaticCaching(headers, path) {
  const cacheControl = headers.get("cache-control");
  return cacheControl === IMMUTABLE
    ? null
    : `${path}: expected Cache-Control "${IMMUTABLE}", got ${JSON.stringify(cacheControl)}`;
}

export function scriptPaths(html) {
  const found = html.match(/\/_next\/static\/[^"'\\\s]+\.js/g) ?? [];
  return [...new Set(found)];
}

export function checkScripts(sources, route) {
  const missing = route.scripts.filter((text) => !sources.some((source) => source.includes(text)));
  if (missing.length > 0) {
    return `${route.path}: none of the page's ${sources.length} scripts contain ${missing
      .map((text) => JSON.stringify(text))
      .join(", ")}`;
  }
  return null;
}

export function describeError(error) {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error ? `${error.message}: ${error.cause.message}` : error.message;
}

export async function waitUntilReady(
  url,
  {
    timeoutMs = SMOKE.readyTimeoutMs,
    intervalMs = SMOKE.readyIntervalMs,
    fetchImpl = fetch,
    now = Date.now,
  } = {},
) {
  const deadline = now() + timeoutMs;
  let lastError = "no attempt made";
  while (now() <= deadline) {
    try {
      return await fetchImpl(url, { signal: AbortSignal.timeout(SMOKE.requestTimeoutMs) });
    } catch (error) {
      lastError = describeError(error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`${url} was not ready after ${timeoutMs} ms (last error: ${lastError})`);
}

export function run(cmd, args, { capture = true, cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(cmd, args, { cwd, env, shell: false, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" });
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if ("code" in error && error.code === "ENOENT") {
        reject(new Error(`${cmd} CLI not found on PATH`));
      } else {
        reject(new Error(`could not start ${cmd}: ${error.message}`));
      }
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
