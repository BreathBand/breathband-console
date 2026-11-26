# T-0132 · ci: run the shared adapter suite on http against a file DB, and check migrations

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0132 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-11 (libSQL override at the top: "a file DB in CI" instead of a Postgres service)

## Why

CI runs `npm test`, which includes the shared contract suite on `http`, but nobody has proved
what CI actually runs, and CI never checks the migration chain (`db:check`, migrating a fresh
file DB from zero) or the server bundle that the infra cards rely on. A broken migration
would reach Turso before anything failed.

## Acceptance criteria

- [ ] A1: what CI runs is shown: the http contract suite runs (not skipped) with no env and no secrets, and the one skipped file is named with its reason · check: `npx vitest run src/lib/backend/http src/lib/backend/contract server` in a clean env
- [ ] A2: the http suite fails (does not skip) when the API can't start · check: a temporary local break of the harness's `beforeAll`, reverted, vitest exit code non-zero
- [ ] A3: CI runs `npm run db:check` and migrates a fresh file DB from zero (`TURSO_DATABASE_URL=file:...`), so a broken migration chain fails the job; and `npm run build:server` · check: the CI steps simulated locally in order with `env -i` and no `.env.local`
- [ ] A4: CI needs and prints no secret; the `libsql://` test guard stays · check: `grep` of ci.yml; `server/db/guard.ts` unchanged in `git diff`
- [ ] A5: the workflow YAML parses · check: `node -e` with a YAML parser already in node_modules; the run on GitHub is UNTESTED
- [ ] A6: CI green locally · check: `npm run check` (playwright-report/ and test-results/ removed first)

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

Prove what CI runs (clean-env vitest run), then add db:check, migrate-from-zero and build:server steps to ci.yml.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight full-queue note): CI .github/workflows/ci.yml for I-11 only; no new dependencies.

## Questions for me

## Parked

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not by builders; the lead opens no PRs)

### Evidence

```
```
