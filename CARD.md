# T-0138 · fix: the results screen agrees with Home on "done for today", and the client's screens name their clinician

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0138 · Held by: AB_Rouge
Created: 2026-11-26 · Source: cards/done/T-0137.md (its review, and Parked); docs/DEMO.md parts 2-4; planning/v1/02 §5.1

## Why

After a 40-second session the results screen says "Done for today. Nice." and, twenty seconds later, Home says "Good
start. Three more minutes finishes today."; the demo script reads both aloud. The minutes wording can overstate the time
left in the last minute. A clinician's client still reads "From your coach" on their own Sessions tabs.

## Acceptance criteria

- [ ] A1: the results (after Stop) and the session review say "Done for today" only once today's minutes close the ring,
  using Home's rule (`minutesLeftToday` in `home/tailor.ts`); before that, a true, encouraging line with the minutes left ·
  check: `npx vitest run src/app/cloud/results src/app/cloud/home`; `PORT=3203 npx playwright test e2e/demo-polish.spec.ts -g "agree with Home"`
- [ ] A2: the minutes left are never short of the truth and the last minute reads "A minute or less", on Home and the
  results alike · check: `npx vitest run src/app/cloud/home/tailor.test.ts`
- [ ] A3: a clinician's client's own tab and overview heading say "From your clinician" (PRO_WORD) · check:
  `PORT=3203 npx playwright test e2e/demo-polish.spec.ts -g "clinician's client"`
- [ ] A4: DEMO.md step 13 and Part 2's "Say" line match the screens · check: `grep -n "Good start" docs/DEMO.md`
- [ ] A5: demo specs still pass · check: `PORT=3203 npx playwright test e2e/demo-script.spec.ts e2e/demo-polish.spec.ts e2e/results-per-goal.spec.ts e2e/p1-invite-to-review.spec.ts e2e/smoke.spec.ts`
- [ ] A6: CI passes · check: `rm -rf playwright-report test-results && npm run check`

## Files in scope

- `src/app/cloud/results/tone.ts`, `src/app/cloud/results/tone.test.ts`
- `src/app/cloud/home/tailor.ts` (share the helper), `src/app/cloud/home/tailor.test.ts`
- the results components that pass data to tone.ts: `src/app/cloud/record/live/page.tsx`, `src/app/cloud/record/live/Results.tsx`, `src/app/cloud/session/SessionReview.tsx` (only to pass the ring data)
- `src/app/cloud/AthleteWorkspace.tsx`, `src/app/cloud/AthleteOverview.tsx`
- `docs/DEMO.md` (step 13 and Part 2's "Say" line only)
- `e2e/demo-script.spec.ts`, `e2e/demo-polish.spec.ts`, `e2e/results-per-goal.spec.ts` (only where wording changes; new tests in demo-polish)
- `CARD.md`

## Out of scope

- The "· coach" tag on a clinician's comment (needs a lookup; stays parked).
- Other "your coach" wording on a client's screens (PlanTab, SessionReview's comment pane).
- `src/lib/domain/types.ts`, backend capabilities, `src/lib/domain/habit.ts`.

## Constraints

- No new dependencies. No contract changes. Static export stays. Port 3203 only; nothing against Turso.

## Skills

- none

## Stop and ask

- A fix needs a file outside the scope above.

## Next step

Build: share the ring rule from home/tailor.ts, pass it to the results and review, then the PRO_WORD labels and DEMO.md.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (follow-up to the owner-approved U1/P1 demo cards): fixes to demo-visible defects found by T-0137's review; no contract changes; no new dependencies.

## Questions for me

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not by the builder: the lead merges)

### Evidence

```
```
