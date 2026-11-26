# T-0132 · ci: run the shared adapter suite on http against a file DB, and check migrations

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0132 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-11 (libSQL override at the top: "a file DB in CI" instead of a Postgres service)

## Why

CI runs `npm test`, which includes the shared contract suite on `http`, but nobody has proved
what CI actually runs, and CI never checks the migration chain (`db:check`, migrating a fresh
file DB from zero) or the server bundle that the infra cards rely on. A broken migration
would reach Turso before anything failed.

## Acceptance criteria

- [x] A1: what CI runs is shown: the http contract suite runs (not skipped) with no env and no secrets, and the one skipped file is named with its reason · check: `npx vitest run` (the whole suite, JSON report) in a clean env
- [x] A2: the http suite fails (does not skip) when the API can't start · check: a temporary local break of the harness's `beforeAll`, reverted, vitest exit code non-zero
- [x] A3: CI runs `npm run db:check` and migrates a fresh file DB from zero (`TURSO_DATABASE_URL=file:...`), so a broken migration chain fails the job; and `npm run build:server` · check: the CI steps simulated locally in order with `env -i` and no `.env.local`
- [x] A4: CI needs and prints no secret; the `libsql://` test guard stays · check: `grep` of ci.yml; `server/db/guard.ts` unchanged in `git diff`
- [x] A5: the workflow YAML parses · check: `node -e` with `js-yaml` (already in node_modules); `actionlint` not installed, so the run on GitHub is UNTESTED
- [x] A6: CI green locally · check: `npm run check` (playwright-report/ and test-results/ removed first)

## Files in scope

- `.github/workflows/ci.yml`
- `package.json` (new scripts only, if needed)
- test setup under `src/lib/backend/http/` or `server/`, only if a test is wrongly skipped
- `CARD.md`

## Out of scope

- Docker, Mailpit or Playwright e2e in CI (parked with an estimate).
- Lint config, existing scripts (`check` stays as it is), the `libsql://` guard.
- Anything against Turso.

## Constraints

- No new dependencies. File DBs only, never `libsql://`. Never read or print `.env.local`.
- CI must never need or print a secret.

## Skills

- `quality/deslop` — `/done` runs it.

## Stop and ask

- If a test is skipped in CI for a reason that needs a file outside scope to fix.

## Next step

Lead: review and merge into night/2026-11-26. The first PR after the merge shows the workflow running on GitHub (UNTESTED until then).

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight full-queue note): CI .github/workflows/ci.yml for I-11 only; no new dependencies.
- 2026-11-26: what CI ran before: lint, typecheck, `npm test`, build. `npm test` already ran the shared suite on http (`auth.http.test.ts` 22, `data.http.test.ts` 151 tests) against a temp migrated file DB with the dev-only auth secret, with no env needed. NOT run: `db:check`, migrating from zero outside the test harness, `build:server`, the bundled migrator, and nothing guarded against the http suite being skipped later.
- 2026-11-26: the one skipped file is `server/auth.mailpit.test.ts` (`describe.skipIf(!process.env.MAILPIT_E2E)`): it needs a running Mailpit (Docker), so it is skipped on purpose, not wrongly. No test is gated on `TURSO_*`, `SMTP_*` or Docker otherwise. No test setup file changed.
- 2026-11-26: the http suite fails, not skips, when the API can't start: an exception in its `beforeAll` marks the file failed and vitest exits 1 (probe in Evidence). No code change needed.
- 2026-11-26: decided for the owner: a guard step after the tests reads vitest's JSON report and fails unless both `src/lib/backend/http/*.http.test.ts` files ran with every test passed, so a future `skipIf` on the http suite fails CI (alternative: trust `npm test`'s exit code, which passes on skipped tests). `npm test` gets reporter flags in CI only; the `test` and `check` scripts are unchanged, so `package.json` is untouched.
- 2026-11-26: decided for the owner: CI also runs `build:server` and the bundled `build/server/migrate.mjs` on a second empty file DB (about 1 s together), since the production image migrates with that bundle (alternative: build only).
- 2026-11-26: decided for the owner: workflow-level `permissions: contents: read`; no `secrets.*` anywhere. AUTH_SECRET is never set in CI: tests use `authSecret("test", undefined)`, the dev-only constant. The `libsql://` guard (`server/db/guard.ts`, `server/db/test-setup.ts`) is unchanged.

## Questions for me

## Parked

