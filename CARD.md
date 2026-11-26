# T-0113 · feat: daily ring, streak with rest days and paused copy, milestones

Status: in progress
Branch: card/T-0113 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/03-launch-checklist.md J1, J2, J3; 01-product-spec.md §3.8; 02-onboarding-and-tailoring.md §5.1 (Gamification row), §7 (`preferences.gamification`), §8 (Streak paused copy)

## Why

Home shows a bare streak that drops to 0 after one missed day, Calm's daily ring is an empty slot, and there are no milestones. The spec wants a ring that closes at the planned minutes, a streak that survives one rest day a week and pauses (never "lost", no red), and milestones each shown once.

## Acceptance criteria

- [ ] A1: one pure module computes the ring (today's minutes vs `dailyMinutes`, the goal's default when unset), the streak (rest day per rolling 7 days, breaks, paused) and milestones (awarded once) · check: `npx vitest run src/lib/domain/habit.test.ts`
- [ ] A2: every `streakDays` caller (Home, results via record/live and session review) uses that one function; T-0108's `calmLine` and coaching lines unchanged · check: `npx vitest run src/app/cloud` (tone.test.ts, tailor.test.ts, AthleteHome.test.ts)
- [ ] A3: `preferences.gamification` (toggles, milestones awarded) is validated by the local adapter · check: `npx vitest run src/lib/backend/local`
- [ ] A4: Calm's Home shows the ring; a paused streak shows the goal's paused copy without red; a new milestone shows once · check: `PORT=3203 npx playwright test e2e/habit.spec.ts e2e/home-per-goal.spec.ts e2e/results-per-goal.spec.ts`
- [ ] A5: CI passes · check: `npm run check`

## Files in scope

- `src/lib/domain/habit.ts`, `src/lib/domain/habit.test.ts` (new)
- `src/lib/domain/types.ts` (additive `preferences.gamification` only)
- `src/app/cloud/home/**`, `src/app/cloud/home.css`
- `src/app/cloud/AthleteHome.tsx`, `src/app/cloud/AthleteHome.test.ts`
- `src/app/cloud/results/tone.ts` (only to switch to the shared streak function; no wording changes)
- `src/lib/backend/local/**` (validation + new test)
- `e2e/habit.spec.ts` (new)
- `CARD.md`

## Out of scope

- Gamification toggles in Settings (J7) and the calendar of rings in History (I8)
- Programs and the "first program" milestone's trigger (J5)
- Streak-at-risk reminders (no reminders are sent yet)

## Constraints

- No new dependencies. Static export. Screens use `useBackend()` / `useAuth()` only.
- `src/app/cloud/record/**` and `src/app/cloud/session/**` are not edited: they keep importing `streakDays` from `AthleteHome`, which delegates to the shared module.

## Skills

- none

## Next step

Build habit.ts with tests, then wire Home.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): additive contract field `preferences.gamification` only; existing tests may change where stated; no dependencies.

## Questions for me

## Parked

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"

### Evidence

```
```
