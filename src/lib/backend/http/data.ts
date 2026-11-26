import type { GroupSession } from "@/lib/domain/types";
import { BackendError, type DataService, type Presence } from "../types";
import type { ApiClient } from "./client";
import { HTTP_ROUTES } from "./routes";

// DataService over the API's data routes (server/routes/data.ts), served under
// /api: HTTP_ROUTES.data's `/v1/...` paths become `/api/v1/...`. I-08 serves
// profile, preferences, sessions and waveforms; I-09 coaching (links, invites,
// assignments, comments, seen marks, notes, targets); I-10 squads, alert rules,
// a coach's invites to athletes, group sessions (state only) and the waitlist.

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

/** How often the host's live view asks for presence until the realtime channel arrives. */
export const LIVE_POLL_MS = 2000;

export function createHttpData(api: ApiClient): DataService {
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

    listSquads: (coachId) => call(R.listSquads, { coachId }),
    saveSquad: (coachId, squad) => call(R.saveSquad, { coachId }, squad),
    deleteSquad: async (coachId, squadId) => {
      await call(R.deleteSquad, { coachId, squadId });
    },

    getAlertRules: (coachId) => call(R.getAlertRules, { coachId }),
    saveAlertRules: async (coachId, rules) => {
      await call(R.saveAlertRules, { coachId }, rules);
    },

    createCoachInvite: (coachId, { athleteName, contact }) => call(R.createCoachInvite, { coachId }, { athleteName, contact }),
    listCoachInvites: (coachId) => call(R.listCoachInvites, { coachId }),
    revokeCoachInvite: async (coachId, code) => {
      await call(R.revokeCoachInvite, { coachId, code });
    },
    getCoachInvite: (code) => orNull(call(R.getCoachInvite, { code })),
    respondToCoachInvite: (athleteId, code, answer) => call(R.respondToCoachInvite, { athleteId, code }, answer),

    createGroupSession: (hostId, input) => call(R.createGroupSession, { hostId }, input),
    getGroupSession: (id) => orNull(call(R.getGroupSession, { id })),
    listGroupSessions: (uid) => call(R.listGroupSessions, { uid }),
    startGroupSession: (id) => call(R.startGroupSession, { id }),
    setGroupPacer: (id, pacerHalfCycleSec) => call(R.setGroupPacer, { id }, { pacerHalfCycleSec }),
    addGroupMarker: (id) => call(R.addGroupMarker, { id }),
    endGroupSession: (id) => call(R.endGroupSession, { id }),
    cancelGroupSession: async (id) => {
      await call(R.cancelGroupSession, { id });
    },
    // No realtime channel yet: presence from the session's state, every LIVE_POLL_MS, and no frames.
    watchGroupLive: (id, handlers) => {
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let last = "";
      const poll = async () => {
        try {
          const live = await call<{ status: GroupSession["status"]; presence: Record<string, Presence> }>(R.watchGroupLive, { id });
          if (stopped) return;
          const key = JSON.stringify(live.presence);
          if (key !== last) {
            last = key;
            handlers.onPresence(live.presence);
          }
          if (live.status === "ended" || live.status === "cancelled") return;
        } catch (error) {
          // A lost connection is worth another try; a refusal (not the host, no such session) isn't.
          if (stopped || !(error instanceof BackendError && error.code === "unavailable")) return;
        }
        timer = setTimeout(poll, LIVE_POLL_MS);
      };
      void poll();
      return () => {
        stopped = true;
        clearTimeout(timer);
      };
    },

    joinWaitlist: async ({ email, source }) => {
      await call(R.joinWaitlist, {}, { email, source });
    },
  };
}
