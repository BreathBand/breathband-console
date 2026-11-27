// The API app: /api routes, the static export in production, security headers.
// main.ts runs it on Node; tests call app.request() without a port.

import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { AUTH_BASE_PATH, type Auth } from "./auth";
import type { Db } from "./db/client";
import type { Mode } from "./env";
import { authRoutes } from "./routes/auth";
import { DATA_BASE_PATH, dataRoutes } from "./routes/data";
import { serveExport } from "./static";
import { silentNotifier, type Notifier } from "./notify";
import type { StorageService } from "./storage";

export type AppDeps = {
  db: Db;
  mode: Mode;
  /** The web app's address; in development the API accepts credentialed requests from its origin. */
  appUrl: string;
  /** Serve this static export (`out/`) for everything outside /api. Production only. */
  staticDir?: string;
  /** Log each request to stdout, with invite codes and auth tokens redacted (`redactLogLine`). */
  log?: boolean;
  /** Better Auth (server/auth.ts), mounted at /api/auth. Without it there are no auth routes. */
  auth?: Auth;
  /** Where waveforms live (server/storage). With `auth`, mounts the data routes at /api/v1. */
  storage?: StorageService;
  /** The product's emails (server/notify.ts). Without it nothing is sent, as in most tests. */
  notify?: Notifier;
};

/** nginx.conf's `add_header ... always` set, now on every response including /_next/static/. */
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
} as const;

/**
 * Every response that didn't set its own policy (the API's JSON and its small
 * HTML answers, like unsubscribe): nothing loads, inline styles aside, and no
 * framing. Exported pages set theirs per page (server/static.ts).
 */
export const API_POLICY = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/** Production only, where the site is served over HTTPS: a year, subdomains included. */
export const HSTS = "max-age=31536000; includeSubDomains";

const HEALTH_TIMEOUT_MS = 2000;

const ERROR_CODES: Partial<Record<number, string>> = {
  400: "invalid-input",
  401: "not-signed-in",
  403: "permission-denied",
  404: "not-found",
};

export function createApp(deps: AppDeps) {
  const app = new Hono();

  if (deps.log) app.use(logger((line, ...rest) => console.log(redactLogLine(line), ...rest)));

  app.use(async (c, next) => {
    await next();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.res.headers.set(name, value);
    if (!c.res.headers.has("Content-Security-Policy")) c.res.headers.set("Content-Security-Policy", API_POLICY);
    if (deps.mode === "production") c.res.headers.set("Strict-Transport-Security", HSTS);
  });

  if (deps.mode === "development") {
    app.use("/api/*", cors({ origin: new URL(deps.appUrl).origin, credentials: true }));
  }

  app.get("/api/health", async (c) => {
    const db = (await databaseIsUp(deps.db)) ? "up" : "down";
    return c.json({ ok: db === "up", db });
  });

  if (deps.auth) app.route(AUTH_BASE_PATH, authRoutes(deps.auth));
  if (deps.auth && deps.storage) {
    app.route(DATA_BASE_PATH, dataRoutes({ db: deps.db, auth: deps.auth, storage: deps.storage, notify: deps.notify ?? silentNotifier }));
  }

  if (deps.staticDir) {
    const serve = serveExport(deps.staticDir);
    app.get("*", (c) => (isApiPath(c.req.path) ? c.notFound() : serve(c)));
  }

  app.notFound((c) => c.json({ error: { code: "not-found", message: "Not found" } }, 404));

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      const status = error.status as ContentfulStatusCode;
      return c.json({ error: { code: ERROR_CODES[status] ?? "error", message: error.message } }, status);
    }
    console.error(error);
    const body: { code: string; message: string; stack?: string } = {
      code: "internal",
      message: "Internal server error",
    };
    if (deps.mode !== "production") {
      body.message = error.message;
      body.stack = error.stack;
    }
    return c.json({ error: body }, 500);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;

const REDACTED = "[code]";
const REDACTED_TOKEN = "[token]";
const REDACTED_UNREADABLE = "[redacted]";

/**
 * A logged request line without invite codes (T-0133). The database keeps only
 * their hashes, so the logs mustn't keep them either. Redacts the code segment
 * of every coach-invite route (`/coach-invites/{code}`, `/preview`, `/revoke`,
 * `/response`), and the `code` and `invite` query values of the pages that
 * carry one (`/cloud/join/?code=`, `/cloud/welcome/?invite=`), also when
 * they're percent-encoded inside another value (sign-in's `?next=`). Athletes'
 * own invite codes travel in request bodies, which aren't logged.
 */
