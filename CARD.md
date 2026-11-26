# T-0101 · fix: calibration matches Harry: 20 s of full breaths, once each time the band goes on

Status: in progress
Branch: card/T-0101 · Held by: AB_Rouge
Created: 2026-11-26 · Source: Harry's latest answers (breathband-docs `project/decisions-and-open-questions.md`): 20 s of full breaths; calibrate each time the sensor goes on, not between consecutive sessions

## Why

Calibration asks for "five deep breaths" (three after 50 s) and expires after 15 minutes. Harry's rule is 20 seconds of full breaths, once each time the band goes on, kept across consecutive sessions. The reference stays the Appendix's mean of the top and bottom three (median vs. single max/min is still open with Harry).

## Acceptance criteria

- [ ] A1: lint, typecheck, tests and build pass · check: `npm run check`
- [ ] A2: calibration and device unit tests pass · check: `npx vitest run src/lib/analysis/calibrationProgress.test.ts src/lib/device/device.test.ts`
- [ ] A3: the demo path still runs end to end with the new heading · check: `PORT=3201 npx playwright test e2e/demo-path.spec.ts`
- [ ] A4: with the simulated band, calibration finishes 20–22 s after it starts · check: device.test.ts "finishes calibrating 20–22 s after the command"
- [ ] A5: a run with fewer than 3 full breaths returns to the strap step with the "three full breaths in the 20 seconds" message · check: calibrationProgress.test.ts "rejects a window with fewer than three full breaths" (unit, `failed: true`) + the page maps `failed` to that message

## Files in scope

- `src/lib/analysis/calibrationProgress.ts`, `src/lib/analysis/calibrationProgress.test.ts`
- `src/lib/device/simulated.ts`, `src/lib/device/device.test.ts`
- `src/app/cloud/record/live/page.tsx`, `src/app/cloud/record/record.css`, `src/app/cloud/record/duo/page.tsx`
- `src/app/cloud/AthleteHome.tsx`, `src/app/cloud/CloudLanding.tsx`, `src/app/(site)/page.tsx`
- `e2e/demo-path.spec.ts`, `docs/DEMO.md`
- `CARD.md`

## Out of scope

- Changing the calibration reference (median / single max-min): open with Harry.
- Scoring formulas in `src/lib/analysis/` and `calibrate()` itself.
- Detecting band-off automatically from the signal (today "the band comes off" means disconnect or the athlete saying so).

## Constraints

- No new dependencies. Static export. Scoring formulas don't change.

## Next step

Finish simulated band timing test, run checks, push.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): existing tests `calibrationProgress.test.ts` and the heading in `e2e/demo-path.spec.ts` may change; no new dependencies; scoring formulas don't change.

## Questions for me

## Parked

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: builders don't open PRs)

### Evidence

```
```
