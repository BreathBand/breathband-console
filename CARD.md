# T-0108 · feat: results emphasis per goal and the coaching line in each tone

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0108 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §5.1 (Results emphasis and Coaching line rows); 03-launch-checklist.md I2 (Results half) and I3; 01-product-spec.md §3.6

## Why

After a session everyone sees the same results, and nothing speaks to them. v1 tailors the results
to the goal: Train gets every number, Focus the headline and how much of the session was on target
(or how the rate dropped), Calm the headline, its word and one tip; and one coaching line from the
weakest part, written in the goal's tone. Scores and formulas stay exactly as they are.

## Acceptance criteria

- [ ] A1: a pure rule per goal for what the results emphasise and the coaching line, tested for a good, middling and poor session per goal; no line contradicts the score (no praise on a poor session, Train names the weakest part's own number) · check: `npx vitest run src/app/cloud/results/`
- [ ] A2: the live results (after Stop) and the session review show the goal's emphasis and the line; a coach viewing a review sees today's full view and no line · check: A3
- [ ] A3: recording a short session with the simulated band as Train and as Calm shows different emphasis and lines · check: `PORT=3203 npx playwright test e2e/results-per-goal.spec.ts`
- [ ] A4: everything else still passes · check: `npm run check`

## Files in scope

- `src/app/cloud/results/tone.ts` (new: the emphasis and coaching-line rules)
- `src/app/cloud/results/tone.test.ts` (new)
- `src/app/cloud/home/tailor.ts` (export its number-word helpers only)
- `src/app/cloud/record/live/Results.tsx`, `src/app/cloud/record/live/page.tsx`, `src/app/cloud/record/record.css`
- `src/app/cloud/session/SessionReview.tsx`, `src/app/cloud/session/MethodC.tsx`, `src/app/cloud/session/review.css`
- `e2e/results-per-goal.spec.ts` (new)
- `CARD.md`

## Out of scope

- Focus's mood change (needs J6 mood data) and an exam countdown in the line (D4–D6): not built here.
- A per-session CSV of the per-turn table for Train (checklist row on CSV export): parked.
- Scoring, `src/lib/analysis/**`, `src/lib/domain/types.ts`, Home (`AthleteHome.tsx`), welcome, signup, backend.

## Constraints

- No new dependencies. Scoring numbers and formulas unchanged: only what is shown first and the words.
- Data only through `useBackend()` / `useAuth()`.

## Skills

None needed.

## Stop and ask

- Anything that needs a new field on the profile, session or link.

## Next step

Build `results/tone.ts` with tests, then wire Results and the review, then the e2e.

## Decisions

Appended by the session, one line each, newest last.

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; never change scoring formulas (`src/lib/analysis/**`); no edits to `types.ts`, welcome, signup, backend, `package.json`, `server/**`, `AthleteHome.tsx`; existing tests may change only where named here.

## Questions for me

## Parked

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (the lead opens it)

### Evidence

```
```