- 2026-11-26 [tool] Mailpit in CI as a `services:` container plus `MAILPIT_E2E=1` for `server/auth.mailpit.test.ts`: about +1 min (image pull, one test file) · seen on T-0132 · .github/workflows/ci.yml
- 2026-11-26 [tool] Playwright e2e in CI (`npx playwright install --with-deps chromium`, 18 specs on the static build): estimate +4 to 7 min; `docker:smoke` on the production image another +3 to 5 min · seen on T-0132 · .github/workflows/ci.yml
- 2026-11-26 [tool] CI triggers on pushes to `main` and on PRs only: pushes to `night/*` or `develop` run nothing until a PR is opened · seen on T-0132 · .github/workflows/ci.yml
- 2026-11-26 [tool] `npm ci` reports audit findings (`npm audit`); not looked at · seen on T-0132 · npm ci

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not by builders; the lead opens no PRs)

### Evidence

```
# A1: what runs, clean env, .env.local renamed to .env.local.bak and restored afterwards
$ mv .env.local .env.local.bak; env -i PATH="$PATH" HOME="$HOME" CI=true npx vitest run --reporter=json --outputFile=$S/vitest.json; mv .env.local.bak .env.local
exit 0 · tests 1443, passed 1442, failed 0, skipped 1
skipped: /server/auth.mailpit.test.ts (1 test; MAILPIT_E2E unset)
ran: src/lib/backend/http/auth.http.test.ts 22/22, data.http.test.ts 151/151, http.test.ts 53/53,
     contract/auth.local.test.ts 18/18, contract/data.local.test.ts 127/127, every server/** file 0 skipped

# A2: the API can't start -> the job fails (probe line inserted into data.http.test.ts beforeAll, then `git checkout --` it)
$ env -i PATH="$PATH" HOME="$HOME" CI=true npx vitest run src/lib/backend/http/data.http.test.ts
Error: T-0132 probe: the API cannot start
 Test Files  1 failed (1)
      Tests  151 skipped (151)
vitest exit 1

# A3: every `run:` step of ci.yml in order (a node script reads the YAML, runs each step with `bash -e`,
# step env merged, ${{ runner.temp }} -> a fresh empty temp dir), env -i PATH HOME CI=true, .env.local renamed
# to .env.local.bak for the run and restored afterwards; build/, out/, playwright-report/, test-results/ removed first
== skip (action) actions/checkout@v5
== skip (action) actions/setup-node@v5
== npm ci                                              ok in 31.3 s
== npm run lint                                        ok in 13.0 s
== npm run typecheck                                   ok in 16.8 s
== npm run db:check   Everything's fine                ok in 1.6 s
== Migrate a fresh file DB from zero
   Migrations applied to file:C:/Windows/temp/ci-runner-temp-qHEP9b/ci-migrate.db.   ok in 1.5 s
== Unit and contract tests   (JSON report written)     ok in 54.0 s
== The http contract suite ran, nothing in it skipped
   http contract suite: 2 files, 173 tests, 0 not passed   ok in 0.1 s
== npm run build   (27/27 static pages)                ok in 16.1 s
== npm run build:server                                ok in 0.6 s
== Migrate a fresh file DB with the bundled migrator
   Migrations applied to file:C:/Windows/temp/ci-runner-temp-qHEP9b/ci-migrate-bundle.db.   ok in 0.5 s
all run steps passed · exit 0

# A3 negative: a broken migration fails the migrate step (bad ALTER appended to 0004, then `git checkout --` it)
$ env -i PATH="$PATH" HOME="$HOME" TURSO_DATABASE_URL="file:$T/probe.db" npm run db:migrate
LibsqlBatchError: SQLITE_ERROR: SQLITE_ERROR: no such table: no_such_table
migrate exit 1

# guard step negative: the step's script (extracted from ci.yml) on a report with one skipped http test
http contract suite: 2 files, 3 tests, 1 not passed
guard exit on a skipped http test: 1

# A4
$ node -e '<js-yaml load>; /secrets\./.test(JSON.stringify(workflow))'   -> secrets referenced: false
$ git diff --stat -- server/db/guard.ts server/db/test-setup.ts          -> (empty)

# A5
$ node -e 'require("js-yaml").load(fs.readFileSync(".github/workflows/ci.yml"))'
parsed: on= push,pull_request permissions= {"contents":"read"}; 12 steps listed in order
actionlint: not installed. The workflow run on GitHub: UNTESTED (runs only when a PR is opened).

# A6
$ rm -rf playwright-report test-results && npm run check
exit 0 · lint clean · typecheck clean · Test Files 104 passed | 1 skipped (105) · Tests 1442 passed | 1 skipped (1443) · build 27/27

$ git diff --stat 12a6ab7
 .github/workflows/ci.yml | 37 ++++++++++++++++++++++++++++++++++++-
 CARD.md                  | new (this card)
 2 files changed; package.json, server/**, src/** untouched
```
