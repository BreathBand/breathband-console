# T-0125 · feat: seed the demo people into the database; db:reset

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0125 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-12 (demo people: planning/v1/05-demo-plan.md; data: `src/lib/backend/local/seed.ts`)

## Why

The API serves real accounts and data, but its database starts empty, so the http adapter has no demo people to sign
in as. I-12 writes the local adapter's demo people and data (accounts, profiles, links, sessions with stored
waveforms, coaching, mood check-ins) into the database, and adds `db:reset` for file databases.

## Acceptance criteria

- [ ] A1: reset then seed a file DB exits 0; a second seed exits 0 with no new rows · check: `TURSO_DATABASE_URL=file:./data/t0125.db npm run db:reset && TURSO_DATABASE_URL=file:./data/t0125.db npm run db:seed`, then `npm run db:seed` again (file deleted afterwards)
- [ ] A2: `db:reset` refuses anything but a `file:` URL · check: `TURSO_DATABASE_URL=libsql://example.turso.io npm run db:reset` exits non-zero without connecting
- [ ] A3: seeded Lena and Alex sign in with `breathband` through the real auth and read sessions and a waveform via the API; seeding twice gives the same row counts · check: `npx vitest run server/db/seed.test.ts`
- [ ] A4: CI green · check: `npm run check` (playwright-report/ and test-results/ removed first)

## Files in scope

- `server/db/seed.ts`, `server/db/seed/**` (new)
- `server/db/reset.ts` (new)
- new tests under `server/db/`
- `package.json` (scripts only)
- `CARD.md`

## Out of scope

- The new demo-plan people (Ana Ruiz, Jordan Lee, Chris Park) and their onboarding data: the local seed doesn't have them yet.
- Changing the local seed or synth (`src/**`), the routes or `server/auth.ts`.
- Running the seed against Turso (the lead does that).

## Constraints

- No new dependencies. File DBs only, never `libsql://`. Never read `.env.local`.
- Never delete non-demo data.

## Skills

- none

## Next step

Build `server/db/seed/**`, the two entry points and the test.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): package.json scripts only (`db:seed`, `db:reset`); no new dependencies.

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
