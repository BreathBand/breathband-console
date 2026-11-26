# T-0124 · feat: one program, Foundations (14 days), with progress

Status: in progress
Branch: card/T-0124 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/03-launch-checklist.md J5 (Demo: one); 01-product-spec.md §3.8 (programs, "first program" milestone); 02-onboarding-and-tailoring.md §5.1 (Programs promoted: Calm → Foundations (14 d)); 05-demo-plan.md (one program, Foundations)

## Why

There are no self-serve programs: Calm's Home has nothing to follow day by day, and the "first program" milestone exists but can never be earned. The demo shows one program, Foundations (14 days), with enrolment, today's session one tap away, and progress.

## Acceptance criteria

- [ ] A1: Foundations is static content: 14 days, each a session preset; day N's preset and its recorder address come from one data module · check: `npx vitest run src/lib/domain/programs.test.ts`
- [ ] A2: progress from sessions after enrolment: one program day per calendar day, consecutive and missed days (a missed day waits, never skips or resets), today done / next preview, finished · check: `npx vitest run src/lib/domain/programs.test.ts`
- [ ] A3: finishing awards the "first program" milestone, once · check: `npx vitest run src/lib/domain/habit.test.ts src/lib/domain/programs.test.ts`
- [ ] A4: enrolment is stored only in `preferences.gamification.program`, validated by the local adapter · check: `npx vitest run src/lib/backend/local`
- [ ] A5: enrol from Home, start day 1 in one tap with the simulated band, Home shows 1 of 14 · check: `PORT=3203 npx playwright test e2e/program.spec.ts e2e/habit.spec.ts e2e/home-per-goal.spec.ts`
- [ ] A6: CI passes · check: `npm run check`

## Files in scope

- `src/lib/domain/programs.ts`, `src/lib/domain/programs.test.ts` (new)
- `src/lib/domain/habit.ts` (award "first program"; accept `gamification.program` in its validator), `src/lib/domain/habit.test.ts` (new cases only)
- `src/lib/domain/types.ts` (additive inside `GamificationPreferences` only)
- `src/lib/backend/local/program.test.ts` (new)
- `src/app/cloud/home/**`, `src/app/cloud/AthleteHome.tsx`, `src/app/cloud/home.css`
- `e2e/program.spec.ts` (new)
- `CARD.md`

## Out of scope

- The other five programs (J4, content not written) and program authoring for professionals
- Naming the program day on the instrument (`src/app/cloud/record/**`) or the results
- Program reminders (no reminders are sent yet); the server's `programs`/`enrollments` tables

## Constraints

- No new dependencies. Static export. Screens use `useBackend()` / `useAuth()` only.
- `src/lib/domain/first-session.ts` is imported, never edited (T-0123). Scoring untouched.

## Skills

- none

## Next step

Build programs.ts and its tests, then the Home card and the e2e.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; additive only inside `preferences.gamification`; existing tests may change where stated; never change scoring.

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
