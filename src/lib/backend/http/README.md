# HTTP backend adapter (stub)

This folder holds a placeholder adapter for a future BreathCloud API on Cloud Run.

Decision 2 (2026-11-23): BreathCloud runs on the local adapter for now. The backend seam (`../types.ts`) also gets an `http` adapter with the same interface, so a later move to a Cloud Run API means writing one adapter, not touching screens.

## What the stub does

- `createHttpBackend()` in `index.ts` only throws an `Error` that names `NEXT_PUBLIC_BACKEND=http` and points back to this folder. It never returns a backend.
- **The stub makes no network calls.** It does not call `fetch`, open sockets or read any URL, and it imports only types from `../types.ts`.
- `HTTP_ROUTES` in `index.ts` is the proposed REST route for every `AuthService` and `DataService` method. Its type is `Record<keyof AuthService, HttpRoute>` and `Record<keyof DataService, HttpRoute>`, so typecheck fails when a method is added to `../types.ts` without a route. `http.test.ts` also checks its keys against the local adapter's methods.
- `createBackend("http")` in `../index.ts` calls `createHttpBackend()`, so a build with `NEXT_PUBLIC_BACKEND=http` fails loudly instead of quietly showing demo data.

## Proposed routes

These are proposals, not a published API. They are copied from `HTTP_ROUTES`; if the two disagree, `index.ts` is right and this table is out of date. `{name}` is a path parameter taken from the method's arguments; everything else (options, inputs, answers) goes in the query string for `GET` and in a JSON body otherwise.

### AuthService

| Method | Verb | Path |
| --- | --- | --- |
| `currentUser` | `GET` | `/v1/auth/me` |
| `onAuthStateChanged` | `GET` | `/v1/auth/session` |
| `signIn` | `POST` | `/v1/auth/sign-in` |
| `signUp` | `POST` | `/v1/auth/sign-up` |
| `sendPasswordReset` | `POST` | `/v1/auth/password-reset` |
| `signOut` | `POST` | `/v1/auth/sign-out` |

### DataService

| Method | Verb | Path |
| --- | --- | --- |
| `getProfile` | `GET` | `/v1/users/{uid}` |
| `updateProfile` | `PATCH` | `/v1/users/{uid}` |
| `listSessions` | `GET` | `/v1/athletes/{athleteId}/sessions` |
| `getSession` | `GET` | `/v1/athletes/{athleteId}/sessions/{sessionId}` |
| `getWaveform` | `GET` | `/v1/athletes/{athleteId}/sessions/{sessionId}/waveform` |
| `updateSessionNote` | `PUT` | `/v1/athletes/{athleteId}/sessions/{sessionId}/note` |
| `saveSession` | `POST` | `/v1/athletes/{athleteId}/sessions` |
| `deleteSession` | `DELETE` | `/v1/athletes/{athleteId}/sessions/{sessionId}` |
| `listAthletes` | `GET` | `/v1/coaches/{coachId}/athletes` |
| `listCoaches` | `GET` | `/v1/athletes/{athleteId}/coaches` |
| `getCoachLink` | `GET` | `/v1/coach-links/{coachId}/{athleteId}` |
| `setCoachScope` | `PATCH` | `/v1/athletes/{athleteId}/coaches/{coachId}/scope` |
| `createInvite` | `POST` | `/v1/athletes/{athleteId}/invites` |
| `redeemInvite` | `POST` | `/v1/coaches/{coachId}/invites/redeem` |
| `revokeCoach` | `DELETE` | `/v1/athletes/{athleteId}/coaches/{coachId}` |
| `listAssignments` | `GET` | `/v1/athletes/{athleteId}/assignments` |
| `createAssignment` | `POST` | `/v1/coaches/{coachId}/assignments` |
| `cancelAssignment` | `POST` | `/v1/athletes/{athleteId}/assignments/{assignmentId}/cancel` |
| `listComments` | `GET` | `/v1/athletes/{athleteId}/comments` |
| `addComment` | `POST` | `/v1/athletes/{athleteId}/sessions/{sessionId}/comments` |
| `deleteComment` | `DELETE` | `/v1/athletes/{athleteId}/sessions/{sessionId}/comments/{commentId}` |
| `listSeenSessions` | `GET` | `/v1/coaches/{coachId}/seen` |
| `markSessionSeen` | `PUT` | `/v1/coaches/{coachId}/seen/{athleteId}/{sessionId}` |
| `getCoachNote` | `GET` | `/v1/coaches/{coachId}/athletes/{athleteId}/note` |
| `saveCoachNote` | `PUT` | `/v1/coaches/{coachId}/athletes/{athleteId}/note` |
| `setTargets` | `PUT` | `/v1/coaches/{coachId}/athletes/{athleteId}/targets` |
| `listSquads` | `GET` | `/v1/coaches/{coachId}/squads` |
| `saveSquad` | `PUT` | `/v1/coaches/{coachId}/squads` |
| `deleteSquad` | `DELETE` | `/v1/coaches/{coachId}/squads/{squadId}` |
| `getAlertRules` | `GET` | `/v1/coaches/{coachId}/alert-rules` |
| `saveAlertRules` | `PUT` | `/v1/coaches/{coachId}/alert-rules` |
| `createCoachInvite` | `POST` | `/v1/coaches/{coachId}/coach-invites` |
| `listCoachInvites` | `GET` | `/v1/coaches/{coachId}/coach-invites` |
| `revokeCoachInvite` | `POST` | `/v1/coaches/{coachId}/coach-invites/{code}/revoke` |
| `getCoachInvite` | `GET` | `/v1/coach-invites/{code}` |
| `respondToCoachInvite` | `POST` | `/v1/athletes/{athleteId}/coach-invites/{code}/response` |
| `createGroupSession` | `POST` | `/v1/coaches/{hostId}/group-sessions` |
| `getGroupSession` | `GET` | `/v1/group-sessions/{id}` |
| `listGroupSessions` | `GET` | `/v1/users/{uid}/group-sessions` |
| `startGroupSession` | `POST` | `/v1/group-sessions/{id}/start` |
| `setGroupPacer` | `PUT` | `/v1/group-sessions/{id}/pacer` |
| `addGroupMarker` | `POST` | `/v1/group-sessions/{id}/markers` |
| `endGroupSession` | `POST` | `/v1/group-sessions/{id}/end` |
| `cancelGroupSession` | `POST` | `/v1/group-sessions/{id}/cancel` |
| `watchGroupLive` | `GET` | `/v1/group-sessions/{id}/live` |
| `joinWaitlist` | `POST` | `/v1/waitlist` |

