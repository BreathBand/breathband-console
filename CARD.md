# T-0122 · feat: API data part 3: squads, alert rules, coach invites, group sessions (state), waitlist, mood check-ins

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0122 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-10 ("Shared suite passes in full on http")

## Why

After I-08 and I-09 the http adapter still fails every squad, alert-rule, coach-invite, group-session and
waitlist method with "unavailable", so a `NEXT_PUBLIC_BACKEND=http` build can't run the coach console.
I-10 serves the rest of DataService under `/api/v1` with the access rules on the server, and proves parity
with the local adapter in shared contract sections.

## Acceptance criteria

- [ ] A1: the whole shared contract suite passes on local and on http, with no DataService method left "unavailable" on http · check: `npx vitest run src/lib/backend/contract src/lib/backend/http server`
- [ ] A2: authz unit tests for each new rule · check: `npx vitest run server/authz.test.ts`
- [ ] A3: I-09 redeem hardening: the claiming UPDATE re-checks `expires_at > now`; invite creation retries on a code collision · check: `npx vitest run server src/lib/backend/http/data.http.test.ts`
- [ ] A4: CI green · check: `npm run check` (playwright-report/ and test-results/ removed first)

## Files in scope

- `server/routes/*.ts` (new files for squads, alert rules, coach invites, group sessions, waitlist; mounted in `server/routes/data.ts`)
- `server/routes/coaching.ts` (redeem hardening only)
- `server/authz.ts`, `server/authz.test.ts`
- new tests under `server/`
- `src/lib/backend/http/**` (incl. `http.test.ts`: the "unavailable" test goes once every method is served, logged)
- `src/lib/backend/contract/**`
- `server/db/**` only for a strictly needed generated migration (logged)
- `CARD.md`

## Out of scope

- Realtime for group sessions (the live channel, frames, athletes joining from their apps).
- Screens (`src/app/**`), the local adapter (`src/lib/backend/local/**`), `src/lib/domain/types.ts`, `package.json`.
- Seed (I-12), account deletion (I-15), CI on Postgres (I-11).

## Constraints

- No new dependencies. File DBs only, never `libsql://`. Never read `.env.local`.
- `getAlertRules` keeps answering DEFAULT_ALERTS when nothing is saved.

## Skills

- `quality/deslop` — `/done` runs it

## Stop and ask

- A schema change beyond what these areas strictly need.

## Next step

Build the routes, authz rules, adapter methods and contract sections; then run the checks.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no new dependencies; schema changes only if strictly needed (new generated migration, logged; the lead applies it to Turso); `http.test.ts`'s "unavailable" test may go once every method is served; harness changes in `src/lib/backend/contract/**` allowed.

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
