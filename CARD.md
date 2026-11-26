# T-0130 · fix: keep a coaching thread in write order when a comment and a kudos share a millisecond

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0130 · Held by: nobody
Created: 2026-11-26 · Source: lead's check on T-0128 (flaky contract test) and the T-0121 review suggestion "comment/kudos same-ms ordering tiebreak"

## Why

`GET /athletes/:athleteId/comments` merges two tables (comments, then kudos) and stable-sorts by
`createdAt` (ms). A kudos and a later comment written in the same millisecond come back with the
comment first, so a thread can show a reply above the kudos it followed. The shared contract test
"threads the athlete's and a scores-only coach's comments and kudos…" fails on the http adapter about 1 run in 7.

## Acceptance criteria

- [x] A1: a comment written in the same ms as (or a clock tick behind) the athlete's newest kudos lists after it, and a kudos after a comment likewise, per session and across sessions · check: `npx vitest run server/routes/coaching-feedback.test.ts` (and it fails with the route file reverted)
- [x] A2: concurrent comment/kudos writes for one athlete get distinct, strictly increasing `createdAt` · check: same test file
- [x] A3: the http contract test is stable · check: `npx vitest run src/lib/backend/http/data.http.test.ts -t "comments and kudos"` 10 times, all passing
- [x] A4: no regressions · check: `npx vitest run server` and `npm run check`

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

Done; the lead reviews and merges card/T-0130.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight full-queue note): lane 1; no new dependencies; no schema change.
- 2026-11-26: decided for the owner: the server sets a new comment's/kudos's `createdAt` to max(now, newest comment/kudos createdAt for that athlete + 1 ms), computed inside the INSERT (SQL subqueries), so SQLite's write lock serialises concurrent writers and no two get the same ms (alternative: read the newest time in JS then insert, which races under concurrent writes; or a shared sequence column as tiebreak, which needs a migration).
- 2026-11-26: the GET sort is unchanged; it is now total because createdAt is distinct per athlete. Seed and job fixtures write explicit times and are left alone.
- 2026-11-26: new test file `server/routes/coaching-feedback.test.ts` (in scope). The DB clock can't be frozen, so the test moves the earlier row to now + 60 s, which ties or beats any "now" the next write sees; that fails deterministically without the fix.

## Questions for me

- none

## Parked

- none

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified" (e2e not run: no user flow changed)
- [ ] Draft PR opened: # (not for this card: the lead merges; no PRs)

### Evidence

```
# A1/A2 without the fix (route file at d2c6b82, new test file in place):
$ npx vitest run server/routes/coaching-feedback.test.ts
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  server/routes/coaching-feedback.test.ts > a coaching thread > lists a comment written in the same millisecond as the kudos before it after that kudos
AssertionError: expected 1795715733690 to be greater than 1795715793683
 FAIL  server/routes/coaching-feedback.test.ts > a coaching thread > lists a kudos written in the same millisecond as the comment before it after that comment
AssertionError: expected 1795715734070 to be greater than 1795715794061
      Tests  2 failed | 1 passed (3)
(the concurrent test is probabilistic without the fix: on an earlier run it failed too, "expected 11 to be 14" distinct times)

# with the fix:
$ npx vitest run server/routes/coaching-feedback.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)

# A3: 10 runs in a row
$ npx vitest run src/lib/backend/http/data.http.test.ts -t "comments and kudos"   (x10)
run 1..10, each:      Tests  6 passed | 145 skipped (151)

# A4
$ npx vitest run server
 Test Files  18 passed | 1 skipped (19)
      Tests  208 passed | 1 skipped (209)

$ rm -rf playwright-report test-results && npm run check     (lint, typecheck, test, build)
exit 0
 Test Files  103 passed | 1 skipped (104)
      Tests  1420 passed | 1 skipped (1421)
✓ Compiled successfully; ✓ Generating static pages (27/27)

$ git diff --stat d2c6b82
  CARD.md                                 | 110 +++++++++++++++++++
  server/routes/coaching-feedback.test.ts | 181 ++++++++++++++++++++++++++++++++
  server/routes/coaching-feedback.ts      |  21 +++-
  3 files changed, 309 insertions(+), 3 deletions(-)
```
