# T-0113 · feat: daily ring, streak with rest days and paused copy, milestones

Status: done
Branch: card/T-0113 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/03-launch-checklist.md J1, J2, J3; 01-product-spec.md §3.8; 02-onboarding-and-tailoring.md §5.1 (Gamification row), §7 (`preferences.gamification`), §8 (Streak paused copy)

## Why

Home shows a bare streak that drops to 0 after one missed day, Calm's daily ring is an empty slot, and there are no milestones. The spec wants a ring that closes at the planned minutes, a streak that survives one rest day a week and pauses (never "lost", no red), and milestones each shown once.

## Acceptance criteria

- [x] A1: one pure module computes the ring (today's minutes vs `dailyMinutes`, the goal's default when unset), the streak (rest day per rolling 7 days, breaks, paused) and milestones (awarded once) · check: `npx vitest run src/lib/domain/habit.test.ts`
- [x] A2: every `streakDays` caller (Home, results via record/live and session review) uses that one function; T-0108's `calmLine` and coaching lines unchanged · check: `npx vitest run src/app/cloud` (tone.test.ts, tailor.test.ts, AthleteHome.test.ts)
- [x] A3: `preferences.gamification` (toggles, milestones awarded) is validated by the local adapter · check: `npx vitest run src/lib/backend/local`
- [x] A4: Calm's Home shows the ring; a paused streak shows the goal's paused copy without red; a new milestone shows once · check: `PORT=3203 npx playwright test e2e/habit.spec.ts e2e/home-per-goal.spec.ts e2e/results-per-goal.spec.ts`
- [x] A5: CI passes · check: `npm run check`

## Files in scope

- `src/lib/domain/habit.ts`, `src/lib/domain/habit.test.ts` (new)
- `src/lib/domain/types.ts` (additive `preferences.gamification` only)
- `src/app/cloud/home/**`, `src/app/cloud/home.css`
- `src/app/cloud/AthleteHome.tsx`, `src/app/cloud/AthleteHome.test.ts`
- `src/app/cloud/results/tone.ts` (only to switch to the shared streak function; no wording changes)
- `src/lib/backend/local/**` (validation + new test)
- New inside the globs: `src/app/cloud/home/DailyRing.tsx`, `src/app/cloud/home/Milestones.tsx`, `src/app/cloud/home/habit-copy.test.ts`, `src/lib/backend/local/gamification.test.ts`
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

