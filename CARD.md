# T-0104 · feat: Drizzle with libSQL and the core schema

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0104 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-03 (re-cut for libSQL per the override at the top; "Schema" table and its Rules line)

## Why

The API cards (auth, routes, seed) need a database schema and migrations. Today there is no ORM,
no schema and no migration; I-02 only set up the file DB location and env names.

## Acceptance criteria

- [ ] A1: `db:migrate` builds a fresh file DB · check: `TURSO_DATABASE_URL=file:./data/t0104-check.db npm run db:migrate; echo $?` is `0` (file deleted afterwards)
- [ ] A2: migrations match the schema · check: `npm run db:check`
- [ ] A3: every core table takes and returns a row · check: `npx vitest run server/db/schema.test.ts`
- [ ] A4: the test guard refuses a `libsql://` URL · check: `npx vitest run server/db/guard.test.ts`
- [ ] A5: CI unchanged and green · check: `npm run check`

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

Build: drizzle config, client, schema, first migration, migrate script, tests.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): dependencies `drizzle-orm`, `drizzle-kit`, `@libsql/client`, `tsx` (exact versions); schema and migrations under `server/db/**` on a local file DB; new package.json scripts.

## Questions for me

## Parked

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges, builders open no PRs)

### Evidence

```
<commands and results>
```
