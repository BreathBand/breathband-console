// /api/v1/*: the data routes behind the http adapter's DataService
// (src/lib/backend/http/routes.ts names them). Every route needs a signed-in
// person; access rules come from ../authz.ts. Errors answer
// `{ error: { code, message } }` with the adapter's BackendError codes.

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { BackendErrorCode } from "@/lib/backend/types";
import type { Auth } from "../auth";
import type { LinkScope } from "../authz";
import type { Db } from "../db/client";
import { coachLinks } from "../db/schema";
import type { StorageService } from "../storage";
import { profileRoutes } from "./profile";
import { sessionRoutes } from "./sessions";
import { waveformRoutes } from "./waveforms";

export const DATA_BASE_PATH = "/api/v1";

const MAX_BODY_BYTES = 256 * 1024;

export type DataDeps = { db: Db; auth: Auth; storage: StorageService };

/** Hono's environment for the data routes: the signed-in person's id. */
export type DataEnv = { Variables: { uid: string } };

export type DataApp = Hono<DataEnv>;

export function dataRoutes(deps: DataDeps) {
  const routes = new Hono<DataEnv>();

  // 256 KB for every body but a saved session, which carries its signal (sessions.ts: 6 MB).
  const smallBodies = bodyLimit({ maxSize: MAX_BODY_BYTES, onError: () => fail("invalid-input", "request body too large") });
  routes.use((c, next) => (c.req.method === "POST" && /\/sessions$/.test(c.req.path) ? next() : smallBodies(c, next)));

  routes.use(async (c, next) => {
    const session = await deps.auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) fail("not-signed-in", "Sign in first.");
    c.set("uid", session.user.id);
    await next();
  });

  routes.onError((error, c) => {
    if (error instanceof DataError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status);
    }
    throw error;
  });

  // One Hono instance, so the error handler above covers every route.
  profileRoutes(routes, deps);
  sessionRoutes(routes, deps);
  waveformRoutes(routes, deps);
  return routes;
}

const STATUS: Partial<Record<BackendErrorCode, ContentfulStatusCode>> = {
  "not-signed-in": 401,
  "permission-denied": 403,
  "not-found": 404,
};

class DataError extends HTTPException {
  constructor(
    readonly code: BackendErrorCode,
    message: string,
  ) {
    super(STATUS[code] ?? 400, { message });
  }
}

/** Ends the request with this BackendError code (401, 403, 404, else 400). */
export function fail(code: BackendErrorCode, message: string = code): never {
  throw new DataError(code, message);
}

/** The coach's link to the athlete, or null when there is none. */
export async function linkScope(db: Db, coachId: string, athleteId: string): Promise<LinkScope> {
  const [link] = await db
    .select({ scope: coachLinks.scope })
    .from(coachLinks)
    .where(and(eq(coachLinks.coachId, coachId), eq(coachLinks.athleteId, athleteId)));
  return link?.scope ?? null;
}

/** The request's JSON body as an object; anything else is invalid input. */
export async function jsonObject(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("invalid-input", "Expected a JSON object.");
  return body as Record<string, unknown>;
}
