import type { AuthService, DataService } from "../types";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpRoute<P extends string = string> {
  method: HttpMethod;
  path: P;
}

export interface HttpRoutes {
  /** Served by the API: Better Auth, mounted at /api/auth. */
  auth: Record<keyof AuthService, HttpRoute<`/api/auth/${string}`>>;
  /** Served by the API under /api (I-08: profile, sessions, waveforms; I-09: coaching); the rest are proposals until I-10. */
  data: Record<keyof DataService, HttpRoute<`/v1/${string}`>>;
}

export const HTTP_METHODS: readonly HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export const HTTP_ROUTES: HttpRoutes = {
  auth: {
    // Better Auth's own routes (server/auth.ts). Both state methods read the session.
    currentUser: { method: "GET", path: "/api/auth/get-session" },
    onAuthStateChanged: { method: "GET", path: "/api/auth/get-session" },
    signIn: { method: "POST", path: "/api/auth/sign-in/email" },
    signUp: { method: "POST", path: "/api/auth/sign-up/email" },
    sendPasswordReset: { method: "POST", path: "/api/auth/request-password-reset" },
    signOut: { method: "POST", path: "/api/auth/sign-out" },
  },
  // Under /api on the API. Profile, sessions and waveforms (I-08) and coaching (I-09) are served; the rest are proposals (I-10).
  data: {
    getProfile: { method: "GET", path: "/v1/users/{uid}" },
    updateProfile: { method: "PATCH", path: "/v1/users/{uid}" },

    listSessions: { method: "GET", path: "/v1/athletes/{athleteId}/sessions" },
    getSession: { method: "GET", path: "/v1/athletes/{athleteId}/sessions/{sessionId}" },
    getWaveform: { method: "GET", path: "/v1/athletes/{athleteId}/sessions/{sessionId}/waveform" },
    updateSessionNote: { method: "PUT", path: "/v1/athletes/{athleteId}/sessions/{sessionId}/note" },
    saveSession: { method: "POST", path: "/v1/athletes/{athleteId}/sessions" },
    deleteSession: { method: "DELETE", path: "/v1/athletes/{athleteId}/sessions/{sessionId}" },

    listAthletes: { method: "GET", path: "/v1/coaches/{coachId}/athletes" },
    listCoaches: { method: "GET", path: "/v1/athletes/{athleteId}/coaches" },
    getCoachLink: { method: "GET", path: "/v1/coach-links/{coachId}/{athleteId}" },
    setCoachScope: { method: "PATCH", path: "/v1/athletes/{athleteId}/coaches/{coachId}/scope" },
    createInvite: { method: "POST", path: "/v1/athletes/{athleteId}/invites" },
    redeemInvite: { method: "POST", path: "/v1/coaches/{coachId}/invites/redeem" },
    revokeCoach: { method: "DELETE", path: "/v1/athletes/{athleteId}/coaches/{coachId}" },

    listAssignments: { method: "GET", path: "/v1/athletes/{athleteId}/assignments" },
    createAssignment: { method: "POST", path: "/v1/coaches/{coachId}/assignments" },
    cancelAssignment: { method: "POST", path: "/v1/athletes/{athleteId}/assignments/{assignmentId}/cancel" },

    listComments: { method: "GET", path: "/v1/athletes/{athleteId}/comments" },
    addComment: { method: "POST", path: "/v1/athletes/{athleteId}/sessions/{sessionId}/comments" },
    deleteComment: {
      method: "DELETE",
      path: "/v1/athletes/{athleteId}/sessions/{sessionId}/comments/{commentId}",
    },

    listSeenSessions: { method: "GET", path: "/v1/coaches/{coachId}/seen" },
    markSessionSeen: { method: "PUT", path: "/v1/coaches/{coachId}/seen/{athleteId}/{sessionId}" },
    getCoachNote: { method: "GET", path: "/v1/coaches/{coachId}/athletes/{athleteId}/note" },
    saveCoachNote: { method: "PUT", path: "/v1/coaches/{coachId}/athletes/{athleteId}/note" },

    setTargets: { method: "PUT", path: "/v1/coaches/{coachId}/athletes/{athleteId}/targets" },

    listSquads: { method: "GET", path: "/v1/coaches/{coachId}/squads" },
    saveSquad: { method: "PUT", path: "/v1/coaches/{coachId}/squads" },
    deleteSquad: { method: "DELETE", path: "/v1/coaches/{coachId}/squads/{squadId}" },

    getAlertRules: { method: "GET", path: "/v1/coaches/{coachId}/alert-rules" },
    saveAlertRules: { method: "PUT", path: "/v1/coaches/{coachId}/alert-rules" },

    createCoachInvite: { method: "POST", path: "/v1/coaches/{coachId}/coach-invites" },
    listCoachInvites: { method: "GET", path: "/v1/coaches/{coachId}/coach-invites" },
    revokeCoachInvite: { method: "POST", path: "/v1/coaches/{coachId}/coach-invites/{code}/revoke" },
    getCoachInvite: { method: "GET", path: "/v1/coach-invites/{code}" },
    respondToCoachInvite: { method: "POST", path: "/v1/athletes/{athleteId}/coach-invites/{code}/response" },

    createGroupSession: { method: "POST", path: "/v1/coaches/{hostId}/group-sessions" },
    getGroupSession: { method: "GET", path: "/v1/group-sessions/{id}" },
    listGroupSessions: { method: "GET", path: "/v1/users/{uid}/group-sessions" },
    startGroupSession: { method: "POST", path: "/v1/group-sessions/{id}/start" },
    setGroupPacer: { method: "PUT", path: "/v1/group-sessions/{id}/pacer" },
    addGroupMarker: { method: "POST", path: "/v1/group-sessions/{id}/markers" },
    endGroupSession: { method: "POST", path: "/v1/group-sessions/{id}/end" },
    cancelGroupSession: { method: "POST", path: "/v1/group-sessions/{id}/cancel" },
    watchGroupLive: { method: "GET", path: "/v1/group-sessions/{id}/live" },

    joinWaitlist: { method: "POST", path: "/v1/waitlist" },
  },
};
