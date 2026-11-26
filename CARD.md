# T-0121 · feat: API data part 2: coach links, invites, scopes, revoke, assignments, comments, kudos, seen, notes, targets

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0121 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-09 ("Tests": contract parity incl. every permission case)

## Why

I-08 serves profile, sessions and waveforms over `/api/v1`, but every coaching method of the http adapter still
fails with "unavailable", and the contract harness makes coach links by writing them directly. I-09 serves coach
links, invites, scope, revoke, assignments, comments, kudos, seen marks, private notes and targets with the access
rules on the server, and proves parity with the local adapter in shared contract sections.

## Acceptance criteria

- [ ] A1: contract sections for links/invites/scope/revoke, notes, seen, targets, assignments, comments and kudos pass on local and http, covering own vs linked vs unlinked vs revoked, scores-only vs curves, private notes never visible to the athlete · check: `npx vitest run src/lib/backend/contract src/lib/backend/http server`
- [ ] A2: authz unit tests for each new rule · check: `npx vitest run server/authz.test.ts`
- [ ] A3: invite codes are stored only as hashes, expire, and redeem once (API checks) · check: `npx vitest run src/lib/backend/http/data.http.test.ts`
- [ ] A4: CI green · check: `npm run check` (playwright-report/ and test-results/ removed first)

## Files in scope

- `server/routes/coaching*.ts` (new), `server/routes/data.ts` (one line: mount them on the data routes' Hono instance)
- `server/authz.ts`, `server/authz.test.ts`
- `server/index.ts` (mount, if needed)
- new tests under `server/`
- `src/lib/backend/http/**` (incl. `http.test.ts` where the I-09 stubs are replaced, logged)
- `src/lib/backend/contract/**` (new sections; harness changes)
- `server/db/**` only for a strictly needed generated migration (logged)
- `CARD.md`

## Out of scope

- Squads, alert rules, coach invites (coach → athlete), group sessions, waitlist (I-10).
- Screens (`src/app/**`), the local adapter (`src/lib/backend/local/**`), `src/lib/domain/types.ts`.
- Seed (I-12), account deletion (I-15).

## Constraints

- No new dependencies. File DBs only, never `libsql://`. Never read `.env.local`.
- `src/app/**`, `src/lib/domain/types.ts`, `src/lib/backend/local/**`, `src/lib/backend/types.ts`, `package.json` untouched.

## Skills

- `quality/deslop` — `/done` runs it

## Stop and ask

- A schema change beyond what the coaching tables strictly need.

## Next step

Build the coaching routes, the http adapter methods and the contract sections.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no new dependencies; schema changes only if strictly needed (new generated migration under server/db/**, logged; the lead applies it to Turso); harness changes in `src/lib/backend/contract/**` allowed.

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
