# T-0107 · feat: schema for coaching, group, site, audit and later tables

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0107 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-04 (libSQL override at the top; "Schema" table and its Rules line)

## Why

T-0104 created the core tables. The API cards for coaching, group sessions, the waitlist, the
access log and the habit features need the rest of the spec's Schema table, migrated the same way.

## Acceptance criteria

- [x] A1: the migrations build a fresh file DB, and 0001 applies on a DB that already has 0000 with rows in it · check: `TURSO_DATABASE_URL=file:./data/t0107.db npm run db:migrate; echo $?` is `0` (file deleted afterwards), plus the upgrade case in `server/db/schema-later.test.ts`
- [x] A2: migrations match the schema · check: `npm run db:check`; `npm run db:generate` reports no changes
- [x] A3: every new table takes and returns a row, and user deletion cascades (including `coach_invites` from both sides, and `verification` left alone) · check: `npx vitest run server/db/schema-later.test.ts`
- [x] A4: CI green · check: `npm run check`

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

Lead: review and merge into night/2026-11-26; apply 0001 to Turso with `node --env-file=.env.local --import tsx server/db/migrate.ts` (it includes two in-place `ALTER COLUMN` statements on `breath_sessions`, see Decisions).

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): schema and migrations under `server/db/**` (local file DB).
- 2026-11-26: new files, all in scope: `server/db/schema/{group,site,audit,habit}.ts` (one file per area, as the spec's repo layout says; habit = mood_checkins, milestones, programs, enrollments), `server/db/migrations/0001_coaching_group_site_audit.sql` + `meta/0001_snapshot.json`, `server/db/schema-later.test.ts`. `server/db/schema.test.ts` unchanged.
- 2026-11-26: decided for the owner: `breath_sessions.group_session_id` and `assignment_id` are now real FKs (`on delete set null`). drizzle-kit's turso dialect emits libSQL's in-place `ALTER TABLE ... ALTER COLUMN ... TO ...` for this, not a table rebuild; the test shows it applies on a 0000 DB with rows, keeps dangling legacy values readable and editable, and enforces the FK on new writes (alternative: keep them plain text; plain SQLite would not accept that statement, libSQL/Turso does).
- 2026-11-26: `SESSION_MODES` moved from `sessions.ts` to `columns.ts`: `sessions.ts` and `coaching.ts` now import each other, and a module-level value shared through either would be an import cycle. No SQL change.
- 2026-11-26: decided for the owner: `SessionComment` is split per the spec into `comments` (text) and `kudos` (no text, unique per session and author, so a second kudos is a no-op in the DB too); the API maps both back to `SessionComment.kind` (alternative: one table with `kind`).
- 2026-11-26: decided for the owner: `Squad.athleteIds` → `squad_members`; `GroupSession.athleteIds` and `results` → `group_participants` (`session_id` set null when the session is deleted); `alert_rules` as one row per coach with one column per rule (no row = `DEFAULT_ALERTS`) (alternative: a JSON column like `pro_profiles.default_flags`).
- 2026-11-26: decided for the owner: every user key cascades, including `access_log.viewer_id` (the spec's rule); `access_log.session_id` and `mood_checkins.session_id` are set null so the person's log survives deleting a session (alternative: viewer set null plus a copied viewer name, so the log outlives a deleted professional).
- 2026-11-26: decided for the owner: `programs` are content (id, unique slug, title, goal, days, steps JSON), not user-owned; `milestones` unique per (user, kind); `mood_checkins.mood` 1–5; `enrollments.status` active/finished/left. Loose JSON (`steps`, `progress`) until the program cards define them.

## Questions for me

## Parked

- 2026-11-26 [product] `verification` rows are keyed by email, not user id, so deleting an account leaves them to expire; the account-deletion route should delete them by identifier · seen on T-0107 · server/db/schema/auth.ts

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges, builders open no PRs)

### Evidence

```
$ TURSO_DATABASE_URL=file:./data/t0107.db npm run db:migrate; echo $?   (fresh file, then deleted)
Migrations applied to file:./data/t0107.db.
exit=0

$ (file:./data/t0107-base.db built from 0000 only, one user and one breath_session with group_session_id='legacy')
$ TURSO_DATABASE_URL=file:./data/t0107-base.db npm run db:migrate; echo $?   (then deleted)
Migrations applied to file:./data/t0107-base.db.
exit=0
__drizzle_migrations: 2 rows · breath_sessions row kept { id: 'bs1', group_session_id: 'legacy' } · 30 tables

$ grep -n "ALTER\|DROP\|__new\|PRAGMA" server/db/migrations/0001_coaching_group_site_audit.sql
216:ALTER TABLE `breath_sessions` ALTER COLUMN "group_session_id" TO "group_session_id" text REFERENCES group_sessions(id) ON DELETE set null ON UPDATE no action;
217:ALTER TABLE `breath_sessions` ALTER COLUMN "assignment_id" TO "assignment_id" text REFERENCES assignments(id) ON DELETE set null ON UPDATE no action;
(everything else is CREATE TABLE / CREATE INDEX)

$ npm run db:check
Everything's fine 🐶🔥

$ npm run db:generate
No schema changes, nothing to migrate 😴

$ npx vitest run server/db/
 Test Files  3 passed (3)
      Tests  22 passed (22)     (schema-later.test.ts: 10 new tests)

$ npm run check
exit=0
 Test Files  49 passed (49)
      Tests  524 passed (524)
✓ Compiled successfully in 2.2s
✓ Generating static pages using 23 workers (26/26) in 1558ms
(lint and typecheck printed no problems)

$ git diff --stat night/2026-11-26...HEAD (after commit) — only CARD.md and server/db/** files
```
