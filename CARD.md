# T-0106 · feat: onboarding goal questions per track and the plan step

Status: in progress
Branch: card/T-0106 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §3.1 steps 5 and 7, §3.2–3.4, §7 (`goalDetails`, `dailyMinutes`, `reminders`); 03-launch-checklist.md D4, D5, D6, D8

## Why

Individual onboarding asks for a goal and then jumps to session settings: none of the track's own
questions (sport, exam dates, best time of day) are asked, and there is no plan with daily minutes
or a reminder time. Home, programs and reminders need those answers to tailor anything.

## Acceptance criteria

- [ ] A1: each track's questions (Train, Focus, Calm) produce the expected `preferences.goalDetails` shape; skipping gives the track's defaults · check: `npx vitest run src/lib/domain/goal-questions.test.ts`
- [ ] A2: the plan step produces `preferences.sessionsPerWeek`, `dailyMinutes` and `reminders`, prefilled from the track and the answers; skipping gives the track's defaults · check: same file
- [ ] A3: the local adapter stores the new fields and refuses malformed ones; old preferences without them still save · check: `npx vitest run src/lib/backend/local/goal-plan.test.ts`
- [ ] A4: in the browser, at least two tracks go end to end through goal questions and the plan step and land on Home with the answers stored · check: `PORT=3202 npx playwright test e2e/onboarding.spec.ts e2e/onboarding-tracks.spec.ts`
- [ ] A5: everything else still passes · check: `npm run check`

## Files in scope

- `src/app/cloud/welcome/**`
- `src/lib/domain/types.ts` (additive: `goalDetails`, `dailyMinutes`, `reminders` on `UserPreferences` and the types they use)
- `src/lib/domain/goal-questions.ts`, `src/lib/domain/goal-questions.test.ts` (new)
- `src/lib/backend/types.ts`, `src/lib/backend/local/**` (validation and new tests)
- `firebase/firestore.rules` (only if access changes)
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

Build the domain module and tests, then the welcome steps, then e2e.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): additive contract fields `preferences.goalDetails`, `preferences.dailyMinutes`, `preferences.reminders` in `src/lib/domain/types.ts` (no renames/removals); existing tests may change where named; no dependencies; reminder time stored only.

## Questions for me

## Parked

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead opens PRs)

### Evidence

```
```
