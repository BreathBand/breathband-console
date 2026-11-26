# T-0127 · feat: the demo people for v1: Maya (Calm), Ana Ruiz (clinician) and her client Jordan Lee, Chris Park (educator), Sam on Focus with an exam date

Status: done
Branch: card/T-0127 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/03-launch-checklist.md U2; the cast in planning/v1/05-demo-plan.md ("The people in the demo")

## Why

The demo script (05) needs one seeded person per track: a Calm user to sit beside Alex, a clinician with a client who came
through an invite, an educator with a class, and a Focus student with an exam coming up. Today the local seed has only
Lena's squad, so the script's people can't sign in.

## Acceptance criteria

- [x] A1: each demo person has the profile fields the plan needs (Maya: Calm, ring, streak, a milestone; Ana: proKind clinician, proProfile, pro consents incl. the wellness acknowledgement; Chris: proKind educator, a class of 6 students 16+; Sam: Focus with an exam date and mood check-ins) · check: `npx vitest run src/lib/backend/local/seed-demo-people.test.ts`
- [x] A2: Jordan is linked to Ana through an accepted invite, with her scopeRequested, an assignment from her templates and sessions · check: same test file
- [x] A3: an existing v9 browser DB keeps user-recorded data and gains the new people (DB version 10) · check: `npx vitest run src/lib/backend/local/db-migrate.test.ts src/lib/backend/local/seed-demo-people.test.ts`
- [x] A4: signing in as each new person shows their Home / dashboard as the plan describes (clinician sees "clients") · check: `PORT=3203 npx playwright test e2e/demo-people.spec.ts e2e/smoke.spec.ts e2e/demo-path.spec.ts e2e/home-per-goal.spec.ts e2e/pro-terminology.spec.ts e2e/mood.spec.ts`
- [x] A5: the server seed carries the new people, their pro profiles and consents (seed parity) · check: `npx vitest run server/db`
- [x] A6: CI passes · check: `npm run check`

## Files in scope

- `src/lib/backend/local/seed.ts`
- `src/lib/backend/local/db.ts` (version bump + migration)
- `src/lib/backend/local/seed-demo-people.test.ts` (new), `src/lib/backend/local/db-migrate.test.ts` (new cases only)
- `src/app/cloud/login/page.tsx` (demo buttons only)
- `e2e/auth.ts`, `e2e/demo-people.spec.ts` (new)
- `server/db/seed.ts`, `server/db/seed/**` (rows.ts, write.ts), `server/db/seed.test.ts`
- `e2e/home-per-goal.spec.ts`, `e2e/mood.spec.ts` (name change only, see Decisions)
- `CARD.md`

## Out of scope

