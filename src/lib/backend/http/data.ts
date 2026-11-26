import { BackendError, type DataService } from "../types";
import type { ApiClient } from "./client";
import { HTTP_ROUTES } from "./routes";

// DataService over the API's data routes (server/routes/data.ts), served under
// /api: HTTP_ROUTES.data's `/v1/...` paths become `/api/v1/...`. I-08 serves
// profile, preferences, sessions and waveforms; the rest fail with "unavailable"
// naming the card that brings them.

export const DATA_PREFIX = "/api";

type Routes = typeof HTTP_ROUTES.data;

/** The request path for a route, with its `{name}` parameters filled in and encoded. */
export function dataPath(route: Routes[keyof Routes], params: Record<string, string>, query?: Record<string, string | number | undefined>): string {
  const path = route.path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`${route.path}: missing ${name}`);
    return encodeURIComponent(value);
  });
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) search.set(key, String(value));
  const qs = search.toString();
  return `${DATA_PREFIX}${path}${qs ? `?${qs}` : ""}`;
}

/** Null when the API answers "not-found"; the method's other errors pass through. */
async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof BackendError && error.code === "not-found") return null;
    throw error;
  }
}

/** The methods I-08 serves. */
export type ServedDataMethods = Pick<
  DataService,
  | "getProfile"
  | "updateProfile"
  | "listSessions"
  | "getSession"
  | "getWaveform"
  | "updateSessionNote"
  | "saveSession"
  | "deleteSession"
>;

export function createHttpData(api: ApiClient): ServedDataMethods {
  const R = HTTP_ROUTES.data;
  const call = <T>(route: Routes[keyof Routes], params: Record<string, string>, body?: unknown, query?: Record<string, string | number | undefined>) =>
    api.request<T>(route.method, dataPath(route, params, query), body);

  return {
    getProfile: (uid) => orNull(call(R.getProfile, { uid })),
    updateProfile: (uid, changes) => call(R.updateProfile, { uid }, changes),

    listSessions: (athleteId, options = {}) =>
      call(R.listSessions, { athleteId }, undefined, { limit: options.limit, before: options.before }),
    getSession: (athleteId, sessionId) => orNull(call(R.getSession, { athleteId, sessionId })),
    getWaveform: (session) => call(R.getWaveform, { athleteId: session.athleteId, sessionId: session.id }),
    updateSessionNote: async (athleteId, sessionId, note) => {
      await call(R.updateSessionNote, { athleteId, sessionId }, { note });
    },
    saveSession: (athleteId, session, waveform) => call(R.saveSession, { athleteId }, { session, waveform }),
    deleteSession: async (athleteId, sessionId) => {
      await call(R.deleteSession, { athleteId, sessionId });
    },
  };
}
