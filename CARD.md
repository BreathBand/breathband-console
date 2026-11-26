# T-0126 · feat: account deletion and data export, with the 24 h deletion job

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0126 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-15; 03-launch-checklist.md B14, C6, C7; 01-product-spec.md §3.1 ("Delete account", "Download my data")

## Why

Nobody can delete their account or download their data through the API. Apple requires in-app
deletion, and the launch checklist needs "everything, within 24 h" and "download my data".

## Acceptance criteria

- [x] A1: `POST /api/v1/account/delete` (self only) marks the account, signs it out everywhere and hides its data at once; `POST /api/v1/account/delete/cancel` inside 24 h restores it · check: `npx vitest run server/routes/account.test.ts`
- [x] A2: after the job runs past 24 h every row and blob of the user is gone (cascades, waveforms, verification and waitlist rows by email), other users untouched; before 24 h nothing goes · check: `npx vitest run server/jobs/deletion.test.ts`
- [x] A3: `GET /api/v1/account/export` (self only) holds the user's rows from every table (the test lists the schema's tables) plus their waveforms, and no one else's private data (a coach's notes about them, seen marks, squads) · check: `npx vitest run server/routes/account.test.ts`
- [x] A4: the migration matches the schema · check: `npm run db:check`; `npm run db:generate` reports no changes
- [x] A5: CI green · check: `npx vitest run server` and `npm run check`

## Files in scope

- `server/routes/account.ts`, `server/routes/account-export.ts`, `server/routes/account.test.ts` (new)
- `server/jobs/**` (new)
- `server/routes/data.ts` (mount, the pending-deletion gate, `linkScope`)
- `server/routes/profile.ts` (`loadProfile` hides a pending account; added, see Decisions)
- `server/main.ts` (wire the job)
- `server/authz.ts`, `server/authz.test.ts` (if needed)
- `server/db/schema/**`, `server/db/migrations/**` (one additive table, if needed)
- `CARD.md`

## Out of scope

- The DataService side (`src/lib/backend/**`) and any screen: a question below.
- The "account deleted" and confirmation emails (L2 templates, `server/mailer.ts`).
- CSV of sessions in the export, and streaming large exports.

## Constraints

- No new dependencies (no node-cron: a plain `setInterval`). `src/**`, `package.json` and `server/db/seed*` untouched.
- File DBs only; never read `.env.local`; never a `libsql://` URL.

## Skills

- `quality/deslop` — `/done` runs it

## Stop and ask

- Any change to the DataService contract (`src/lib/backend/types.ts`).

## Next step

