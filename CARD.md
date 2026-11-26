# T-0117 · feat: API data part 1: profile and preferences, sessions and waveforms through StorageService

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0117 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-08 (decisions 1, 7; "Repo layout"; "Tests": contract parity; libSQL override at the top)

## Why

The http adapter signs people in (I-07) but every `DataService` method still fails with "unavailable (I-08)",
so a `NEXT_PUBLIC_BACKEND=http` build can't show a profile or a session. The API also leaves the 16+ rule and
the consent records to the browser (T-0114's question). I-08 serves profile, preferences, sessions and
waveforms with the access rules enforced on the server, and proves it with shared contract sections.

## Acceptance criteria

- [ ] A1: contract sections for profile/preferences, sessions and waveforms pass on local and on http (API in-process, temp file DB, temp STORAGE_DIR) · check: `npx vitest run src/lib/backend/contract src/lib/backend/http server`
- [ ] A2: authz unit tests: own data, linked reader per scope (scores-only hides curves), revoked/no link denied · check: `npx vitest run server/authz.test.ts`
- [ ] A3: fs StorageService: gzip JSON at the `waveformPath` key, refuses unsafe keys · check: `npx vitest run server/storage`
- [ ] A4: sign-up via the API refuses under 16 and stores the consent records; profile writes validate preferences with the domain validators · check: `npx vitest run server/routes`
- [ ] A5: CI green · check: `npm run check`

## Files in scope

- `server/authz.ts`, `server/authz.test.ts`
- `server/storage/**`
- `server/routes/{profile,sessions,waveforms}*.ts`, `server/routes/data*.ts` (shared route helpers, new)
- `server/index.ts` (mount), `server/env.ts` (STORAGE_DIR), `server/main.ts` (wire storage), `server/auth.ts` (sign-up hook: 16+ and consents)
- `server/db/schema/people.ts` + a new generated migration, only if strictly needed (logged)
- `src/lib/backend/http/**` (incl. `http.test.ts` where the I-08 stubs are replaced, logged)
- `src/lib/backend/contract/**` (new files)
- `CARD.md`

## Out of scope

- Coaching routes (links, invites, scope, revoke, comments: I-09); links are made directly in the test harness.
- Squads, alerts, groups, waitlist (I-10); seed (I-12); account deletion (I-15).
- Screens (`src/app/**`) and the local adapter (`src/lib/backend/local/**`).

## Constraints

- No new dependencies. File DBs only, never `libsql://`. Never read `.env.local`.
- `src/app/**`, `src/lib/domain/types.ts`, `src/lib/backend/local/**`, `src/lib/backend/types.ts`, `package.json` untouched.

## Skills

- `quality/deslop` — `/done` runs it

## Stop and ask

- A schema change beyond what storing `UserProfile` faithfully strictly needs.

## Next step

Build authz + storage, then profile and sessions routes, then the adapter and contract sections.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no new dependencies (zod, hono, drizzle are in); schema changes only if strictly needed under server/db/** with a new generated migration (logged; the lead applies it to Turso); `server/auth.ts` only for the sign-up hook that stores consents and checks 16+.

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
