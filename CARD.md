# T-0114 · feat: http adapter AuthService against the API

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0114 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-07 (and "Tests": contract parity is the acceptance test)

## Why

The API has Better Auth at `/api/auth/*` (T-0111), but the `http` adapter is a stub that throws, so a
`NEXT_PUBLIC_BACKEND=http` build can't sign anyone in. I-07 implements `AuthService` over the API and
starts the shared adapter suite that proves `local` and `http` behave alike.

## Acceptance criteria

- [ ] A1: the http adapter implements `AuthService` (fetch with `credentials: "include"`, base URL from `NEXT_PUBLIC_API_BASE_URL`, session cache for `currentUser`/`onAuthStateChanged`, `callbackURL` on sign-up, `redirectTo` on reset, Better Auth errors mapped to `BackendError`) · check: `npx vitest run src/lib/backend/http`
- [ ] A2: a shared auth contract suite passes on `local` and on `http` (API in-process on an ephemeral port, temp migrated file DB, stub mailer) · check: `npx vitest run src/lib/backend/contract src/lib/backend/http`
- [ ] A3: gaps the API can't fill yet (consents on the profile, every `DataService` method) fail or are marked explicitly, naming I-08 · check: `npx vitest run src/lib/backend/http -t "I-08"`
- [ ] A4: CI green without Docker · check: `npm run check`

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

Build the adapter and the contract suite.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no new dependencies; `server/index.ts` / `server/auth.ts` only for test hooks if strictly needed; `vitest.config.mts` only if needed; the existing `http.test.ts` may change where the stub behaviour is replaced.

## Questions for me

## Parked

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
```
