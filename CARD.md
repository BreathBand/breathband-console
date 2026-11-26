# T-0106 · feat: onboarding goal questions per track and the plan step

Status: done
Branch: card/T-0106 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §3.1 steps 5 and 7, §3.2–3.4, §7 (`goalDetails`, `dailyMinutes`, `reminders`); 03-launch-checklist.md D4, D5, D6, D8

## Why

Individual onboarding asks for a goal and then jumps to session settings: none of the track's own
questions (sport, exam dates, best time of day) are asked, and there is no plan with daily minutes
or a reminder time. Home, programs and reminders need those answers to tailor anything.

## Acceptance criteria

- [x] A1: each track's questions (Train, Focus, Calm) produce the expected `preferences.goalDetails` shape; skipping gives the track's defaults · check: `npx vitest run src/lib/domain/goal-questions.test.ts`
- [x] A2: the plan step produces `preferences.sessionsPerWeek`, `dailyMinutes` and `reminders`, prefilled from the track and the answers; skipping gives the track's defaults · check: same file
- [x] A3: the local adapter stores the new fields and refuses malformed ones; old preferences without them still save · check: `npx vitest run src/lib/backend/local/goal-plan.test.ts`
- [x] A4: in the browser, at least two tracks go end to end through goal questions and the plan step and land on Home with the answers stored · check: `PORT=3202 npx playwright test e2e/onboarding.spec.ts e2e/onboarding-tracks.spec.ts`
- [x] A5: everything else still passes · check: `npm run check`

## Files in scope

- `src/app/cloud/welcome/**`
- `src/lib/domain/types.ts` (additive: `goalDetails`, `dailyMinutes`, `reminders` on `UserPreferences` and the types they use)
- `src/lib/domain/goal-questions.ts`, `src/lib/domain/goal-questions.test.ts` (new)
- `src/lib/backend/types.ts`, `src/lib/backend/local/**` (validation and new tests; in the end only `local/index.ts` and the new `local/goal-plan.test.ts` changed)
- `firebase/firestore.rules` (only if access changes; it didn't)
- `e2e/onboarding.spec.ts` (where the flow changes), `e2e/onboarding-tracks.spec.ts` (new)
- `CARD.md`

## Out of scope

- The "invite your coach / teacher now" questions (they need the invite flow, D12).
- Sending reminders (email or push): the time is stored only.
- Home, programs and Record reading the answers (lane 1/3 areas); Settings editing them.

## Constraints

- No new dependencies. Static export stays. Screens use `useBackend()` / `useAuth()` only.
- `lib/domain/types.ts`: additive, optional fields only.

## Skills

- none

## Stop and ask

- If storing the answers needs a backend capability beyond `updateProfile`.

## Next step

Lead reviews and opens the draft PR; owner answers the questions below.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): additive contract fields `preferences.goalDetails`, `preferences.dailyMinutes`, `preferences.reminders` in `src/lib/domain/types.ts` (no renames/removals); existing tests may change where named; no dependencies; reminder time stored only.
- 2026-11-26: No backend capability changed: `updateProfile` already takes whole `preferences`, and `firebase/firestore.rules` lets a user update their own profile without checking preferences. So `lib/backend/types.ts` and the rules are untouched; the local adapter's `updateProfile` now also runs `goalPlanProblem` (new, in `src/lib/domain/goal-questions.ts`) next to `preferencesProblem`.
- 2026-11-26: Added `src/lib/domain/goal-questions.ts` (+ test), `src/app/cloud/welcome/GoalQuestions.tsx`, `PlanStep.tsx`: new modules this card creates. `src/lib/domain/preferences.ts` left alone.
- 2026-11-26: Existing test changed: `e2e/onboarding.spec.ts` now answers Calm's "When suits you best?" and passes through the new plan step (asserting the 21:30 reminder it prefills), because both steps now sit in the flow it walks. No other assertion changed.
- 2026-11-26: decided for the owner: `goalDetails` is a map per track (`{ train?, focus?, calm? }`); the current goal's entry applies, so switching goal in Settings can't leave a mismatched object (alternative: one object tagged with its goal). Onboarding writes only the chosen goal's entry.
- 2026-11-26: decided for the owner: Focus's mood check-in opt-in is stored as `goalDetails.focus.moodCheckins` (default yes), since only `goalDetails`, `dailyMinutes` and `reminders` were approved (alternative: spec §7's top-level `preferences.moodCheckins`, which needs its own approval).
- 2026-11-26: decided for the owner: `reminders` is `{ enabled, time "HH:MM", days, timeZone }`; the IANA time zone comes from the browser, because a stored local time is useless to a sender without it (alternative: time only).
- 2026-11-26: decided for the owner: step order follows the spec: Goal → goal questions → Experience → Sessions → Plan → Band → Done. Weekly goal moved from "Your sessions" into "Your plan"; sessions keeps mode, pacer, length, tones (alternative: one combined sessions-and-plan screen).
- 2026-11-26: decided for the owner: defaults. Skipping the questions stores the track's empty answers (Focus: mood check-in yes). Plan: sessions a week from the goal (Train 5, Focus 4, Calm 7; Train with training days = that count, 2–7); minutes a day = the goal's session length (10/3/3); reminders on, every day (Train: its training days), at 08:00 (Train by training time 08:00/12:30/18:30; Focus outside class, else 18:30; Calm by best time 08:00/12:30/18:30/21:30).
- 2026-11-26: decided for the owner: the "invite your coach / teacher now" questions (Train, Focus) are left out until onboarding has an invite flow (D12), per the spec's "every question has a consumer" (alternative: ask and store a yes/no now).
- 2026-11-26: decided for the owner: copy avoids promising what isn't built (no daily ring, exam countdown, mood results or Settings editing yet); the plan says "Reminders aren't sent yet. We'll use this time once they are."

