# T-0127 · feat: the demo people for v1: Maya (Calm), Ana Ruiz (clinician) and her client Jordan Lee, Chris Park (educator), Sam on Focus with an exam date

Status: in progress
Branch: card/T-0127 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/03-launch-checklist.md U2; the cast in planning/v1/05-demo-plan.md ("The people in the demo")

## Why

The demo script (05) needs one seeded person per track: a Calm user to sit beside Alex, a clinician with a client who came
through an invite, an educator with a class, and a Focus student with an exam coming up. Today the local seed has only
Lena's squad, so the script's people can't sign in.

## Acceptance criteria

- [ ] A1: each demo person has the profile fields the plan needs (Maya: Calm, ring, streak, a milestone; Ana: proKind clinician, proProfile, pro consents incl. the wellness acknowledgement; Chris: proKind educator, a class of 6 students 16+; Sam: Focus with an exam date and mood check-ins) · check: `npx vitest run src/lib/backend/local/seed-demo-people.test.ts`
- [ ] A2: Jordan is linked to Ana through an accepted invite, with her scopeRequested, an assignment from her templates and sessions · check: same test file
- [ ] A3: an existing v9 browser DB keeps user-recorded data and gains the new people (DB version 10) · check: `npx vitest run src/lib/backend/local/db-migrate.test.ts src/lib/backend/local/seed-demo-people.test.ts`
- [ ] A4: signing in as each new person shows their Home / dashboard as the plan describes (clinician sees "clients") · check: `PORT=3203 npx playwright test e2e/demo-people.spec.ts e2e/smoke.spec.ts e2e/demo-path.spec.ts e2e/home-per-goal.spec.ts e2e/pro-terminology.spec.ts`
- [ ] A5: the server seed carries the new people, their pro profiles and consents (seed parity) · check: `npx vitest run server/db`
- [ ] A6: CI passes · check: `npm run check`

## Files in scope

- `src/lib/backend/local/seed.ts`
- `src/lib/backend/local/db.ts` (version bump + migration)
- `src/lib/backend/local/seed-demo-people.test.ts` (new), `src/lib/backend/local/db-migrate.test.ts` (new cases only)
- `src/app/cloud/login/page.tsx` (demo buttons only)
- `e2e/auth.ts`, `e2e/demo-people.spec.ts` (new)
- `server/db/seed.ts`, `server/db/seed/**`, `server/db/seed.test.ts`
- `e2e/home-per-goal.spec.ts`, `e2e/mood.spec.ts` (name change only, see Decisions)
- `CARD.md`

## Out of scope

- Program enrolment (Foundations): programs (T-0124) aren't in this base.
- Lena's squad names ("Rowing 1st VIII") and the rest of Lena's and Alex's data.
- Demo script v2 in `docs/DEMO.md` (U1).

## Constraints

- No new dependencies, no contract changes (`src/lib/domain/types.ts` untouched), static export.

## Skills

- none

## Stop and ask

- A new field on the domain types would be needed.

## Next step

Build the seed, migration, login buttons and tests.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; no contract changes; existing tests may change only where the seed's counts/names change; DB version bump with an in-place migration.

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
