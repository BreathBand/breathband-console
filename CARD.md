# T-0115 · feat: onboarding ends in fit → calibrate → first suggested session, back to back

Status: in progress
Branch: card/T-0115 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §3.1 steps 10–12 and the order rule (D10 in 03-launch-checklist.md)

## Why

Someone who finishes onboarding with a band (Bluetooth or the simulated band) lands on the New session setup page and has
to choose a session themselves. The spec wants the ritual: strap fit → calibrate → one suggested session for their track,
back to back, ending on the score, without a detour.

## Acceptance criteria

- [ ] A1: a pure helper picks the first suggested session per track (Train: Breath Control or Post-training Downshift if
  "recovery", paced 5-5, 3 min; Focus: Focus Sprint, paced 5-5, 3 min; Calm: Just breathe, Open, 3 min, tones off), with a
  fallback when there is no goal · check: `npx vitest run src/lib/domain/first-session.test.ts`
- [ ] A2: a new person on the simulated band goes onboarding → fit → calibrate (finishes in 20–22 s) → first session →
  results in one run, never via Home or the setup page; "app", "no band" and sample mode keep today's ending · check:
  `PORT=3202 npx playwright test e2e/onboarding-first-session.spec.ts e2e/onboarding-band.spec.ts e2e/demo-path.spec.ts`
- [ ] A3: the recorder behaves as before for everyone else (no recorder logic changes; demo path still passes) · check: as A2
- [ ] A4: `npm run check` passes

## Files in scope

- `src/app/cloud/welcome/**` (done step → hand-off)
- `src/lib/domain/first-session.ts`, `src/lib/domain/first-session.test.ts` (new)
- `src/app/cloud/record/live/page.tsx`, `src/app/cloud/record/page.tsx` (only to accept/pass the first-session flag)
- `e2e/onboarding-first-session.spec.ts` (new)
- `e2e/onboarding-band.spec.ts` (only the simulated-route ending, which this card changes)
- `CARD.md`

## Out of scope

- Home's "Your first session takes three minutes" card for "Later" (Home is another lane's)
- Invited path: the assignment as the first session (D12)
- Any change to calibration timing or scoring (`src/lib/analysis/**`)

## Constraints

- No new dependencies. No contract changes (`src/lib/domain/types.ts` untouched).
- Don't touch `src/app/cloud/home/**`, `AthleteHome.tsx`, `results/**`, `session/**`, `src/lib/backend/**`, `server/**`.

## Skills

- none

## Stop and ask

- If the hand-off needs a recorder logic change.

## Next step

Build the helper and the hand-off, then run the checks.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; no contract changes; existing tests may change where said which and why; never change scoring or calibration logic.

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
(pending)
```