Lead: review and merge into night/2026-11-26; apply migration 0003 (one new table, `account_deletions`) to Turso; answer the DataService question below.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no new dependencies; a schema change only if strictly needed (generated migration under `server/db/**`, the lead applies it to Turso); the job on `setInterval`, not node-cron.
- 2026-11-26: schema: new table `account_deletions` (user_id PK, cascades from `user`; requested_at) in `server/db/schema/deletion.ts`, migration `0003_account_deletions.sql` (CREATE TABLE + index only). Needed to mark an account and time the 24 h. A table rather than a `user` column so Better Auth's user object doesn't carry it.
- 2026-11-26: new files: `server/routes/account-export.ts` (export queries, under the spec's `server/routes/account*`), `server/jobs/deletion.ts`, `server/jobs/fixture.ts` (a test fixture shared by both tests: the person in every table), `server/jobs/deletion.test.ts`, `server/routes/account.test.ts`. No existing test changed.
- 2026-11-26: `server/routes/profile.ts` touched (one join in `loadProfile`), outside the prompt's file list: without it a coach's athlete list (`coaching.ts` → `loadProfile`) keeps showing a pending account's name and email, so "hidden immediately" would not hold.
- 2026-11-26: decided for the owner: "hidden" = while a deletion waits, the owner reaches only `/api/v1/account/*` (status, cancel, export; 403 elsewhere); any data path naming them (`/users|athletes|coaches/{id}`, `/coach-links/..`) answers 404 to others; `linkScope` returns null if either side is pending, so no coach reads or coaches them; `loadProfile` returns null, so they drop off lists. Cancel restores all of it, since nothing is deleted until the job runs (alternative: revoke links at request time, which cancel couldn't undo).
- 2026-11-26: decided for the owner: `POST /account/delete` requires the account's password (`{ password }`, checked with Better Auth's hasher; wrong → 400 `invalid-credentials`), so a stolen cookie can't delete an account (alternative: the spec's "confirm by email" link, which needs the L2 email templates).
- 2026-11-26: decided for the owner: "sign out everywhere" = Better Auth's sign-out for this browser's cookies (Set-Cookie cleared) plus deleting every `session` row of the user. The person can sign in again during the 24 h to cancel or export.
- 2026-11-26: decided for the owner: cancel is refused (403) once 24 h have passed even if the job hasn't run yet; asking twice keeps the first request's time.
- 2026-11-26: decided for the owner: the job deletes blobs first (idempotent), then in one batch the verification rows (`value` = user id, as Better Auth's reset-password/delete-account rows store it, or `identifier`/`value` = email, the T-0107 park), the request row, the `user` row (everything else cascades, `access_log` included) and the waitlist row with their email (alternative: keep the waitlist entry as a separate sign-up). One failing account doesn't stop the others; it retries next run. Runs every 10 min from `main.ts`, at start too, never overlapping, `unref`'d, stopped on shutdown.
- 2026-11-26: decided for the owner: the export is JSON (`format: "breathband-export-v1"`, `tables` keyed by SQL table name, camelCase fields, `waveforms` by session id). In: everything the person owns, both sides of what they share (links, assignments, comments, kudos, coach invites, group sessions they host or joined, access log both ways), and their own coach working data (notes, seen marks, squads, alert rules). Out: other people's private data about them (a coach's notes, seen marks, squads), `verification` and `programs` (listed in `NOT_EXPORTED` with reasons), secrets (session tokens, password hash and OAuth tokens, invite code hashes), and the method per product spec principle 7 (`calibrations.a100/midline`; a waveform's calibration keeps only min and max). Alternative: export calibration values in full as the person's own data.
- 2026-11-26: fix round (review): the job claims a request before deleting anything (conditional UPDATE of a due `account_deletions` row to `requested_at` = epoch 0, proceed only on exactly one row), blobs only after the claim, and the final batch deletes the user only while the claimed row exists (verification/waitlist only once the user is gone). Cancel is one conditional DELETE of a request newer than 24 h; 0 rows → 403 if a request remains, else 404. A claimed request reads as requested at 1970 until the run finishes (decided for the owner; alternative: a `claimed_at` column, a schema change).
- 2026-11-26: `peopleInPath` also names `/coaches/{id}/seen/{athleteId}` (a coach's seen mark on a pending athlete now answers 404, was 403; my own test updated). `/coach-invites/{code}` needs a lookup, not a path match: parked.

## Questions for me

- [ ] The DataService has no account deletion or export (`src/lib/backend/types.ts`, the local adapter, its tests and `firestore.rules` must agree, and `firestore.rules` says deletion "runs in a Cloud Function"). Add `requestAccountDeletion(password)`, `cancelAccountDeletion()`, `getAccountDeletion()`, `exportMyData()` to DataService, the http adapter (routes above) and the local adapter in a follow-up card? — Recommended: yes, one card, with the settings screen. Options: API only until the app needs it; local adapter throws "unavailable".
- [ ] Should a calibration's a100/midline (and a waveform's calibration internals) be in "download my data"? — Recommended: no, as built (principle 7). Options: yes, in full (data-rights reading); yes, after counsel (N-items).

## Parked

- 2026-11-26 [product] the "account deleted" email and the spec's "confirm by email" are not sent: needs a mailer template (L2) and the mailer in DataDeps · seen on T-0126 · server/mailer.ts
- 2026-11-26 [product] "Download my data" CSV of sessions (01 §3.1) not built; the JSON export is built in memory (up to 5 MB per waveform), stream it for large accounts · seen on T-0126 · server/routes/account-export.ts
- 2026-11-26 [product] while an account waits for deletion, routes that don't name the person still show their id: a group session's `athleteIds`, a coach's squad members; a pending coach's group session stays readable by its athletes · seen on T-0126 · server/routes/group.ts, squads.ts
- 2026-11-26 [product] `/coach-invites/{code}` (read, respond) still works for an invite from a coach whose account waits for deletion: the coach is found by looking the code up, not in the path · seen on T-0126 · server/routes/coach-invites.ts
- 2026-11-26 [product] `POST /account/delete` checks the password with no rate limit of its own (Better Auth's limits cover /api/auth only) · seen on T-0126 · server/routes/account.ts
- 2026-11-26 [product] a coach invite sent to a deleted person by contact (email) stays with the coach (`coach_invites.contact`), as the coach's record · seen on T-0126 · server/db/schema/coaching.ts

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges, builders open no PRs)

### Evidence

```
$ npx vitest run server/jobs/deletion.test.ts server/routes/account.test.ts
 Test Files  2 passed (2)
      Tests  10 passed (10)
 (deletion: every row and blob of the person gone at 24 h, none at 24 h - 1 ms, everyone else's rows
  identical before and after; cancelled request untouched; failing account retried; timer runs.
  account: 401s; wrong password changes nothing; delete → cookies cleared, both sessions 401, owner 403
  outside /account, coach 404 on profile/sessions/waveform and off the list, cancel restores; late
  cancel 403 then job deletes and sign-in 401; export covers every schema table but NOT_EXPORTED,
  no "PRIVATE" coach data, no secrets, no a100/midline, own waveforms only.)
  Mutation check: with the job's verification delete removed, the deletion test fails ("verification still holds Ana").

$ npx vitest run server
 Test Files  15 passed | 1 skipped (16)
      Tests  179 passed | 1 skipped (180)

$ npm run db:check
Everything's fine 🐶🔥
$ TURSO_DATABASE_URL=file:./data/t0126-gen.db npm run db:generate   (file deleted afterwards)
No schema changes, nothing to migrate 😴
$ TURSO_DATABASE_URL=file:./data/t0126.db npm run db:migrate   (fresh file, deleted afterwards)
Migrations applied to file:./data/t0126.db.

$ rm -rf playwright-report test-results; npm run check; echo $?
exit=0
 Test Files  94 passed | 1 skipped (95)
      Tests  1331 passed | 1 skipped (1332)
✓ Compiled successfully
✓ Generating static pages using 23 workers (27/27)
(lint and typecheck printed no problems)

Fix round (claim + conditional cancel):
$ npx vitest run server
 Test Files  16 passed | 1 skipped (17)
      Tests  193 passed | 1 skipped (194)
 (new: "deletes nothing when the request was cancelled after the run picked the account",
  "deletes nothing for a request that isn't due by the run's clock",
  "refuse a cancel once the job has claimed the request, even from a clock behind the job's")
 Mutation: without the claim check (and a never-due sentinel) 4 tests fail.
$ rm -rf playwright-report test-results; npm run check → exit=0, 1345 passed | 1 skipped, build OK
$ npm run db:check → Everything's fine

e2e: not run (no user flow changed; no screen uses these routes yet). UNTESTED: the job inside a running
`npm run api:start` (main.ts wiring is covered by typecheck only).
```
