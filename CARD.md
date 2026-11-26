# T-0108 · feat: results emphasis per goal and the coaching line in each tone

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0108 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §5.1 (Results emphasis and Coaching line rows); 03-launch-checklist.md I2 (Results half) and I3; 01-product-spec.md §3.6

## Why

After a session everyone sees the same results, and nothing speaks to them. v1 tailors the results
to the goal: Train gets every number, Focus the headline and how much of the session was on target
(or how the rate dropped), Calm the headline, its word and one tip; and one coaching line from the
weakest part, written in the goal's tone. Scores and formulas stay exactly as they are.

## Acceptance criteria

- [x] A1: a pure rule per goal for what the results emphasise and the coaching line, tested for a good, middling and poor session per goal; no line contradicts the score (no praise on a poor session, Train names the weakest part's own number) · check: `npx vitest run src/app/cloud/results/`
- [x] A2: the live results (after Stop) and the session review show the goal's emphasis and the line; a coach viewing a review sees today's full view and no line · check: A3
- [x] A3: recording a short session with the simulated band as Train and as Calm shows different emphasis and lines · check: `PORT=3203 npx playwright test e2e/results-per-goal.spec.ts`
- [x] A4: everything else still passes · check: `npm run check`

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

Done; the lead reviews and opens the PR against the integration branch.

## Decisions

Appended by the session, one line each, newest last.

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; never change scoring formulas (`src/lib/analysis/**`); no edits to `types.ts`, welcome, signup, backend, `package.json`, `server/**`, `AthleteHome.tsx`; existing tests may change only where named here.
- 2026-11-26: the rules live in a new `src/app/cloud/results/tone.ts` (not in `home/tailor.ts`: results are their own surface); it reuses `home/tailor.ts`'s `calmLine`, `Professional` and number words (exported `word` and `capital` there, nothing else changed) and `AthleteHome`'s `streakDays`. The goal is read the way Home reads it: `auth.profile.preferences.goal`.
- 2026-11-26: decided for the owner: no goal reads like Train (every number, numbers-first line), matching today's page (alternative: no line without a goal).
- 2026-11-26: decided for the owner: Focus's "% of time calm" = on target, the mean of the timing and depth on-target shares (paced); for open sessions the rate from the first third to the last ("17 → 12"), only when each third is at least 20 s (alternative: % of breaths at a normal rate).
- 2026-11-26: decided for the owner: Focus and Calm fold the breakdown (sub-scores, lean, histogram, open metrics) under "All the numbers" rather than removing it; Train keeps it open. The waveform and per-turn table on the review are unchanged for everyone.
- 2026-11-26: decided for the owner: "no line contradicts the score" = praise words (Nice, calm, good…) only when the Total is in the ok band (7+), or an open session's rate is at or under 16; Train always names the weakest part's own number (alternative: praise for showing up regardless).
- 2026-11-26: decided for the owner: a coach looking at an athlete's review sees today's full view and no coaching line (the line is written to the person).
- 2026-11-26: no existing test changed.

## Questions for me

## Parked

- 2026-11-26 [product] Focus's mood change on the results (§5.1) needs the mood before/after data (J6); the results have no seam for it yet · seen on T-0108 · src/app/cloud/results/tone.ts
- 2026-11-26 [product] Train's results row asks for a CSV; there is no per-session CSV of the per-turn table yet (01 §3.6 CSV row) · seen on T-0108 · src/app/cloud/session/SessionReview.tsx
- 2026-11-26 [product] The clinician line ("Lena will see this before your next visit") is built and tested but not wired to the screens: `professionalOf` reads every link as a coach until `proKind` exists, so no caller passes a clinician yet · seen on T-0108 · src/app/cloud/home/tailor.ts
- 2026-11-26 [product] The copy in results/tone.ts wants the M6 wellness-wording review · seen on T-0108 · src/app/cloud/results/tone.ts

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (the lead opens it)

### Evidence

```
$ npx vitest run src/app/cloud/results/ src/app/cloud/home/
 Test Files  2 passed (2)
      Tests  62 passed (62)        # tone.test.ts: emphasis per goal; good/middling/poor x Train/Focus/Calm/no goal; no praise unless band ok; Train names the weakest part's number

$ PORT=3203 npx playwright test e2e/results-per-goal.spec.ts
  ✓  1 [chromium] › e2eesults-per-goal.spec.ts:48:1 › the results differ for Train and Calm: what leads, and the coaching line (2.2m)
  1 passed (2.2m)                  # run twice, both passed; screenshots attached to the report (results-train, review-train, results-calm, review-calm, review-calm-375)
  seen: Train "Inhale depth 6. Breaths in were 15.4% of max deeper than the pacer." with the table open;
        Calm "Nice. Two days in a row." + tip "Next time, keep each breath a little softer.", numbers folded

$ PORT=3203 npx playwright test e2e/demo-path.spec.ts     # existing flow through the results, unchanged spec
  2 passed (2.3m)

$ npm run check                    # lint, typecheck, tests, build
 Test Files  50 passed (50)
      Tests  576 passed (576)
✓ Compiled successfully
✓ Generating static pages (26/26)
EXIT 0

UNTESTED: Focus in the browser (unit-tested only); the rate-drop line on a real open session of 60 s or more (unit-tested with a synthetic signal).
```
