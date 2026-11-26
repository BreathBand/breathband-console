# T-0137 · fix: the four things a demo audience would see wrong (assigned practice, coach wording, empty coach pane, done-for-today)

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0137 · Held by: AB_Rouge
Created: 2026-11-26 · Source: cards/done/T-0131.md (Parked, ranked by its review); docs/DEMO.md parts 2-4; planning/v1/02 §3.5, §5.1

## Why

Walking the demo script, T-0131's reviewer found four things the audience would see wrong: Jordan's Home offers
"Start Open · 3 min" under Ana's Paced 5-5 practice; a clinician's client reads "From your coach" on New session; Calm
people with no professional get an empty "From your coach" pane; and a 40-second session reads "Done for today" while
Today shows 0 of 3 min.

## Acceptance criteria

- [ ] A1: with an open practice from a professional, Home's start action names that practice and opens New session set
  to it (Jordan: "Start Paced 5-5 · 5 min" → Paced 5-5, 5 min selected) · check: `PORT=3203 npx playwright test e2e/demo-polish.spec.ts -g "assigned"`; `npx vitest run src/app/cloud/home/tailor.test.ts`
- [ ] A2: New session's practice box names the professional by their kind ("From your clinician:" for Jordan; "From
  your coach:" for Alex) · check: `PORT=3203 npx playwright test e2e/demo-polish.spec.ts -g "clinician"`
- [ ] A3: Home's side pane has no "From your coach" block for a Calm person with no professional (Maya); Train and
  Focus keep it per 02 §5.1 "Sharing default" · check: `PORT=3203 npx playwright test e2e/demo-polish.spec.ts -g "Calm"`; `npx vitest run src/app/cloud/home/tailor.test.ts`
- [ ] A4: Home says "Done for today" only when today's minutes meet the ring's goal; a short session reads as a start
  with the minutes left · check: `PORT=3203 npx playwright test e2e/demo-polish.spec.ts -g "Done for today"`; `npx vitest run src/app/cloud/home/tailor.test.ts`
- [ ] A5: the demo and Home specs still pass · check: `PORT=3203 npx playwright test e2e/demo-script.spec.ts e2e/p1-onboarding-matrix.spec.ts e2e/p1-invite-to-review.spec.ts e2e/home-per-goal.spec.ts e2e/habit.spec.ts e2e/smoke.spec.ts`
- [ ] A6: CI passes · check: `rm -rf playwright-report test-results && npm run check`

## Files in scope

- `src/app/cloud/AthleteHome.tsx`
- `src/app/cloud/home/**` (incl. `tailor.test.ts`)
- `src/app/cloud/record/page.tsx`
- `src/app/cloud/session/SessionReview.tsx` (the comment author tag, only if a one-line change)
- `src/lib/domain/terminology.ts` (new helper only) and its test
- `e2e/demo-script.spec.ts`, `e2e/p1-*.spec.ts` (only where they assert the old behaviour)
- new `e2e/demo-polish.spec.ts`
- `CARD.md`

## Out of scope

- `docs/DEMO.md`, `README.md`, `.env.example`, `src/lib/backend/index.ts` (T-0136 holds them): replacement lines go
  under "Next step".
- The results screen's coaching line (`src/app/cloud/results/tone.ts`) and the "From your coach" tab label in
  `AthleteWorkspace.tsx` / `AthleteOverview.tsx`.
- `src/lib/domain/types.ts`, backend capabilities, `src/lib/prefs.ts`.

## Constraints

- No new dependencies. No contract changes. Static export stays. Port 3203 only; nothing against Turso.

## Skills

- none

## Stop and ask

- A fix needs a file outside the scope above.

## Next step

Build A1-A4, then the checks.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (follow-up to the owner-approved U1/P1 demo cards): fixes to demo-visible defects found by T-0131's review; no contract changes; no new dependencies.

## Questions for me

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (the lead merges)

### Evidence

```
```
