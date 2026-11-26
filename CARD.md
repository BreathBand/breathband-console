# T-0104 · feat: Drizzle with libSQL and the core schema

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0104 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-03 (re-cut for libSQL per the override at the top; "Schema" table and its Rules line)

## Why

The API cards (auth, routes, seed) need a database schema and migrations. Today there is no ORM,
no schema and no migration; I-02 only set up the file DB location and env names.

## Acceptance criteria

- [x] A1: `db:migrate` builds a fresh file DB · check: `TURSO_DATABASE_URL=file:./data/t0104-check.db npm run db:migrate; echo $?` is `0` (file deleted afterwards)
- [x] A2: migrations match the schema · check: `npm run db:check`
- [x] A3: every core table takes and returns a row · check: `npx vitest run server/db/schema.test.ts`
- [x] A4: the test guard refuses a `libsql://` URL · check: `npx vitest run server/db/guard.test.ts`
- [x] A5: CI unchanged and green · check: `npm run check`

## Files in scope

- `drizzle.config.ts` (new)
- `server/db/**` (new: client, schema, migrations, migrate script, test guard, tests)
- `package.json` (deps and `db:*` scripts; `check` unchanged)
- `package-lock.json`
- `vitest.config.mts` (pick up `server/**/*.test.ts`, setup file)
- `tsconfig.json`, `.gitignore` (only if needed)
- `CARD.md`

## Out of scope

- Installing or configuring Better Auth (card I-06); its tables are written by hand here.
- Coaching, group, site, audit and later tables (card I-04).
- Running anything against Turso; the lead applies migrations there.

## Constraints

- Only the approved dependencies, exact versions. No `.env*` loading by config, scripts or client.
- `src/**` untouched; `src/lib/domain/types.ts` is read-only.
- Never commit `data/` or any `.db` file.

## Skills

- `quality/deslop` — `/done` runs it

## Stop and ask

- Any need to read `.env.local` or use a `libsql://` URL.

## Next step

Lead: review and merge into night/2026-11-26; apply to Turso with `node --env-file=.env.local --import tsx server/db/migrate.ts`.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): dependencies `drizzle-orm`, `drizzle-kit`, `@libsql/client`, `tsx` (exact versions); schema and migrations under `server/db/**` on a local file DB; new package.json scripts.
- 2026-11-26: added files beyond the listed ones, all inside `server/db/**`: `env.ts` (URL from env only), `guard.ts` + `test-setup.ts` (refuse remote DBs in tests), `migrate.ts`, `schema/*.ts` (auth, people, devices, sessions, coaching, columns, index), `migrations/0000_core_schema.sql` + `meta/`, `schema.test.ts`, `guard.test.ts`.
- 2026-11-26: drizzle-kit loads `./.env` by itself (bundled dotenv), never `.env.local`; `drizzle.config.ts` throws if a `./.env` exists so nothing is picked up silently. `vitest.config.mts` sets `envDir: false` so Vite no longer reads `.env.local` during tests.
- 2026-11-26: decided for the owner: the test guard allows only `file:`, `:memory:` and http/ws on localhost (a local sqld); it refuses `libsql://` and Turso's https/wss forms (alternative: refuse `libsql://` only).
- 2026-11-26: decided for the owner: `coach_invites` included now, beside `invites`; both store `code_hash` as the primary key plus a `status` (alternative: leave coach_invites to I-04).
- 2026-11-26: decided for the owner: every user key cascades on user delete (including `coach_invites.athlete_id`); `breath_sessions.device_id`/`calibration_id` and `calibrations.device_id` are `set null`, so forgetting a band keeps sessions (alternative: cascade).
- 2026-11-26: decided for the owner: `user.role` defaults to `athlete`; `pro_kind` is `coach`/`clinician`/`educator` per 02 §7; `birth_year` nullable until the age step (alternative: required at sign-up).
- 2026-11-26: decided for the owner: `breath_sessions` also keeps `app_version` (in `SessionSummary`); `group_session_id`/`assignment_id` are plain text until I-04 creates those tables (alternative: add FKs then).
- 2026-11-26: decided for the owner: shapes with no domain type yet are loose JSON (`onboarding`, `goalDetails`, `reminders`, `calibrations.normal_reference` pending D-J) (alternative: define them now and risk guessing).
- 2026-11-26: no existing test changed; `src/**` untouched; domain types imported as types only.

## Questions for me

## Parked

- 2026-11-26 [tool] `npm audit` reports 4 moderate advisories (esbuild <=0.24.2 via drizzle-kit's @esbuild-kit loaders, dev-only); fix needs a drizzle-kit major · seen on T-0104 · `npm audit`
- 2026-11-26 [tool] on Windows libSQL keeps a file DB open until the process exits, so the schema test leaves its temp DB in %TEMP% (cleanup is best effort) · seen on T-0104 · server/db/schema.test.ts

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges, builders open no PRs)

### Evidence

```
$ TURSO_DATABASE_URL=file:./data/t0104-check.db npm run db:migrate; echo $?   (fresh file, then deleted)
Migrations applied to file:./data/t0104-check.db.
exit 0 (npm's own exit code)

$ npm run db:check
Everything's fine 🐶🔥

$ npx drizzle-kit generate   (schema and migration in sync)
No schema changes, nothing to migrate 😴

$ npx vitest run server/db/schema.test.ts server/db/guard.test.ts
 Test Files  2 passed (2)
      Tests  12 passed (12)

$ TURSO_DATABASE_URL=libsql://example.turso.io npx vitest run server/db/guard.test.ts   (setup refuses the run)
Error: Refusing to run tests against a remote database (TURSO_DATABASE_URL is not a file: URL). Tests use file databases only; unset it or point it at file:./data/<name>.db.
     22|       `Refusing to run tests against a remote database (${source} is n…

$ npm run check
exit 0 (npm's own exit code)
 Test Files  46 passed (46)
      Tests  503 passed (503)
✓ Compiled successfully in 369ms
✓ Generating static pages using 23 workers (26/26) in 1583ms
(lint and typecheck printed no problems)

$ git status --short
 M package-lock.json
 M package.json
 M vitest.config.mts
?? drizzle.config.ts
?? server/
```