- New programs or program content (T-0124's Foundations is in the base now; Maya is enrolled through the seed only, see Decisions).
- Lena's squad names ("Rowing 1st VIII") and the rest of Lena's and Alex's data.
- Demo script v2 in `docs/DEMO.md` (U1).

## Constraints

- No new dependencies, no contract changes (`src/lib/domain/types.ts` untouched), static export.

## Skills

- none

## Stop and ask

- A new field on the domain types would be needed.

## Next step

Lead: review and merge into night/2026-11-26. Before a rehearsal, note Maya's "Seven days in a row" milestone shows once per browser (see Parked).

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; no contract changes; existing tests may change only where the seed's counts/names change; DB version bump with an in-place migration.
- 2026-11-26: Kept the interrupted night build (db.ts, seed.ts) after reading it; committed it as-is first (849143d), then merged `origin/night/2026-11-26` (T-0124, T-0126) with no conflicts. The night branch was still at DB version 9, so this card bumps 9 → 10 as written; package-lock.json unchanged (no `npm ci`).
- 2026-11-26: decided for the owner: Maya is enrolled in Foundations through the seed (`preferences.gamification.program`, startedAt 5 min before her first session), so her Home shows "10 of 14 days done", Day 11 next (alternative: not enrolled, Home offers "Start Foundations"). No new fields.
- 2026-11-26: decided for the owner: Lena's "Maya Chen" (demo-athlete-4) becomes Hana Mori (hana@demo.local) so the demo has one Maya; the Calm Maya is Maya Brooks, maya@demo.local, uid demo-maya (alternative: keep Maya Chen and give the Calm Maya another email).
- 2026-11-26: decided for the owner: the plan's Sam is Lena's Sam Okafor (demo-athlete-2), moved to Focus (exams, mood check-ins on), exam on the coming 15 December (moves with the seed day), six before/after check-ins; still in Lena's squad (alternative: a new Sam outside the squad).
- 2026-11-26: decided for the owner: Lena's unanswered invite for "Jordan Lee" is now for "Ruby Hale" (code RBHL7K2Q); Jordan Lee is Ana's client (accepted invite JLNA4R7K, scope = Ana's scopeRequested, the "Between visits" template as an assignment, 20 plan sessions over 3 weeks, Ana's comment, his reply, a kudos, a coach note).
- 2026-11-26: decided for the owner: Ana has the plan's two clients (Jordan, and Tom Becker, quiet for four days so "needs a look" has someone); her use cases are "between-visits" only. The night build also had "stress-anxiety" ("Stress and anxiety skills"), dropped because 05 says nothing clinical or condition-like on screen (alternative: keep it).
- 2026-11-26: decided for the owner: Chris's class is six Focus students born 2009/2010 (all 16+ this year, `ageGateProblem` passes), sharing scores only (his scopeRequested), in one group "Year 12 wellbeing"; Ana and Chris each have one session of their own.
- 2026-11-26: Migration 9 → 10 (`addDemoPeople` in db.ts): adds each new person only when their uid and email are free in that browser, and only the links, invites, plans, comments, notes and squad members whose people were all added; renames Hana, moves Sam (keeping any milestones he was shown) and renames Lena's invite only while each is still as the v9 seed left it. A stored v9 shape it can't extend reseeds.
- 2026-11-26: Server seed parity: rows.ts now writes `pro_profiles` and `consents` (fixed ids `demo-<uid>-consent-<kind>`, so reruns add nothing) and DEMO_UIDS is every seeded person; both tables joined SEED_TABLES. Ana's invites, like Lena's, get codes derived under AUTH_SECRET (seed with the API's secret).
- 2026-11-26: Existing tests changed (owner approval above, names/counts only): `db-migrate.test.ts` version literals 9 → 10 in four asserts (the bump); `e2e/home-per-goal.spec.ts` and `e2e/mood.spec.ts` "Maya Chen" → "Hana Mori" (and the MAYA const/helper renamed); `server/db/seed.test.ts` people counts 6 → `DEMO_PEOPLE.length` (18), 5 → 17, the skipped-coach link count 0 → 8 (Ana's and Chris's links still land), Lena's pending invite name Jordan Lee → Ruby Hale. New cases added in db-migrate.test.ts and seed.test.ts.

## Questions for me

## Parked

- Home's Milestones card marks a milestone shown the first time it renders, so Maya's waiting "Seven days in a row" is spent on the first sign-in in a browser (a rehearsal uses it up); the demo laptop needs a fresh local DB (clear site data) before the real run, or a "reset demo" action (U3).

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
$ npx vitest run src/lib/backend/local/seed-demo-people.test.ts          (A1, A2)
 Test Files  1 passed (1)
      Tests  10 passed (10)

$ npx vitest run src/lib/backend/local/db-migrate.test.ts src/lib/backend/local/seed-demo-people.test.ts   (A3)
 Test Files  2 passed (2)
      Tests  19 passed (19)

$ PORT=3203 npx playwright test e2e/demo-people.spec.ts e2e/smoke.spec.ts e2e/demo-path.spec.ts e2e/home-per-goal.spec.ts e2e/pro-terminology.spec.ts e2e/mood.spec.ts   (A4)
  17 passed (2.5m)

$ npx vitest run server/db          (A5)
 Test Files  4 passed (4)
      Tests  35 passed (35)

$ rm -rf playwright-report test-results && npm run check          (A6: lint, typecheck, tests, build)
 exit 0
 Test Files  100 passed | 1 skipped (101)
      Tests  1385 passed | 1 skipped (1386)
 ✓ Compiled successfully; static export

$ git diff --stat ff93706   (this card's work after the merge, before the card commit)
 e2e/auth.ts                              |  22 ++
 e2e/home-per-goal.spec.ts                |   4 +-
 e2e/mood.spec.ts                         |  16 +-
 server/db/seed.test.ts                   |  73 +++-
 server/db/seed.ts                        |   9 +-
 server/db/seed/rows.ts                   |  49 ++-
 server/db/seed/write.ts                  |  12 +
 src/app/cloud/login/page.tsx             |  24 +-
 src/lib/backend/local/db-migrate.test.ts | 119 +++++-
 src/lib/backend/local/db.ts              |   6 +-
 src/lib/backend/local/seed.ts            |  16 +-
 new: e2e/demo-people.spec.ts, src/lib/backend/local/seed-demo-people.test.ts
 (plus 849143d: db.ts +159, seed.ts +484, the interrupted night build)
 src/lib/domain/types.ts: untouched by this card.
```
