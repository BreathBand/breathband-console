# T-0115 · feat: onboarding ends in fit → calibrate → first suggested session, back to back

Status: done
Branch: card/T-0115 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §3.1 steps 10–12 and the order rule (D10 in 03-launch-checklist.md)

## Why

Someone who finishes onboarding with a band (Bluetooth or the simulated band) lands on the New session setup page and has
to choose a session themselves. The spec wants the ritual: strap fit → calibrate → one suggested session for their track,
back to back, ending on the score, without a detour.

## Acceptance criteria

- [x] A1: a pure helper picks the first suggested session per track (Train: Breath Control or Post-training Downshift if
  "recovery", paced 5-5, 3 min; Focus: Focus Sprint, paced 5-5, 3 min; Calm: Just breathe, Open, 3 min, tones off), with a
  fallback when there is no goal · check: `npx vitest run src/lib/domain/first-session.test.ts`
- [x] A2: a new person on the simulated band goes onboarding → fit → calibrate (finishes in 20–22 s) → first session →
  results in one run, never via Home or the setup page; "app", "no band" and sample mode keep today's ending · check:
  `PORT=3202 npx playwright test e2e/onboarding-first-session.spec.ts e2e/onboarding-band.spec.ts e2e/demo-path.spec.ts`
- [x] A3: the recorder behaves as before for everyone else (no recorder logic changes; demo path still passes) · check: as A2
- [x] A4: `npm run check` passes

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

Done: the lead reviews and merges card/T-0115.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; no contract changes; existing tests may change where said which and why; never change scoring or calibration logic.
- 2026-11-26: decided for the owner: Train's first session is 3 minutes, as §3.2 says ("first session 3 minutes so the first win is quick") (alternative: the plan's daily minutes, as the card prompt's example put it).
- 2026-11-26: decided for the owner: the done step goes straight to the instrument (`/cloud/record/live/?…&first=<id>`), one click; `src/app/cloud/record/page.tsx` is unchanged, since nothing needs to pass through it (alternative: hand off via the setup page with the flag, which costs a second click).
- 2026-11-26: decided for the owner: leaving the first session on the instrument goes Home ("Later", §3.1 step 12) instead of the New session page; every other recording leaves as before (alternative: the setup page).
- 2026-11-26: decided for the owner: paced first sessions keep the tones choice from the sessions step; Calm's "Just breathe" is always tones off (spec); the skipped band step keeps today's ending (the New session page).
- 2026-11-26: `finishActions` gains an optional second argument (the first session's address); called with one argument it behaves as before, so `band-route.test.ts` is unchanged. New tests: `src/lib/domain/first-session.test.ts`, `src/app/cloud/welcome/first-session-handoff.test.ts` (the latter added under the welcome glob).
- 2026-11-26: existing test changed: `e2e/onboarding-band.spec.ts` "the simulated band … leads to the first session" now waits for `/cloud/record/live/?…first=just-breathe` instead of `/cloud/record/`, because the simulated route's ending is exactly what this card changes.

## Questions for me

## Parked

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified" (real Bluetooth band: UNTESTED, no hardware; same code path as the simulator)
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
$ npx vitest run src/lib/domain/first-session.test.ts src/app/cloud/welcome
 Test Files  4 passed (4)
      Tests  25 passed (25)

$ PORT=3202 npx playwright test e2e/onboarding-first-session.spec.ts e2e/onboarding-band.spec.ts e2e/demo-path.spec.ts
  ✓ onboarding-band › without Web Bluetooth the band step says what to do, and the phone-app route still finishes (7.0s)
  ✓ onboarding-band › the simulated band connects in the band step and leads to the first session (6.8s)
  ✓ onboarding-band › no band yet: sample-data mode shows labelled sample sessions, and leaving it goes home (5.8s)
  ✓ onboarding-first-session › Train on the simulated band: onboarding → fit → calibrate → first session → results, in one run (1.1m)
  ✓ demo-path › athlete records, saves and reviews a paced session; the coach sees the same score (1.1m)
  ✓ onboarding-first-session › Calm on the simulated band: the first session is Just breathe, open, and leaving it goes Home (6.1s)
  ✓ demo-path › athlete records an open session with two markers and gets the segment metrics (1.1m)
  7 passed (2.3m)
  (the Train test asserts calibration took 20–22 s and that after /cloud/welcome/ the only address was /cloud/record/live/)

$ PORT=3202 npx playwright test e2e/onboarding.spec.ts e2e/onboarding-tracks.spec.ts   (neighbours, done step unchanged for them)
  4 passed (18.0s)

$ npm run check   (lint, typecheck, tests, build)
 Test Files  68 passed | 1 skipped (69)
      Tests  770 passed | 1 skipped (771)
✓ Generating static pages using 23 workers (27/27)
exit=0
```