Review and merge; then J7 (Settings toggles) can write `preferences.gamification.ring/streak/milestones`.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): additive contract field `preferences.gamification` only; existing tests may change where stated; no dependencies.
- 2026-11-26: `preferences.gamification` = `{ ring?, streak?, milestones?, awarded? }` (switches over the goal's defaults; milestones shown, with when). `MilestoneKey` added to types.ts. Validated by `gamificationProblem` in the local adapter's updateProfile. `lib/backend/types.ts` unchanged (updateProfile already carries preferences); `firestore.rules` unchanged (owner writes `users/{uid}`, no field checks; access unchanged).
- 2026-11-26: decided for the owner: a streak day is any day with a session (alternative: only closed-ring days, as breathband-docs gamification.md says). Keeps T-0108's results line and the demo's "streak starting" after a 2-minute first session.
- 2026-11-26: decided for the owner: the rest day is automatic (one per rolling 7 days, walked forward as lived), not a stored choice; rest days hold the run but don't add to its count; after a pause the count restarts at 1 and "Paused" shows no number (alternative: resume the old count on return).
- 2026-11-26: decided for the owner: unset `dailyMinutes` takes the goal's default session length (Train 10, Focus 3, Calm 3, as types.ts and planDefaults say); 5 only with no preferences (alternative: always 5, per 01 §3.8).
- 2026-11-26: decided for the owner: mechanics default per 02 §5.1 Gamification row (Train/Focus ring+streak, Calm ring+streak+milestones, clinician's client milestones only); the ring renders only in Calm's Home slot (Home row); the paused copy shows in the week card for every goal, Calm's greeting line (calmLine) is untouched.
- 2026-11-26: decided for the owner: "first calibration" = the first session (every session starts with one); "first program" is a valid key but never awarded until programs exist (J5). Milestones are marked shown the moment Home shows them; "Got it" only hides the card for that visit.
- 2026-11-26: `results/tone.ts` not edited: it takes `streakDays` as input. Its callers (`record/live/page.tsx`, `session/SessionReview.tsx`, out of scope) import `streakDays` from `AthleteHome`, which now re-exports the shared one from `lib/domain/habit.ts`.
- 2026-11-26: existing test changed: `AthleteHome.test.ts` "counts consecutive days back from today": the oldest fixture session moved 11-20 → 11-19, because a single missed day is now a rest day that holds the streak (the test still checks "3").

## Questions for me

## Parked

- 2026-11-26 [product] Calm's greeting line could carry the paused copy (today it says "Your next session takes three minutes." while the week card says paused) · seen on T-0113 · src/app/cloud/home/tailor.ts calmLine
- 2026-11-26 [product] Milestones are "collected in Programs" (breathband-docs gamification.md): no place lists past milestones yet · seen on T-0113 · src/app/cloud/home/Milestones.tsx

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"

### Evidence

```
$ npx vitest run src/lib/domain/habit.test.ts
 Test Files  1 passed (1)
      Tests  30 passed (30)

$ npx vitest run src/app/cloud src/lib          (A2, A3: tone, tailor, AthleteHome, local adapter incl. gamification.test.ts)
 Test Files  53 passed (53)
      Tests  624 passed (624)
$ npx vitest run src/app/cloud/home              (habit-copy.test.ts + tailor.test.ts)
 Test Files  2 passed (2)
      Tests  27 passed (27)

$ PORT=3203 npx playwright test e2e/habit.spec.ts e2e/home-per-goal.spec.ts e2e/results-per-goal.spec.ts
  ✓  e2e\habit.spec.ts › Calm's Home shows the daily ring, and new milestones once (7.1s)
  ✓  e2e\home-per-goal.spec.ts › Home differs for Train, Focus and Calm (8.6s)
  ✓  e2e\home-per-goal.spec.ts › someone linked to a professional sees their card first (2.2s)
  ✓  e2e\habit.spec.ts › a streak pauses after two missed days, in the goal's words and without red (9.7s)
  ✓  e2e
esults-per-goal.spec.ts › the results differ for Train and Calm: what leads, and the coaching line (2.2m)
  5 passed (2.3m)
  (screenshots attached in the Playwright report: habit-calm-ring-milestones, habit-calm-paused, habit-train-paused, habit-calm-375)

$ npm run check                                  (lint, typecheck, tests, build) exit 0
 Test Files  63 passed (63)
      Tests  709 passed (709)
✓ Compiled successfully
✓ Generating static pages (27/27)

$ git diff --stat a430505..950b92d -- . ':!CARD.md'
 e2e/habit.spec.ts                          | 102 ++++
 src/app/cloud/AthleteHome.test.ts          |   3 +-
 src/app/cloud/AthleteHome.tsx              |  37 ++---
 src/app/cloud/home.css                     |  69 ++++
 src/app/cloud/home/DailyRing.tsx           |  37 +++
 src/app/cloud/home/Milestones.tsx          |  54 ++++
 src/app/cloud/home/Slots.tsx               |   9 +-
 src/app/cloud/home/WeekCard.tsx            |  40 ++--
 src/app/cloud/home/habit-copy.test.ts      |  40 +++
 src/app/cloud/home/tailor.ts               |  26 +-
 src/lib/backend/local/gamification.test.ts |  40 +++
 src/lib/backend/local/index.ts             |   7 +-
 src/lib/domain/habit.test.ts               | 208 ++++++++
 src/lib/domain/habit.ts                    | 205 ++++++++
 src/lib/domain/types.ts                    |  19 +
 15 files changed, 863 insertions(+), 33 deletions(-)

UNTESTED: real Web Bluetooth band (simulated band only); Firebase adapter (not built).
```
