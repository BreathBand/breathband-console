# HTTP backend adapter

The adapter for the API in `server/` (planning/v1/04-infrastructure.md). It has the same interface as the local adapter (`../types.ts`), so screens don't change when a build sets `NEXT_PUBLIC_BACKEND=http`.

- **AuthService works** (I-07): it talks to Better Auth at `/api/auth/*` (`server/auth.ts`).
- **DataService works, every method**: profile and preferences, sessions and waveforms (I-08); coaching (I-09: coach links, invites, scope, revoke, assignments, comments and kudos, seen marks, private notes, targets); squads, alert rules, a coach's invites to athletes, group sessions (state only) and the waitlist (I-10), at `/api/v1/*` (`server/routes/data.ts` and the route files it mounts). `watchGroupLive` has no realtime channel yet: see below.

## Settings

Both are inlined into the static build (see `.env.example`):

- `NEXT_PUBLIC_BACKEND=http` picks this adapter.
- `NEXT_PUBLIC_API_BASE_URL` is the API's origin, e.g. `http://localhost:8787` in development. Empty means the page's own origin (the production image serves the app and the API together).

Every request is a `fetch` with `credentials: "include"`, so the browser sends the session cookie (HttpOnly, set by the API). In development the API allows the app's origin with credentials (`server/index.ts`).

## How AuthService maps to the API

| Method | Verb | Path |
| --- | --- | --- |
| `currentUser` | `GET` | `/api/auth/get-session` |
| `onAuthStateChanged` | `GET` | `/api/auth/get-session` |
| `signIn` | `POST` | `/api/auth/sign-in/email` |
| `signUp` | `POST` | `/api/auth/sign-up/email` |
| `sendPasswordReset` | `POST` | `/api/auth/request-password-reset` |
| `signOut` | `POST` | `/api/auth/sign-out` |

