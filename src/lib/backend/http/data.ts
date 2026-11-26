import { BackendError, type DataService } from "../types";
import type { ApiClient } from "./client";
import { HTTP_ROUTES } from "./routes";

// DataService over the API's data routes (server/routes/data.ts), served under
// /api: HTTP_ROUTES.data's `/v1/...` paths become `/api/v1/...`. I-08 serves
// profile, preferences, sessions and waveforms; I-09 coaching (links, invites,
// assignments, comments, seen marks, notes, targets). The rest fail with
// "unavailable" naming the card that brings them.

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

/** The methods I-08 and I-09 serve. */
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
  | "listAthletes"
  | "listCoaches"
  | "getCoachLink"
  | "setCoachScope"
  | "createInvite"
  | "redeemInvite"
  | "revokeCoach"
  | "listAssignments"
  | "createAssignment"
  | "cancelAssignment"
  | "listComments"
  | "addComment"
  | "deleteComment"
  | "listSeenSessions"
  | "markSessionSeen"
  | "getCoachNote"
  | "saveCoachNote"
  | "setTargets"
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

    listAthletes: (coachId) => call(R.listAthletes, { coachId }),
    listCoaches: (athleteId) => call(R.listCoaches, { athleteId }),
    getCoachLink: (coachId, athleteId) => orNull(call(R.getCoachLink, { coachId, athleteId })),
    setCoachScope: async (athleteId, coachId, scope) => {
      await call(R.setCoachScope, { athleteId, coachId }, { scope });
    },
    createInvite: (athleteId, scope) => call(R.createInvite, { athleteId }, { scope }),
    redeemInvite: (coachId, code) => call(R.redeemInvite, { coachId }, { code }),
    revokeCoach: async (athleteId, coachId) => {
      await call(R.revokeCoach, { athleteId, coachId });
    },

    listAssignments: (athleteId) => call(R.listAssignments, { athleteId }),
    createAssignment: (coachId, input) => call(R.createAssignment, { coachId }, input),
    cancelAssignment: async (athleteId, assignmentId) => {
      await call(R.cancelAssignment, { athleteId, assignmentId });
    },

    listComments: (athleteId, sessionId) => call(R.listComments, { athleteId }, undefined, { sessionId }),
    addComment: (athleteId, sessionId, { kind, text }) => call(R.addComment, { athleteId, sessionId }, { kind, text }),
    deleteComment: async (athleteId, sessionId, commentId) => {
      await call(R.deleteComment, { athleteId, sessionId, commentId });
    },

    listSeenSessions: (coachId) => call(R.listSeenSessions, { coachId }),
    markSessionSeen: async (coachId, athleteId, sessionId) => {
      await call(R.markSessionSeen, { coachId, athleteId, sessionId });
    },
    getCoachNote: async (coachId, athleteId) => (await call<{ text: string }>(R.getCoachNote, { coachId, athleteId })).text,
    saveCoachNote: async (coachId, athleteId, text) => {
      await call(R.saveCoachNote, { coachId, athleteId }, { text });
    },
    setTargets: async (coachId, athleteId, targets) => {
      await call(R.setTargets, { coachId, athleteId }, targets);
    },
  };
}
