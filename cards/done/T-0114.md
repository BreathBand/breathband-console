# T-0114 · feat: http adapter AuthService against the API

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0114 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-07 (and "Tests": contract parity is the acceptance test)

## Why

The API has Better Auth at `/api/auth/*` (T-0111), but the `http` adapter is a stub that throws, so a
`NEXT_PUBLIC_BACKEND=http` build can't sign anyone in. I-07 implements `AuthService` over the API and
starts the shared adapter suite that proves `local` and `http` behave alike.

## Acceptance criteria

- [x] A1: the http adapter implements `AuthService` (fetch with `credentials: "include"`, base URL from `NEXT_PUBLIC_API_BASE_URL`, session cache for `currentUser`/`onAuthStateChanged`, `callbackURL` on sign-up, `redirectTo` on reset, Better Auth errors mapped to `BackendError`) · check: `npx vitest run src/lib/backend/http`
- [x] A2: a shared auth contract suite passes on `local` and on `http` (API in-process on an ephemeral port, temp migrated file DB, stub mailer) · check: `npx vitest run src/lib/backend/contract src/lib/backend/http`
- [x] A3: gaps the API can't fill yet (consents on the profile, every `DataService` method) fail or are marked explicitly, naming I-08 · check: `npx vitest run src/lib/backend/http -t "I-08"`
- [x] A4: CI green without Docker · check: `npm run check`

## Files in scope

- `src/lib/backend/http/**` (incl. `README.md`, `http.test.ts`: stub-behaviour tests replaced, see Decisions)
- `src/lib/backend/contract/**` (new)
- new test files under `src/lib/backend/`
- `server/index.ts`, `server/auth.ts`: test hooks only, if strictly needed (logged)
- `vitest.config.mts` only if needed
- `CARD.md`

## Out of scope

- `DataService` over HTTP (I-08..I-10) and moving `local.test.ts` sections into the shared suite.
- Screens: the sign-up "check your email" state, the reset page's "choose a new password" step (`src/app/**`).
- `.env.example`'s `NEXT_PUBLIC_API_URL` vs `NEXT_PUBLIC_API_BASE_URL` naming.

## Constraints

- No new dependencies. File DBs only, never `libsql://`. Never read `.env.local`.
- `src/app/**`, `src/lib/domain/types.ts`, `src/lib/backend/local/**`, `src/lib/backend/types.ts` untouched.

## Skills

- `quality/deslop` — `/done` runs it

## Stop and ask

