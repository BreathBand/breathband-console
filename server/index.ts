// The API app: /api routes, the static export in production, security headers.
// main.ts runs it on Node; tests call app.request() without a port.

import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import type { Db } from "./db/client";
import type { Mode } from "./env";
import { serveExport } from "./static";

export type AppDeps = {
  db: Db;
  mode: Mode;
  /** The web app's address; in development the API accepts credentialed requests from its origin. */
  appUrl: string;
  /** Serve this static export (`out/`) for everything outside /api. Production only. */
  staticDir?: string;
  /** Log each request to stdout. */
  log?: boolean;
};

/** nginx.conf's `add_header ... always` set, now on every response including /_next/static/. */
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
} as const;

const HEALTH_TIMEOUT_MS = 2000;

const ERROR_CODES: Partial<Record<number, string>> = {
  400: "invalid-input",
  401: "not-signed-in",
  403: "permission-denied",
  404: "not-found",
};

export function createApp(deps: AppDeps) {
  const app = new Hono();

  if (deps.log) app.use(logger());

  app.use(async (c, next) => {
    await next();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.res.headers.set(name, value);
  });

  if (deps.mode === "development") {
    app.use("/api/*", cors({ origin: new URL(deps.appUrl).origin, credentials: true }));
  }

  app.get("/api/health", async (c) => {
    const db = (await databaseIsUp(deps.db)) ? "up" : "down";
    return c.json({ ok: db === "up", db });
  });

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