## Questions for me

- [x] Reminders default to on (spec: skip default = track defaults). OK while nothing sends them, given the app asks notification permission after the first session? — Recommended: keep on, so the time is set when sending ships. Options: default off until sending exists.
  Answer: keep on, so the time is set when sending ships
- [ ] Should mood check-ins be a top-level `preferences.moodCheckins` (spec §7) rather than inside `goalDetails.focus`? — Recommended: move it when the mood check-in is built, as an additive field. Options: approve the top-level field now.

## Parked

- 2026-11-26 [product] Settings can't edit the goal answers, minutes a day or reminders, yet the welcome sidebar says "Everything here can be changed later in Settings." · seen on T-0106 · src/app/cloud/account/Preferences.tsx
- 2026-11-26 [product] Nothing reads `goalDetails`, `dailyMinutes` or `reminders` yet (Home ring, exam countdown, programs, reminder sending, mood check-in) · seen on T-0106 · planning/v1/02-onboarding-and-tailoring.md §5.1
- 2026-11-26 [product] The HTTP backend/server (lane 1) must accept and validate the new preference fields the same way (`goalPlanProblem`) · seen on T-0106 · src/lib/backend/http
- 2026-11-26 [product] The Flutter app must keep `goalDetails`, `dailyMinutes`, `reminders` when it writes preferences, or it will drop them · seen on T-0106 · ../breathband
- 2026-11-26 [product] Exam dates are personal (spec §7) and linked coaches can read the whole profile, preferences included · seen on T-0106 · src/lib/backend/local/index.ts getProfile

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead opens PRs)

### Evidence

```
$ npx vitest run src/lib/domain/goal-questions.test.ts src/lib/backend/local/goal-plan.test.ts --reporter=verbose
 ✓ goal-questions.test.ts > Train questions and plan > stores the answers under goalDetails.train, and the training days set the week and reminders
 ✓ goal-questions.test.ts > Train questions and plan > keeps a custom sport as free text
 ✓ goal-questions.test.ts > Focus questions and plan > stores the answers under goalDetails.focus and reminds outside class
 ✓ goal-questions.test.ts > Calm questions and plan > stores the answers under goalDetails.calm and reminds at the best time
 ✓ goal-questions.test.ts > the plan step > stores what was chosen, over the defaults
 ✓ goal-questions.test.ts > the plan step > keeps everything else in the preferences as it was
 ✓ goal-questions.test.ts > defaults when skipped > train / focus / calm: the track's defaults for the questions and the plan
 ✓ goal-questions.test.ts > defaults when skipped > planDefaults follows the answers given so far
 ✓ goal-questions.test.ts > goalPlanProblem > 5 tests: older profiles pass; unknown tracks, options, repeats; Train wants and sportOther; exam dates and mood; minutes and reminder
 ✓ goal-plan.test.ts > updateProfile with onboarding answers > stores the goal's answers, daily minutes and reminders, and reads them back
 ✓ goal-plan.test.ts > updateProfile with onboarding answers > still stores preferences without the new fields
 ✓ goal-plan.test.ts > updateProfile with onboarding answers > refuses malformed answers and keeps what was there
 Test Files  2 passed (2)   Tests  18 passed (18)

$ PORT=3202 npx playwright test e2e/onboarding.spec.ts e2e/onboarding-tracks.spec.ts
  ✓ onboarding.spec.ts › a new athlete is set up by onboarding and their goal sets their sessions (6.0s)
  ✓ onboarding-tracks.spec.ts › Train: sport, wants and training days shape the plan and are stored (6.3s)
  ✓ onboarding-tracks.spec.ts › Focus: exam dates, study and class times and the mood check-in are stored (4.5s)
  ✓ onboarding-tracks.spec.ts › Calm, skipping both steps: the track's defaults are stored (4.7s)
  4 passed (19.3s)   (Playwright's own dev server on 3202, stopped after; port free)

$ npm run check   (lint, typecheck, vitest, next build)
 EXIT=0 · Test Files 48 passed (48) · Tests 520 passed (520) · ✓ Compiled successfully · /cloud/welcome static

Phone width (375px), throwaway script against a dev server on 3202 (stopped after): Train and Focus
questions, plan and done steps have scrollWidth 375 = clientWidth 375 (no horizontal scroll);
screenshots looked at, not committed.

$ git diff --stat origin/card/T-0106 (before commit)
 e2e/onboarding.spec.ts, src/app/cloud/welcome/{page.tsx,welcome.css}, src/lib/backend/local/index.ts,
 src/lib/domain/types.ts: 5 files, +274 −23
 new: src/lib/domain/goal-questions.ts, src/lib/domain/goal-questions.test.ts, src/lib/backend/local/goal-plan.test.ts,
      src/app/cloud/welcome/GoalQuestions.tsx, src/app/cloud/welcome/PlanStep.tsx, e2e/onboarding-tracks.spec.ts

UNTESTED: firebase rules (unchanged, no emulator run); other e2e specs (demo-path, smoke, signup-consents) not run;
no axe run; dark theme not looked at.
```
