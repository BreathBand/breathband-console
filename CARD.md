# T-0107 · feat: schema for coaching, group, site, audit and later tables

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0107 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-04 (libSQL override at the top; "Schema" table and its Rules line)

## Why

T-0104 created the core tables. The API cards for coaching, group sessions, the waitlist, the
access log and the habit features need the rest of the spec's Schema table, migrated the same way.

## Acceptance criteria

- [ ] A1: the migrations build a fresh file DB, and 0001 applies on a DB that already has 0000 with rows in it · check: `TURSO_DATABASE_URL=file:./data/t0107.db npm run db:migrate; echo $?` is `0` (file deleted afterwards), plus the upgrade case in `server/db/schema-later.test.ts`
- [ ] A2: migrations match the schema · check: `npm run db:check`; `npm run db:generate` reports no changes
- [ ] A3: every new table takes and returns a row, and user deletion cascades (including `coach_invites` from both sides, and `verification` left alone) · check: `npx vitest run server/db/schema-later.test.ts`
- [ ] A4: CI green · check: `npm run check`

## Files in scope

- `server/db/schema/**`
- `server/db/migrations/**` (new `0001_*` and `meta/`)
- `server/db/schema-later.test.ts` (new)
- `CARD.md`

## Out of scope

- API routes or adapters that use these tables (I-08 and later).
- Changing `server/db/schema.test.ts` or `src/lib/domain/types.ts`.
- Running anything against Turso; the lead applies migrations there.

## Constraints

- No new dependencies. `src/**` and `package.json` untouched.
- Migration 0001 is additive only: no table rebuild of an existing table.
- File DBs only; never read `.env.local`.

## Skills

- `quality/deslop` — `/done` runs it

## Stop and ask

- Any change that makes drizzle-kit rebuild an existing table.

## Next step

Add the tables in `server/db/schema/`, generate 0001, write the new schema test.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): schema and migrations under `server/db/**` (local file DB).

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
```
