# T-0130 · fix: keep a coaching thread in write order when a comment and a kudos share a millisecond

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0130 · Held by: AB_Rouge
Created: 2026-11-26 · Source: lead's check on T-0128 (flaky contract test) and the T-0121 review suggestion "comment/kudos same-ms ordering tiebreak"

## Why

`GET /athletes/:athleteId/comments` merges two tables (comments, then kudos) and stable-sorts by
`createdAt` (ms). A kudos and a later comment written in the same millisecond come back with the
comment first, so a thread can show a reply above the kudos it followed. The shared contract test
"threads the athlete's and a scores-only coach's comments and kudos…" fails on the http adapter about 1 run in 7.

## Acceptance criteria

- [ ] A1: a comment written in the same ms as (or a clock tick behind) the athlete's newest kudos lists after it, and a kudos after a comment likewise, per session and across sessions · check: `npx vitest run server/routes/coaching-feedback.test.ts` (and it fails with the route file reverted)
- [ ] A2: concurrent comment/kudos writes for one athlete get distinct, strictly increasing `createdAt` · check: same test file
- [ ] A3: the http contract test is stable · check: `npx vitest run src/lib/backend/http/data.http.test.ts -t "comments and kudos"` 10 times, all passing
- [ ] A4: no regressions · check: `npx vitest run server` and `npm run check`

## Files in scope

- `server/routes/coaching-feedback.ts`
- new helper under `server/routes/` or `server/db/` (if needed)
- `server/routes/coaching-feedback.test.ts` (new)
- `CARD.md`

## Out of scope

- `src/lib/backend/contract/**`, `src/lib/backend/local/**` and existing tests (T-0129 owns them)
- a schema change or migration (e.g. a shared sequence column)
- the assignments list ordering

## Constraints

- No new dependencies. No schema change. Server only.

## Skills

- none

## Stop and ask

- if the fix needs a migration or the contract/local adapter files

## Next step

Make the server give each new comment/kudos a `createdAt` strictly after the athlete's newest one, in one SQL statement.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight full-queue note): lane 1; no new dependencies; no schema change.

## Questions for me

- none

## Parked

- none

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not for this card: the lead merges; no PRs)

### Evidence

```
<commands and results>
```