export function redactInviteCodes(line: string): string {
  return line
    .replace(/(\/coach-invites\/)[^/?#\s]+/gi, `$1${REDACTED}`)
    .replace(/([?&](?:code|invite)=)[^&#\s]*/gi, `$1${REDACTED}`)
    .replace(/((?:%3F|%26)(?:code|invite)%3D)(?:(?!%26)[^&#\s])*/gi, `$1${REDACTED}`);
}

/**
 * A logged request line without Better Auth's one-time tokens (T-0135): with
 * one, anyone reading the logs could verify an email or reset a password.
 * Better Auth 1.7 puts them in `GET /api/auth/verify-email?token=` (and
 * `/delete-user/callback?token=`, `/magic-link/verify?token=`), in the path of
 * the reset link (`GET /api/auth/reset-password/{token}?callbackURL=`), and
 * redirects that one onto the app's reset page as `?token=`. Redacts every
 * query parameter named `token` or ending in it (`id_token`), whatever its
 * case and on any route, also percent-encoded inside another value (a
 * `callbackURL` or `next`, encoded any number of times), and the reset path's
 * token segment. OAuth's `code` is covered by `redactInviteCodes`.
 */
export function redactAuthTokens(line: string): string {
  return line
    .replace(/(\/reset-password\/)[^/?#\s]+/gi, `$1${REDACTED_TOKEN}`)
    .replace(/([?&][\w.-]*token=)[^&#\s]*/gi, `$1${REDACTED_TOKEN}`)
    .replace(/(%(?:25)*(?:3F|26)[\w.-]*token%(?:25)*3D)(?:(?!%(?:25)*26)[^&#\s])*/gi, `$1${REDACTED_TOKEN}`);
}

/** Both redactions; applied to a fully decoded copy, a clean line comes back unchanged. */
function redactSecrets(text: string): string {
  return redactAuthTokens(redactInviteCodes(text));
}

const MAX_DECODE_ROUNDS = 8;

/**
 * Percent-decodes until nothing changes; undefined if a round fails (a stray
 * `%`, broken UTF-8) or it hasn't settled after MAX_DECODE_ROUNDS.
 */
function fullyDecoded(text: string): string | undefined {
  let current = text;
  for (let round = 0; round < MAX_DECODE_ROUNDS; round++) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      return undefined;
    }
    if (next === current) return current;
    current = next;
  }
  return undefined;
}

/** True when the fully decoded `text` holds no secret the redactions would still change. */
function isClean(text: string): boolean {
  const decoded = fullyDecoded(text);
  return decoded !== undefined && redactSecrets(decoded) === decoded;
}

/**
 * The URL of a log line, redacted. The redactions run on the URL as it came;
 * then a fully percent-decoded copy is checked, so a secret hidden by encoding
 * the redactions don't expect (`coach%2Dinvites`, `%74oken=`) can't slip
 * through. When that copy still holds one, or the URL doesn't decode, it is
 * redacted conservatively: the query becomes `?[redacted]`, and the path is
 * kept only if it decodes clean, else cut at its first `%`.
 */
function redactUrl(url: string): string {
  const redacted = redactSecrets(url);
  if (isClean(redacted)) return redacted;
  const queryAt = redacted.indexOf("?");
  const path = queryAt === -1 ? redacted : redacted.slice(0, queryAt);
  const query = queryAt === -1 ? "" : `?${REDACTED_UNREADABLE}`;
  if (isClean(path)) return `${path}${query}`;
  const cut = path.indexOf("%");
  return `${cut === -1 ? "" : path.slice(0, cut)}${REDACTED_UNREADABLE}`;
}

/**
 * What the request logger prints: Hono's `<-- METHOD URL` and
 * `--> METHOD URL STATUS TIME` with the URL redacted (`redactUrl`); method,
 * status and time are left readable. A line of another shape is redacted
 * as a whole, conservatively.
 */
export function redactLogLine(line: string): string {
  const parts = /^(<--|-->) (\S+) (\S+)([\s\S]*)$/.exec(line);
  if (parts) {
    const [, prefix, method, url, rest] = parts;
    return `${prefix} ${method} ${redactUrl(url)}${rest}`;
  }
  const redacted = redactSecrets(line);
  return isClean(redacted) ? redacted : REDACTED_UNREADABLE;
}

function isApiPath(path: string): boolean {
  return path === "/api" || path.startsWith("/api/");
}

async function databaseIsUp(db: Db): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("database health check timed out")), HEALTH_TIMEOUT_MS);
  });
  try {
    await Promise.race([db.run(sql`select 1`), timeout]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
