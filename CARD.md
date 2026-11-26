# T-0126 · feat: account deletion and data export, with the 24 h deletion job

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0126 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-15; 03-launch-checklist.md B14, C6, C7; 01-product-spec.md §3.1 ("Delete account", "Download my data")

## Why

Nobody can delete their account or download their data through the API. Apple requires in-app
deletion, and the launch checklist needs "everything, within 24 h" and "download my data".

## Acceptance criteria

- [ ] A1: `POST /api/v1/account/delete` (self only) marks the account, signs it out everywhere and hides its data at once; `POST /api/v1/account/delete/cancel` inside 24 h restores it · check: `npx vitest run server/routes/account.test.ts`
- [ ] A2: after the job runs past 24 h every row and blob of the user is gone (cascades, waveforms, verification and waitlist rows by email), other users untouched; before 24 h nothing goes · check: `npx vitest run server/jobs/deletion.test.ts`
- [ ] A3: `GET /api/v1/account/export` (self only) holds the user's rows from every table (the test lists the schema's tables) plus their waveforms, and no one else's private data (a coach's notes about them, seen marks, squads) · check: `npx vitest run server/routes/account.test.ts`
- [ ] A4: the migration matches the schema · check: `npm run db:check`; `npm run db:generate` reports no changes
- [ ] A5: CI green · check: `npx vitest run server` and `npm run check`

## Files in scope

- `server/routes/account.ts`, `server/routes/account.test.ts` (new)
- `server/jobs/**` (new)
- `server/routes/data.ts` (mount, the pending-deletion gate, `linkScope`)
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

Build `server/routes/account.ts` and `server/jobs/deletion.ts` with their tests.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no new dependencies; a schema change only if strictly needed (generated migration under `server/db/**`, the lead applies it to Turso); the job on `setInterval`, not node-cron.

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
