# T-0125 · feat: seed the demo people into the database; db:reset

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0125 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-12 (demo people: planning/v1/05-demo-plan.md; data: `src/lib/backend/local/seed.ts`)

## Why

The API serves real accounts and data, but its database starts empty, so the http adapter has no demo people to sign
in as. I-12 writes the local adapter's demo people and data (accounts, profiles, links, sessions with stored
waveforms, coaching, mood check-ins) into the database, and adds `db:reset` for file databases.

## Acceptance criteria

- [x] A1: reset then seed a file DB exits 0; a second seed exits 0 with no new rows · check: `TURSO_DATABASE_URL=file:./data/t0125.db npm run db:reset && TURSO_DATABASE_URL=file:./data/t0125.db npm run db:seed`, then `npm run db:seed` again (file deleted afterwards)
- [x] A2: `db:reset` refuses anything but a `file:` URL · check: `TURSO_DATABASE_URL=libsql://example.turso.io npm run db:reset` exits non-zero without connecting
- [x] A3: seeded Lena and Alex sign in with `breathband` through the real auth and read sessions and a waveform via the API; seeding twice gives the same row counts · check: `npx vitest run server/db/seed.test.ts`
- [x] A4: CI green · check: `npm run check` (playwright-report/ and test-results/ removed first)

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

Done; the lead merges, then runs `db:migrate` + `db:seed` against Turso (blobs land in the lead's STORAGE_DIR).

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): package.json scripts only (`db:seed`, `db:reset`); no new dependencies.
- 2026-11-26: The seed reuses `createSeededDb` (local/db.ts) plus `generateWaveform`, so links, scopes, targets, coaching, squads, the coach invite and mood check-ins are exactly the local adapter's — the coach-link scopes and targets live in db.ts, not seed.ts.
- 2026-11-26: decided for the owner: session ids are `<athleteId>-<localId>` (e.g. `demo-athlete-s001`) because local ids repeat across athletes and `breath_sessions.id` is the primary key; other local ids get a `demo-` prefix (alternative: random UUIDs, which would break idempotency).
- 2026-11-26: decided for the owner: insert-only, per row, on fixed keys; an existing demo uid is left as it is (not upserted), and a demo email held by another account skips that person and everything naming them (alternative: upsert demo rows, which would overwrite changes made during a demo).
- 2026-11-26: decided for the owner: `db:seed -- --refresh` removes the demo uids first (cascade) and their blobs, then reseeds, so sessions sit relative to today before the 10 Dec demo (alternative: no refresh; on Turso the seeded dates would age).
- 2026-11-26: Passwords use `better-auth/crypto` `hashPassword` (Better Auth's default hasher, the one `server/auth.ts` uses) on a `credential` account; emails verified. No consents/birth year: the local seed has none (accounts without them are allowed).
- 2026-11-26: No pro profiles seeded: the local seed's people have no `proKind`.
- 2026-11-26: A seeded session whose blob is missing (e.g. a DB seeded from another machine) gets its signal rewritten on the next seed; no new row.
- 2026-11-26 (integration fix after T-0122 merged): the demo coach invite uses T-0122's scheme: code = HMAC(AUTH_SECRET, "coach-invite\0coachId\0createdAtMs") cut to 8 chars (`codeFrom`), stored as `hashCode(code)` from routes/codes.ts. The route's `codeOf` is a closure and not exported (routes are out of scope), so `coachInviteCode` in server/db/seed/rows.ts repeats the formula; seed.test.ts proves the API lists the seeded invite with a code that opens and revokes it. `seedDemo` takes `secret`; the CLI uses `authSecret()` (AUTH_SECRET, or the dev-only one outside production), so seed with the API's AUTH_SECRET. The invite's key moves with `now`, so it counts as present when the coach already has one for the same name and contact (idempotent). The local code "JRDN7K2Q" is not kept.
- 2026-11-26: `db:reset` deletes the file and its `-wal`/`-shm`/`-journal` siblings, then migrates; blobs under STORAGE_DIR are left (the seed rewrites the demo's).

## Questions for me

## Parked

- 2026-11-26 [product] Demo-plan people Ana Ruiz, Jordan Lee, Chris Park (and Sam's exam / Maya's Calm track from 05-demo-plan) aren't in the local seed yet, so not in the DB seed either · seen on T-0125 · planning/v1/05-demo-plan.md
- 2026-11-26 [product] On Turso, waveforms are written to the seeding machine's STORAGE_DIR; another machine reading the same DB won't find them until it runs db:seed (which restores missing demo blobs) · seen on T-0125 · server/db/seed/write.ts

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified" (nothing run against Turso; the http demo e2e is UNTESTED, it isn't in this card)
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
# A1 (TURSO_DATABASE_URL=file:./data/t0125.db)
$ npm run db:reset && npm run db:seed
Reset file:./data/t0125.db and applied the migrations.
Seeded file:./data/t0125.db: 252 new rows, 103 signals written.
  user 6 · account 6 · profiles 6 · breath_sessions 103 · coach_links 5 · assignments 4 · comments 3
  kudos 2 · seen_sessions 95 · coach_notes 2 · squads 2 · squad_members 5 · coach_invites 1 · mood_checkins 12
$ npm run db:seed
Seeded file:./data/t0125.db: 0 new rows, 0 signals written.      (every table 0)
reset=0 seed=0 seed2=0; data/t0125.db* and data/blobs deleted afterwards
$ npm run db:seed -- --refresh   → Removed 6 demo people first. 252 new rows, 103 signals written.

# A2
$ TURSO_DATABASE_URL=libsql://example.turso.io npm run db:reset
db:reset works on file databases only (TURSO_DATABASE_URL=file:./data/<name>.db). Refusing to reset this one.
exit=1

# A3
$ npx vitest run server/db/seed.test.ts
 Tests  10 passed (10)
 (Lena signs in with "breathband", lists athletes, reads Alex's sessions = local seed's count/ids/scores,
  reads a waveform equal to the local generateWaveform; Alex reads own sessions, a waveform, coach, comments;
  wrong password 401; second run on another day: 0 inserts, same row counts in every table; missing blob
  restored with no new row; --refresh: same inserts, same counts, a non-demo user kept; a taken demo email
  is skipped with its links; db:reset refuses libsql/https/http/:memory: and drops + migrates a file DB)

# A4
$ rm -rf playwright-report test-results && npm run check
lint ok · typecheck ok · Test Files 92 passed | 1 skipped (93) · Tests 1216 passed | 1 skipped (1217)
✓ Compiled successfully; static export built. exit=0

# Re-run after merging night/2026-11-26 (T-0122) and the coach-invite fix
$ npm ci && rm -rf playwright-report test-results
$ npx vitest run server            → Test Files 14 passed | 1 skipped · Tests 180 passed | 1 skipped
$ npx vitest run server/db/seed.test.ts → Tests 11 passed (11) (new: the seeded coach invite is listed by the API
   with an 8-char code; Alex opens it by code; the coach revokes it by code)
$ npm run check                    → exit 0 · Test Files 93 passed | 1 skipped · Tests 1332 passed | 1 skipped · build ok
$ A1 again: reset=0 seed=0 (252 new rows, coach_invites 1) seed2=0 (0 new rows); file + blobs deleted
$ A2 again: libsql:// reset exit=1

$ git diff --stat main...  (this card)
 CARD.md, package.json (+2 scripts), server/db/reset.ts, server/db/seed.ts, server/db/seed.test.ts,
 server/db/seed/{rows,write,reset}.ts
```