### Methods that are not a single request

- `currentUser()` is synchronous and `onAuthStateChanged()` calls back immediately, so the adapter needs a client-side session cache. `GET /v1/auth/session` fills it at start-up and after sign-in, sign-up and sign-out; `GET /v1/auth/me` reads the signed-in user. Neither method should block on the network.
- `watchGroupLive()` is a stream of about ten frames a second, not a request and response. `GET /v1/group-sessions/{id}/live` is meant for a streaming transport (server-sent events or a WebSocket upgrade); which one is part of the API design.
- `getWaveform()` takes a whole `SessionSummary`; the route uses its `athleteId` and `id`.

## Auth is an open decision

How the Cloud Run API authenticates callers is **not decided** and this stub does not decide it. The candidates include Firebase Auth ID tokens sent as a bearer token, Cloud Run IAM in front of the service, or sessions issued by the API itself. The `/v1/auth/*` routes above assume the API handles sign-in itself; if Firebase Auth or another identity provider is chosen, `AuthService` would talk to that provider instead and those routes would go away. Settle this before implementing the adapter, together with how the API enforces the same access rules as `firebase/firestore.rules` and `firebase/storage.rules`.

## Activating it later

1. Settle the auth decision above and publish the API's routes; update `HTTP_ROUTES` and this table if they change.
2. Implement `createHttpBackend()` in `index.ts` against the interfaces in `../types.ts`, building each request from `HTTP_ROUTES`. Return `kind: "http"`.
3. Map HTTP failures to `BackendErrorCode`: 401 → `"not-signed-in"` (or `"invalid-credentials"` from sign-in), 403 → `"permission-denied"`, 404 → `"not-found"`, 409 → `"email-in-use"`, 400/422 → `"invalid-input"` or the more specific code the API returns, network errors and 5xx → `"unavailable"`.
4. Set `NEXT_PUBLIC_BACKEND=http` and `NEXT_PUBLIC_API_BASE_URL` in `.env.local` (see `.env.example`). Both are inlined into the static build.
5. Run the behaviours in `../local/local.test.ts` against the new adapter and a test deployment of the API; they describe what every adapter has to match.

Adding an HTTP client library is a new dependency and needs a person's approval first; the browser's `fetch` is enough for the routes above.
