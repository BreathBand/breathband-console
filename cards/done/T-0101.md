# T-0101 · fix: calibration matches Harry: 20 s of full breaths, once each time the band goes on

Status: done
Branch: card/T-0101 · Held by: nobody
Created: 2026-11-26 · Source: Harry's latest answers (breathband-docs `project/decisions-and-open-questions.md`): 20 s of full breaths; calibrate each time the sensor goes on, not between consecutive sessions

## Why

Calibration asks for "five deep breaths" (three after 50 s) and expires after 15 minutes. Harry's rule is 20 seconds of full breaths, once each time the band goes on, kept across consecutive sessions. The reference stays the Appendix's mean of the top and bottom three (median vs. single max/min is still open with Harry).

## Acceptance criteria

- [x] A1: lint, typecheck, tests and build pass · check: `npm run check`
- [x] A2: calibration and device unit tests pass · check: `npx vitest run src/lib/analysis/calibrationProgress.test.ts src/lib/device/device.test.ts`
- [x] A3: the demo path still runs end to end with the new heading · check: `PORT=3201 npx playwright test e2e/demo-path.spec.ts`
- [x] A4: with the simulated band, calibration finishes 20–22 s after it starts · check: device.test.ts "finishes calibrating 20–22 s after the command"
- [x] A5: a run with fewer than 3 full breaths returns to the strap step with the "three full breaths in the 20 seconds" message · check: calibrationProgress.test.ts "rejects a window with fewer than three full breaths" (unit, `failed: true`) + the page maps `failed` to that message

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

Lead reviews and opens the PR; nothing left on the card.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): existing tests `calibrationProgress.test.ts` and the heading in `e2e/demo-path.spec.ts` may change; no new dependencies; scoring formulas don't change.
- 2026-11-26: kept the carried-over edits as they were (20 s window, >= 3 full breaths, `remainingS`/`failed`; time bar; calibration kept for the connection, no 15-min limit; duo "Go again" keeps both calibrations). Changed `calibrationProgress.test.ts` (approved) because the 5-breath / 50 s rule it tested is gone.
- 2026-11-26: e2e heading changed to "Full breaths for 20 seconds" (approved).
- 2026-11-26: decided for the owner: the simulated band breathes 2.5 s in / 3 s out for 5 breaths during calibration (alternative: 6 breaths at 3 s / 4 s, which runs well past the window).
- 2026-11-26: A4 is a unit test in device.test.ts over 4 seeds x 4 command offsets, polling calibrationProgress once a second as the recorder does; it fails with the old 3 s / 4 s timing.
- 2026-11-26: A5 is covered at the unit level (`failed: true` with < 3 breaths); the page maps `failed` to the strap step + message by reading, no component test (no React test setup in the repo).

## Questions for me

## Parked

- 2026-11-26 [product] "full breath" is any peak >= 35 % of the biggest swing in the window, so ordinary resting breaths count too; whether calibration should insist on depth waits on Harry's reference choice · seen on T-0101 · src/lib/analysis/calibrationProgress.ts
- 2026-11-26 [product] "the band comes off" is only known from a disconnect or the athlete's button; no off-body detection from the signal · seen on T-0101 · src/app/cloud/record/live/page.tsx

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: builders don't open PRs)

### Evidence

```
$ npm run check
lint: clean · typecheck: clean · Test Files 44 passed (44), Tests 491 passed (491) · next build: 26 static pages, EXIT=0

$ npx vitest run src/lib/analysis/calibrationProgress.test.ts src/lib/device/device.test.ts
Test Files 2 passed (2), Tests 18 passed (18)
  incl. "finishes calibrating 20–22 s after the command, as the recorder polls it once a second" (A4)
  incl. "rejects a window with fewer than three full breaths" (A5)
  sanity: with the old 3 s / 4 s sim timing the A4 test fails ("seed 3, command after 5 s: failed")

$ PORT=3201 npx playwright test e2e/demo-path.spec.ts
  ok 1 athlete records, saves and reviews a paced session; the coach sees the same score (1.1m)
  ok 2 athlete records an open session with two markers and gets the segment metrics (1.1m)
  2 passed (2.3m); dev server on 3201 stopped by Playwright afterwards

UNTESTED: the "Keep my calibration" / "I took the band off" buttons on a second session in one connection (no e2e covers it); the copy on /, /cloud landing and first-run (text only).

$ git diff --stat main...HEAD (files)
CARD.md, docs/DEMO.md, e2e/demo-path.spec.ts, src/app/(site)/page.tsx, src/app/cloud/AthleteHome.tsx,
src/app/cloud/CloudLanding.tsx, src/app/cloud/record/duo/page.tsx, src/app/cloud/record/live/page.tsx,
src/app/cloud/record/record.css, src/lib/analysis/calibrationProgress.ts, src/lib/analysis/calibrationProgress.test.ts,
src/lib/device/device.test.ts, src/lib/device/simulated.ts
```
