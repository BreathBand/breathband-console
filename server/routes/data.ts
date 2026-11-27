// /api/v1/*: the data routes behind the http adapter's DataService
// (src/lib/backend/http/routes.ts names them). Every route but the waitlist
// and an invite's preview (rate limited per IP) needs a signed-in person; access rules come from ../authz.ts. Errors answer
// `{ error: { code, message } }` with the adapter's BackendError codes.

import { and, eq, inArray, notExists } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { BackendErrorCode } from "@/lib/backend/types";
import type { Auth } from "../auth";
import type { LinkScope } from "../authz";
import type { Db } from "../db/client";
import { accountDeletions, coachLinks } from "../db/schema";
import { pendingDeletions } from "../jobs/deletion";
import type { Notifier } from "../notify";
import type { StorageService } from "../storage";
import { accountRoutes } from "./account";
import { alertRoutes } from "./alerts";
import { coachInviteRoutes, publicCoachInviteRoutes } from "./coach-invites";
import { coachingRoutes } from "./coaching";
import { feedbackRoutes } from "./coaching-feedback";
import { groupRoutes } from "./group";
import { calibrationRoutes } from "./calibrations";
import { eventRoutes } from "./events";
import { moodRoutes } from "./mood";
import { profileRoutes } from "./profile";
import { sessionRoutes } from "./sessions";
import { squadRoutes } from "./squads";
import { unsubscribeRoutes } from "./unsubscribe";
import { waitlistRoutes } from "./waitlist";
import { waveformRoutes } from "./waveforms";

export const DATA_BASE_PATH = "/api/v1";

const MAX_BODY_BYTES = 256 * 1024;

export type DataDeps = { db: Db; auth: Auth; storage: StorageService; notify: Notifier };

/** Hono's environment for the data routes: the signed-in person's id. */
export type DataEnv = { Variables: { uid: string } };

export type DataApp = Hono<DataEnv>;

export function dataRoutes(deps: DataDeps) {
  const routes = new Hono<DataEnv>();

  // 256 KB for every body but a saved session, which carries its signal (sessions.ts: 6 MB).
  const smallBodies = bodyLimit({ maxSize: MAX_BODY_BYTES, onError: () => fail("invalid-input", "request body too large") });
  routes.use((c, next) => (c.req.method === "POST" && /\/sessions$/.test(c.req.path) ? next() : smallBodies(c, next)));

  // Public: registered before the session check below, so they answer without one.
  waitlistRoutes(routes, deps);
  publicCoachInviteRoutes(routes, deps);
  unsubscribeRoutes(routes, deps);

  routes.use(async (c, next) => {
    const session = await deps.auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) fail("not-signed-in", "Sign in first.");
    c.set("uid", session.user.id);
    await next();
  });

  // An account waiting to be deleted (routes/account.ts) is hidden at once: its owner can
  // only reach /account (status, cancel, export), and to everyone else it doesn't exist.
  routes.use(async (c, next) => {
    const viewer = c.get("uid");
    const others = peopleInPath(c.req.path).filter((uid) => uid !== viewer);
    const pending = await pendingDeletions(deps.db, [viewer, ...others]);
    if (pending.has(viewer) && !c.req.path.startsWith(`${DATA_BASE_PATH}/account/`)) {
      fail("permission-denied", "This account is being deleted. Cancel the deletion to use it again.");
    }
    if (others.some((uid) => pending.has(uid))) fail("not-found");
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
  moodRoutes(routes, deps);
  calibrationRoutes(routes, deps);
  eventRoutes(routes, deps);
  coachingRoutes(routes, deps);
  feedbackRoutes(routes, deps);
  squadRoutes(routes, deps);
  alertRoutes(routes, deps);
  coachInviteRoutes(routes, deps);
  groupRoutes(routes, deps);
  accountRoutes(routes, deps);
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

/** The coach's link to the athlete, or null when there is none or either account is waiting to be deleted. */
export async function linkScope(db: Db, coachId: string, athleteId: string): Promise<LinkScope> {
  const beingDeleted = db
    .select({ userId: accountDeletions.userId })
    .from(accountDeletions)
    .where(inArray(accountDeletions.userId, [coachId, athleteId]));
  const [link] = await db
    .select({ scope: coachLinks.scope })
    .from(coachLinks)
    .where(and(eq(coachLinks.coachId, coachId), eq(coachLinks.athleteId, athleteId), notExists(beingDeleted)));
  return link?.scope ?? null;
}

/** The people a data path names: `/users/{uid}`, `/athletes/{id}`, `/coaches/{id}`, `/coaches/{id}/seen/{athleteId}`, `/coach-links/{coachId}/{athleteId}`. */
export function peopleInPath(path: string): string[] {
  const ids = [...path.matchAll(/\/(?:users|athletes|coaches|seen)\/([^/]+)/g)].map((m) => m[1]);
  const link = path.match(/\/coach-links\/([^/]+)\/([^/]+)/);
  if (link) ids.push(link[1], link[2]);
  return ids.map((id) => {
    try {
      return decodeURIComponent(id);
    } catch {
      return id;
    }
  });
}

/** The request's JSON body as an object; anything else is invalid input. */
export async function jsonObject(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("invalid-input", "Expected a JSON object.");
  return body as Record<string, unknown>;
}