- A change to `AuthService` / `BackendErrorCode` in `types.ts` (it's a public type): ask instead.

## Next step

Lead: review and merge into night/2026-11-26. I-08 adds the data routes, stores the sign-up consents (TODO(I-08) in src/lib/backend/http/auth.ts) and moves more sections into src/lib/backend/contract/.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no new dependencies; `server/index.ts` / `server/auth.ts` only for test hooks if strictly needed; `vitest.config.mts` only if needed; the existing `http.test.ts` may change where the stub behaviour is replaced.
- 2026-11-26: no edits to `server/**` or `vitest.config.mts`: the http contract test builds the API the way `server/auth.mailpit.test.ts` does (`createAuth` + `createApp`, `serve` on port 0, temp migrated file DB, in-memory mailer), and the existing `include` already picks up `src/**/*.test.ts`.
- 2026-11-26: new files: `src/lib/backend/http/{auth,client,routes}.ts`, `src/lib/backend/http/auth.http.test.ts`, `src/lib/backend/contract/auth.contract.ts`, `src/lib/backend/contract/auth.local.test.ts`. `HTTP_ROUTES` moved from `http/index.ts` to `http/routes.ts` (re-exported, same name) so `auth.ts` can use it without an import cycle.
- 2026-11-26: existing test changed: `http/http.test.ts`. Replaced because the stub behaviour is gone: "createHttpBackend throws" (now: returns the http kind and makes no request until auth state is asked for); `createBackend('http')` "throws the stub's error" / "build creates" (now: returns the http adapter, still without calling fetch); "a /v1/ path for every route" (now `/api/auth/` for auth, Better Auth's real routes, and `/v1/` for the data proposals). The route-count, README-table, backendKind and .env.example tests are unchanged. New tests added beside them (requests, session state, error mapping, I-08 gaps).
- 2026-11-26: `HTTP_ROUTES.auth` now lists Better Auth's routes (`/api/auth/get-session`, `sign-in/email`, `sign-up/email`, `request-password-reset`, `sign-out`) instead of the `/v1/auth/*` proposals; the README's "Auth is an open decision" section is gone (T-0111 settled it).
- 2026-11-26: the shared suite takes adapter differences as named traits, not skips: `confirmsEmail` (http: sign-in only after the emailed link; local: confirmed from the start) and `revealsEmailInUse` (http: a duplicate sign-up answers like a new one, Better Auth's anti-enumeration with `requireEmailVerification`; local: `email-in-use`). Both still assert no second account and the original password still works.
- 2026-11-26: decided for the owner: `EMAIL_NOT_VERIFIED` maps to `permission-denied` with the message "Confirm your email address first: we've sent you a new link." (alternative: a new `email-not-verified` code in `BackendErrorCode`, which changes `types.ts`; see Questions).
- 2026-11-26: decided for the owner: `onAuthStateChanged` on http waits for the first `get-session` read before its first callback (like Firebase's), so `BackendProvider` stays "loading" instead of flashing signed-out; `currentUser()` is `null` until then. A failed read counts as signed out (alternative: call back `null` at once, then the real state).
- 2026-11-26: decided for the owner: sign-up and sign-in send the relative `callbackURL: "/cloud/"` (the server's `callbackOnApp` points it at APP_URL); the reset request sends an absolute `redirectTo: <page origin>/cloud/reset/`, because the server doesn't rewrite that one (alternative: absolute callbackURL from `window.location.origin`, which breaks if the page origin isn't exactly APP_URL).
- 2026-11-26: decided for the owner: sign-up checks email shape, password length, age 16+ and consents in the adapter, in the local adapter's order, before calling the API; the consents are not sent (TODO(I-08)). Sign-out clears the local copy even when the request fails, and rethrows (alternative: keep the copy on failure).
- 2026-11-26: kept `NEXT_PUBLIC_API_BASE_URL` (the existing name, checked by `http.test.ts`); `.env.example` also has a `# NEXT_PUBLIC_API_URL=` line from the spec. Not touched (out of scope); see Questions.

## Questions for me

- [ ] The spec (04 "Local workflow") names the build-time base URL `NEXT_PUBLIC_API_URL`; the adapter and `http.test.ts` use the existing `NEXT_PUBLIC_API_BASE_URL`, and `.env.example` now carries both. Which name wins? — Recommended: keep `NEXT_PUBLIC_API_BASE_URL` and drop the `NEXT_PUBLIC_API_URL` line from `.env.example` (and say so in 04). Options: rename to `NEXT_PUBLIC_API_URL` everywhere.
- [ ] Add an `email-not-verified` code to `BackendErrorCode` (types.ts, a public type) so the login page can say "check your email" instead of the generic error? — Recommended: yes, with the onboarding/login card that builds the "check your email" screen. Options: keep `permission-denied` with a specific message.
- [ ] The API enforces neither the 16+ rule (it validates `birthYear` as a year only) nor stores consents at sign-up; today only the adapter checks them, so a direct API call skips both. — Recommended: I-08 adds both server-side (a `databaseHooks.user.create.before` age check in `server/auth.ts`, and consents written with the profile). Options: a separate card before I-08.

## Parked

- 2026-11-26 [product] on http, sign-up resolves without a session (email must be confirmed), but `/cloud/signup` stays busy waiting for CloudShell's redirect; it needs a "check your email" state · seen on T-0114 · src/app/cloud/signup/page.tsx
- 2026-11-26 [product] on http, an unconfirmed sign-in shows "Couldn't sign in. Check your connection" (login only special-cases `invalid-credentials`/`invalid-email`) · seen on T-0114 · src/app/cloud/login/page.tsx
- 2026-11-26 [product] the reset link lands on `/cloud/reset/?token=…`, but the page only requests a link; it needs the "choose a new password" step (POST /api/auth/reset-password), and `AuthService` has no method for it · seen on T-0114 · src/app/cloud/reset/page.tsx, src/lib/backend/types.ts
- 2026-11-26 [product] `AuthService` has no "resend confirmation email" method (Better Auth: POST /api/auth/send-verification-email); today an unconfirmed sign-in attempt resends · seen on T-0114 · src/lib/backend/types.ts

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
$ npx vitest run src/lib/backend/http                              # A1
 Test Files  2 passed (2)
      Tests  66 passed (66)
$ npx vitest run src/lib/backend/contract src/lib/backend/http     # A2: contract on local (18) and on http (19 + 3 API checks), API in-process
 Test Files  3 passed (3)
      Tests  84 passed (84)
$ npx vitest run src/lib/backend/http -t "I-08"                    # A3
 Test Files  1 passed | 1 skipped (2)
      Tests  2 passed | 64 skipped (66)
$ npm run check                                                    # A4: lint, typecheck, tests, build (no Docker running)
 Test Files  65 passed | 1 skipped (66)
      Tests  789 passed | 1 skipped (790)
 ✓ Compiled successfully; 27/27 static pages; exit 0
$ git diff --cached --stat   (10 files, all in scope: CARD.md, src/lib/backend/http/**, src/lib/backend/contract/**)
$ sanity: with signOut's request removed, the http contract fails "stays signed out after a reload" (then restored)
```

UNTESTED: the adapter in a real browser against `npm run api:dev` (CORS preflight, cookies across ports 3000/8787); a `NEXT_PUBLIC_BACKEND=http` build; no e2e (none for this lane).
