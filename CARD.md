# T-0117 · feat: API data part 1: profile and preferences, sessions and waveforms through StorageService

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0117 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-08 (decisions 1, 7; "Repo layout"; "Tests": contract parity; libSQL override at the top)

## Why

The http adapter signs people in (I-07) but every `DataService` method still fails with "unavailable (I-08)",
so a `NEXT_PUBLIC_BACKEND=http` build can't show a profile or a session. The API also leaves the 16+ rule and
the consent records to the browser (T-0114's question). I-08 serves profile, preferences, sessions and
waveforms with the access rules enforced on the server, and proves it with shared contract sections.

## Acceptance criteria

- [x] A1: contract sections for profile/preferences, sessions and waveforms pass on local and on http (API in-process, temp file DB, temp STORAGE_DIR) · check: `npx vitest run src/lib/backend/contract src/lib/backend/http server`
- [x] A2: authz unit tests: own data, linked reader per scope (scores-only hides curves), revoked/no link denied · check: `npx vitest run server/authz.test.ts`
- [x] A3: fs StorageService: gzip JSON at the `waveformPath` key, refuses unsafe keys · check: `npx vitest run server/storage`
- [x] A4: sign-up via the API refuses under 16 and stores the consent records; profile writes validate preferences with the domain validators · check: `npx vitest run server/routes`
- [x] A5: CI green · check: `npm run check`

## Files in scope

- `server/authz.ts`, `server/authz.test.ts`
- `server/storage/**`
- `server/routes/{profile,sessions,waveforms}*.ts`, `server/routes/data*.ts` (shared route helpers, new)
- `server/index.ts` (mount), `server/env.ts` (STORAGE_DIR), `server/main.ts` (wire storage), `server/auth.ts` (sign-up hook: 16+ and consents)
- `server/db/schema/people.ts` + a new generated migration, only if strictly needed (logged)
- `src/lib/backend/http/**` (incl. `http.test.ts` where the I-08 stubs are replaced, logged)
- `src/lib/backend/contract/**` (new files)
- `CARD.md`

## Out of scope

- Coaching routes (links, invites, scope, revoke, comments: I-09); links are made directly in the test harness.
- Squads, alerts, groups, waitlist (I-10); seed (I-12); account deletion (I-15).
- Screens (`src/app/**`) and the local adapter (`src/lib/backend/local/**`).

## Constraints

- No new dependencies. File DBs only, never `libsql://`. Never read `.env.local`.
- `src/app/**`, `src/lib/domain/types.ts`, `src/lib/backend/local/**`, `src/lib/backend/types.ts`, `package.json` untouched.

## Skills

- `quality/deslop` — `/done` runs it

## Stop and ask

- A schema change beyond what storing `UserProfile` faithfully strictly needs.

## Next step

Lead: review and merge into night/2026-11-26; apply migration 0002 (`server/db/migrations/0002_pro_profile_details.sql`) to Turso. I-09 adds the coaching routes (links made for real) on the same `server/routes/data.ts` pattern and contract harness.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no new dependencies (zod, hono, drizzle are in); schema changes only if strictly needed under server/db/** with a new generated migration (logged; the lead applies it to Turso); `server/auth.ts` only for the sign-up hook that stores consents and checks 16+.
- 2026-11-26: schema change: `pro_profiles` gains nullable `sport_other`, `level`, `country` (`ProProfile` has them, the table didn't, so a professional's practice couldn't round-trip). Migration `0002_pro_profile_details.sql` generated with `drizzle-kit generate` (3 × `ALTER TABLE ADD`); `drizzle-kit check` clean. **Lead: apply 0002 to Turso.**
- 2026-11-26: `server/auth.ts`: 3 lines, `databaseHooks: { user: signUpHooks(deps.db) }`. The hooks (in `server/routes/profile.ts`) refuse under 16 at sign-up and on update-user (`ageGateProblem`), refuse consents that aren't every kind at its current version (`consentsProblem`), and after the user is created store the `profiles` row and one `consents` row per kind. Errors are Better Auth `{ code, message }` with the adapter's codes (`under-age`, `invalid-input`).
- 2026-11-26: decided for the owner: an API sign-up *without* `birthYear` or `consents` is still allowed (alternative: require both). Requiring them breaks existing tests in `server/routes/auth.test.ts` and `server/auth.mailpit.test.ts`, which I may not change; see Questions. The http adapter always sends both now.
- 2026-11-26: `server/main.ts` edited (1 import, 1 line) to pass `createFsStorage(env.storageDir)` to `createApp`; `server/env.ts` unchanged (`STORAGE_DIR` was already there, default `./data/blobs`, gitignored). Data routes mount at `/api/v1` only when `createApp` gets both `auth` and `storage`, so existing tests that build the app without them are unchanged.
- 2026-11-26: new files beyond the listed globs: `server/routes/data.ts` (session middleware, `fail()`, link lookup, mounts the three route files on one Hono instance so one error handler covers them), `src/lib/backend/http/data.ts`, `src/lib/backend/contract/data.harness.ts`.
- 2026-11-26: decided for the owner: data routes live at `/api/v1/...`; `HTTP_ROUTES.data` keeps its `/v1/...` paths and the adapter prefixes `/api` (`DATA_PREFIX`), so the route table, its README test and the `/v1/` path test stay as they are (alternative: write `/api/v1/` into `HTTP_ROUTES`).
- 2026-11-26: `sessions.ts` reuses `checkSessionContract` from `src/lib/backend/local/validate.ts` (imported, not edited) rather than duplicating it; preferences use `preferencesProblem`, `goalPlanProblem`, `onboardingProblem`, `gamificationProblem`, pro fields `proProblem`, from `src/lib/domain/**`. Untrusted input is shape-checked first (zod for the session and waveform; preferences must be an object with a `session` object) so the validators can't throw.
- 2026-11-26: decided for the owner: `getProfile` of someone else (either side of a link) leaves out `birthYear` and `consents` (alternative: the whole profile, as Firestore's rule would). `authz.canReadPrivateProfile`.
- 2026-11-26: decided for the owner: `saveSession` ignores a client's `groupSessionId` (the FK needs a stored group session, which is I-10) and always assigns `id`, `athleteId`, `waveformPath` itself; the note is trimmed and capped at 2000 on save and on update. Sending `{ session, waveform }` in one POST, body limit 6 MB, signal limit 5 MB (storage.rules).
- 2026-11-26: decided for the owner: a 401 from any data route signs the http adapter out (`HttpAuth.expire()` → `onAuthStateChanged(null)`); a 409 from a data route maps to `invalid-input`, `email-in-use` stays auth-only (`toBackendError(status, payload, "data")`).
- 2026-11-26: deleting a session deletes its row (comments, kudos and seen marks cascade by FK) and then its blob.
- 2026-11-26: existing test changed: `src/lib/backend/http/http.test.ts`, only where the I-08 stubs were replaced: the sign-up body now includes `consents`; "I-08: checks the consents but doesn't send them" became "sends the consents"; "I-08: every method fails" became three I-08 tests (paths and verbs under /api/v1, not-found → null, 409 isn't email-in-use) plus "I-09/I-10: every other method fails". README updated to match. No other existing test changed; `auth.http.test.ts` untouched (its harness is copied into `data.http.test.ts`).
- 2026-11-26: the contract harness makes coach links directly (local: the shared store; http: a `coach_links` row), because the coaching routes are I-09. Local runs every person as their own browser on one shared store (a store view with its own `currentUid`).
- 2026-11-26 (review fix, blocking): Better Auth's `/update-user` accepts every `input: true` field, so an athlete could make themselves a coach (skipping `canSetProFields`), set `proKind` or change `birthYear`. Now `databaseHooks.user.update.before` refuses any change to `role`, `proKind`, `birthYear` there (403 `permission-denied`; proKind changes only through PATCH /api/v1/users), and `create.before` refuses `proKind` at sign-up (400 `invalid-input`: a 403 at sign-up would become Better Auth's generic "account exists" answer), as firestore.rules does. Tests: http cases for each, and the profile contract's role/proKind/birthYear section now covers update-user through the harness's `updateAccount`.
- 2026-11-26 (review fix): existing tests changed because sign-up no longer takes `proKind`: `server/routes/auth.test.ts` ("creates the user with role and birth year…", "…the session carries the role") and `server/auth.mailpit.test.ts` drop `proKind` from the sign-up and expect `proKind: null`. "an unknown pro kind" is unchanged (still 400).
- 2026-11-26 (review fix): data routes take bodies up to 256 KB (`server/routes/data.ts`), except a saved session (6 MB, its signal); a changed note is now trimmed as well as capped.
- 2026-11-26 (integration fix, after merging night/2026-11-26 with T-0118): sign-up still validates and stores only the sign-up kinds (`CONSENT_KINDS`; other kinds sent at sign-up are ignored). PATCH /api/v1/users now takes `proConsents` with the local adapter's rules (professionals only, needs a proKind, `proTermsProblem`), appended once after sign-up's records; `consents` read back sign-up kinds first, then professional ones. `pro_profiles.default_targets` / `scope_requested` (existing columns) now store T-0118's `defaultTargets` / `scopeRequested`; a profile saved without a scope reads back `"scores"` (the column default). No schema change. New contract tests (local + http): terms recorded once with the kind's defaults; wrong kind, missing acknowledgement, sign-up kinds, no proKind refused; athlete refused. Checks: `npx vitest run src/lib/backend/contract src/lib/backend/http server` 318 passed, 1 skipped; `npm run check` exit 0, 1061 passed, 1 skipped, build 27/27.

## Questions for me

- [ ] Should the API *require* `birthYear` and `consents` at sign-up (today: checked and stored when given, so a direct API call can still skip both)? — Recommended: yes, in a small follow-up that also updates the four existing server auth tests that sign up without them. Options: keep optional; require only consents.
- [ ] Firestore's rule lets either side of a coach link read the whole profile; the API leaves out birth year and consents for the other side. Keep that? — Recommended: yes (less PII to coaches; no screen shows them). Options: return the whole profile like Firestore.

## Parked

- 2026-11-26 [product] `preferencesProblem` doesn't refuse unknown top-level keys, so a client can store arbitrary extra JSON in `profiles.preferences` (local and API alike) · seen on T-0117 · src/lib/domain/preferences.ts
- 2026-11-26 [product] the local adapter's `getWaveform` falls back to a generated signal for any session, so a deleted session's waveform still "exists" on local; the API answers not-found · seen on T-0117 · src/lib/backend/local/index.ts
- 2026-11-26 [product] seeded/demo sessions on http have no stored blobs until I-12's seed writes them through `StorageService` · seen on T-0117 · server/db/seed.ts (I-12)

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below; `server/main.ts` wiring and the new helper files, see Decisions)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
$ npx vitest run src/lib/backend/contract src/lib/backend/http server     # A1 (+ every server test)
 Test Files  17 passed | 1 skipped (18)          (skipped: auth.mailpit.test.ts without MAILPIT_E2E)
      Tests  294 passed | 1 skipped (295)
$ npx vitest run src/lib/backend/contract/data.local.test.ts src/lib/backend/http/data.http.test.ts
 Test Files  2 passed (2)
      Tests  72 passed (72)                      (32 contract tests on local, the same 32 + 8 API checks on http)
$ npx vitest run server/authz.test.ts                                     # A2
 Test Files  1 passed (1)
      Tests  9 passed (9)
$ npx vitest run server/storage                                           # A3
 Test Files  1 passed (1)
      Tests  11 passed (11)
$ npx vitest run server/routes                                            # A4 (sign-up 16+/consents also in data.http.test.ts)
 Test Files  2 passed (2)
      Tests  31 passed (31)
$ npx drizzle-kit check
 Everything's fine
$ npm run check                                                           # A5: lint, typecheck, tests, build; exit 0
 Test Files  76 passed | 1 skipped (77)
      Tests  970 passed | 1 skipped (971)
 ✓ Compiled successfully; 27/27 static pages
$ sanity: with canReadCurves allowing a scores link, authz.test.ts (2) and the http contract "scores-only coach ... curves" fail (then restored)
$ git diff --cached --stat   (30 files; 3035 of the lines are drizzle-kit's 0002_snapshot.json; non-test source ~830 lines incl. comments)
```

Review fix round:
$ npx vitest run src/lib/backend/contract src/lib/backend/http server
 Test Files  17 passed | 1 skipped (18)
      Tests  306 passed | 1 skipped (307)
$ npm run check   (playwright-report/ removed first); exit 0
 Test Files  78 passed | 1 skipped (79)
      Tests  993 passed | 1 skipped (994); build 27/27
$ sanity: with the update-user hook allowing role/proKind/birthYear, 7 tests in data.http.test.ts fail (then restored)

UNTESTED: migration 0002 on Turso (the lead applies it); the http adapter in a real browser against `npm run api:dev` (CORS, cookies across ports); a `NEXT_PUBLIC_BACKEND=http` build of the screens; no e2e (none for this lane).