- **Session state.** `currentUser()` is synchronous, so the adapter keeps a copy of who is signed in. The first call to `currentUser()` or `onAuthStateChanged()` reads `get-session` once; sign-in and sign-out update the copy. Until that first read answers, `currentUser()` is `null` and `onAuthStateChanged()` waits rather than reporting "signed out" (so the console doesn't flash the login page). If the read fails, the person counts as signed out.
- **Sign-up** sends `name`, `email`, `password`, `role`, `birthYear`, `consents` and `callbackURL: "/cloud/"`. The API emails a confirmation link (the server points the relative callback at `APP_URL`); following it confirms the address, signs the person in and lands on `/cloud/`. Until then there is no session: `signUp` returns the account with `emailVerified: false` and the person stays signed out.
- **Checks done here first**, in the local adapter's order: email shape (`invalid-email`), password length (`weak-password`), age 16+ (`under-age`) and consents (`invalid-input`). The API repeats them all: Better Auth the first two, and a sign-up hook (`signUpHooks` in `server/routes/profile.ts`) the 16+ rule and the consents, which it stores with the profile.
- **Sign-in** also sends `callbackURL: "/cloud/"`: when the address isn't confirmed, the API emails a fresh link and refuses with `EMAIL_NOT_VERIFIED`.
- **Password reset** sends `redirectTo: <app origin>/cloud/reset/`. The emailed link goes through the API and lands on `/cloud/reset/?token=…`; the reset page then POSTs `/api/auth/reset-password` with the token and the new password. The API answers the same whether or not the address has an account.
- **Sign-out** clears the copy even when the request fails, and reports the failure.

### Errors

Better Auth answers errors as `{ code, message }`; the API's own routes answer `{ error: { code, message } }` with this adapter's codes, which pass through. `toBackendError()` in `client.ts`:

| From the API | `BackendError` code |
| --- | --- |
| `INVALID_EMAIL_OR_PASSWORD` | `invalid-credentials` |
| `USER_ALREADY_EXISTS`, `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` | `email-in-use` |
| `INVALID_EMAIL` | `invalid-email` |
| `PASSWORD_TOO_SHORT` | `weak-password` |
| `EMAIL_NOT_VERIFIED` | `permission-denied`, with a message saying a new link was sent |
| `PASSWORD_TOO_LONG`, `VALIDATION_ERROR`, `MISSING_FIELD`, `FIELD_NOT_ALLOWED`, `INVALID_TOKEN`, `TOKEN_EXPIRED` | `invalid-input` |
| 429 (rate limited) | `unavailable`, "Too many attempts" |
| otherwise by status: 400/422, 401, 403, 404, 409 | `invalid-input`, `not-signed-in`, `permission-denied`, `not-found`, `email-in-use` |
| 5xx, no answer, network failure | `unavailable` |

### Where http differs from local on purpose

The shared contract suite (`../contract/auth.contract.ts`) names these as traits rather than skipping tests:

- `confirmsEmail`: a new account signs in only after the emailed link. Local accounts are confirmed from the start.
- `revealsEmailInUse: false`: signing up with an address that has an account answers like a new sign-up (Better Auth's protection against finding out who has an account); no second account is made and the existing password still works. Local says `email-in-use`.

### Gaps

- **Consents and birth year are optional for the API.** A direct API sign-up without them still makes an account (the API's own auth tests do this); with them, under 16 and missing or outdated consents are refused. See CARD T-0117's questions.

## Data routes

The API serves these under `/api`: `/v1/users/{uid}` is `GET /api/v1/users/{uid}` (`DATA_PREFIX` in `data.ts`). I-08 serves profile and preferences (`getProfile`, `updateProfile`) and sessions and waveforms (`listSessions` … `deleteSession`); I-09 serves coaching (`listAthletes` … `setTargets`); I-10 the rest (`listSquads` … `joinWaitlist`). They are copied from `HTTP_ROUTES` in `routes.ts`; if the two disagree, `routes.ts` is right and this table is out of date. `{name}` is a path parameter taken from the method's arguments (URL-encoded); everything else (options, inputs, answers) goes in the query string for `GET` and in a JSON body otherwise.

- Errors are `{ error: { code, message } }` with this adapter's codes. `not-found` from `getProfile` and `getSession` becomes `null`. A 401 means the session is gone: the adapter counts the person as signed out and tells `onAuthStateChanged` listeners. A 409 from a data route is `invalid-input`, never `email-in-use`.
- `saveSession` posts `{ session, waveform }` in one request (under 6 MB; the signal under 5 MB). The API stores the signal gzipped through its `StorageService` at `waveforms/{athleteId}/{id}.json.gz` and the summary in `breath_sessions`.
- `getProfile` for someone else (either side of a coach link) leaves out their `birthYear` and `consents`; so do `listAthletes` and `listCoaches`.
- Invite codes are stored only as a SHA-256 hash, last 7 days and redeem once (`invite-invalid` otherwise). `getCoachLink` answers `null` for no link. `getCoachNote` reads `{ text }`. `listComments` merges comments and kudos (two tables) oldest first.
- `markSessionSeen` is stricter than the local adapter: the session has to exist (`not-found`) and the coach has to be linked to the athlete (`permission-denied`).
- `getAlertRules` answers `DEFAULT_ALERTS` until the coach saves their own (one row per coach).
- A coach's invite codes are stored only as a SHA-256 hash too, and last 14 days. The coach lists them with the code (to copy the link or revoke it), so each code is derived rather than random: an HMAC of the coach's id and the moment of creation under `AUTH_SECRET`. Rotating the secret breaks the links of invites still pending. `getCoachInvite` answers `null` for an unknown code; accepting or declining claims the invite in one conditional update (pending and unexpired), so it is answered once.
- Group sessions are state only. `endGroupSession` ends the session with empty `results` and a null `groupAverage`: athletes take part (and save their sessions) over the realtime channel, which isn't built yet.
- `joinWaitlist` is the one route without a session. The address is trimmed and lower-cased, stored once (a repeat answers the same), at most 254 characters; `source` at most 32.

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

Data methods that are not a single request:

- `watchGroupLive()` is meant to be a stream of about ten frames a second over a realtime channel (server-sent events or a WebSocket; not built yet). Until then it polls `GET /v1/group-sessions/{id}/live` every 2 s (`LIVE_POLL_MS`) for `{ status, presence }` and sends no frames: every athlete is `invited` until the session ends, then `left`. It stops when unsubscribed, when the session is over, or when the API refuses (not the host, no such session); it keeps trying after a lost connection. Unlike the local adapter it can't throw those refusals synchronously, so the screen sees them through `getGroupSession` first.
- `getWaveform()` takes a whole `SessionSummary`; the route uses its `athleteId` and `id`.

## Tests

- `http.test.ts`: the adapter with a fake `fetch` (requests, session state, error mapping, the data paths, `watchGroupLive`'s polling) and the route table against this README.
- `data.http.test.ts`: every DataService contract section (`../contract/*.contract.ts`: profile, sessions, coaching, coach tools, group sessions, waitlist) against the real API, with a temp `STORAGE_DIR`; `../contract/data.local.test.ts` runs them on the local adapter.
- `auth.http.test.ts`: the shared auth contract (`../contract/auth.contract.ts`) against the real API, started in-process on a free port with a temp migrated file database and a mailer that keeps emails in memory, so the tests follow the confirmation and reset links. No Docker. `../contract/auth.local.test.ts` runs the same suite on the local adapter.

Adding an HTTP client library is a new dependency and needs a person's approval first; the browser's `fetch` is enough.
