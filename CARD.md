# T-0137 · fix: the four things a demo audience would see wrong (assigned practice, coach wording, empty coach pane, done-for-today)

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0137 · Held by: nobody
Created: 2026-11-26 · Source: cards/done/T-0131.md (Parked, ranked by its review); docs/DEMO.md parts 2-4; planning/v1/02 §3.5, §5.1

## Why

Walking the demo script, T-0131's reviewer found four things the audience would see wrong: Jordan's Home offers
"Start Open · 3 min" under Ana's Paced 5-5 practice; a clinician's client reads "From your coach" on New session; Calm
people with no professional get an empty "From your coach" pane; and a 40-second session reads "Done for today" while
Today shows 0 of 3 min.

## Acceptance criteria

- [x] A1: with an open practice from a professional, Home's start action names that practice and opens New session set
  to it (Jordan: "Start Paced 5-5 · 5 min" → Paced 5-5, 5 min selected) · check: `PORT=3203 npx playwright test e2e/demo-polish.spec.ts -g "assigned"`; `npx vitest run src/app/cloud/home/tailor.test.ts`
- [x] A2: New session's practice box names the professional by their kind ("From your clinician:" for Jordan; "From
  your coach:" for Alex) · check: `PORT=3203 npx playwright test e2e/demo-polish.spec.ts -g "clinician"`
- [x] A3: Home's side pane has no "From your coach" block for a Calm person with no professional (Maya); Train and
  Focus keep it per 02 §5.1 "Sharing default" · check: `PORT=3203 npx playwright test e2e/demo-polish.spec.ts -g "Calm"`; `npx vitest run src/app/cloud/home/tailor.test.ts`
- [x] A4: Home says "Done for today" only when today's minutes meet the ring's goal; a short session reads as a start
  with the minutes left · check: `PORT=3203 npx playwright test e2e/demo-polish.spec.ts -g "Done for today"`; `npx vitest run src/app/cloud/home/tailor.test.ts`
- [x] A5: the demo and Home specs still pass · check: `PORT=3203 npx playwright test e2e/demo-script.spec.ts e2e/p1-onboarding-matrix.spec.ts e2e/p1-invite-to-review.spec.ts e2e/home-per-goal.spec.ts e2e/habit.spec.ts e2e/smoke.spec.ts`
- [x] A6: CI passes · check: `rm -rf playwright-report test-results && npm run check`

## Files in scope

- `src/app/cloud/AthleteHome.tsx`
- `src/app/cloud/home/**` (incl. `tailor.test.ts`)
- `src/app/cloud/record/page.tsx`
- `src/app/cloud/session/SessionReview.tsx` (the comment author tag, only if a one-line change)
- `src/lib/domain/terminology.ts` (new helper only) and its test
- `e2e/demo-script.spec.ts`, `e2e/p1-*.spec.ts` (only where they assert the old behaviour)
- new `e2e/demo-polish.spec.ts`
- `docs/DEMO.md` (added by the lead after T-0136 merged: only the lines describing this card's fixes)
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

Done: for the lead to review and merge. `docs/DEMO.md` already carries this card's lines (merged on top of T-0136).

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (follow-up to the owner-approved U1/P1 demo cards): fixes to demo-visible defects found by T-0131's review; no contract changes; no new dependencies.
- 2026-11-26: Fix 1 is the app-logic fix, not a re-seed: Home's start action (and the first-run Home) prefers the first open assignment (`homeStart` in `home/tailor.ts`) and links to `/cloud/record/?mode=…&len=…&pacer=…`; New session applies it (`withPractice`), keeping view, sound and level. Seed unchanged. It applies to every professional's practice, so Alex's Home now reads "Start Paced 5-5 · 5 min" (Lena's open practice).
- 2026-11-26: Existing test changed for the old behaviour only: `e2e/demo-script.spec.ts` part 2 expected Alex's "Start Paced 5-5 · 10 min"; now "· 5 min". No other existing test changed (`tailor.test.ts` gained new cases only).
- 2026-11-26: `record/page.tsx` is wrapped in `<Suspense>` for `useSearchParams` (static export; same pattern as `record/live`). Its practice load also reads `listCoaches()` to find who set the practice.
- 2026-11-26: The professional's word comes from the existing `PRO_WORD` (`home/tailor.ts`, T-0116), as the report page uses it; no new helper in `terminology.ts` was needed.
- 2026-11-26: Not fixed: the "· coach" tag on a clinician's comment. A comment carries `authorRole` only, so the tag needs the author's kind looked up per thread (a load plus several lines), not a one-line change. Parked.
- 2026-11-26: decided for the owner: Home's side pane follows 02 §5.1 "Sharing default": Calm with no professional shows no practice block; Train keeps "From your coach / Share with a coach in Settings…"; Focus reads "From your teacher / Share with a teacher or counsellor in Settings…"; a linked professional's kind names it (alternative: keep "coach" for Focus too).
- 2026-11-26: decided for the owner: with a session today but the ring's minutes not met, Calm's line reads "Good start. N more minutes finishes today." (or "N days in a row. N more minutes finishes today."); "Done for today" waits for the minutes; the streak still counts any session (T-0113). Uses today's minutes against `dailyMinutes` even where the ring is hidden (alternative: only where the ring shows).
- 2026-11-26: `suggestedSession` (AthleteHome) replaced by `startLabel` in `home/tailor.ts`; it had no other users.
- 2026-11-26: scope widened by the lead after T-0136 merged: DEMO.md lines that describe this card's fixes. Merged origin/night/2026-11-26 (bfa1bd3) keeping all of T-0136; then changed only Part 2 (Alex's start button), Part 3 step 14 (Today and the "Good start" line), Part 4 steps 14 and 15 (numbered 13 and 14 before T-0136: the start button; "Use these settings" under "From your clinician") and the "Don't open" list. Part 3 step 13 (the results screen's "Done for today. Nice.") stays: that screen is unchanged (parked). `e2e/demo-script.spec.ts` needed no further change.

## Questions for me

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

- 2026-11-26 [product] The results screen still says "Done for today. Nice." after a session shorter than the ring's minutes (DEMO part 3 step 13) · seen on T-0137 · src/app/cloud/results/tone.ts
- 2026-11-26 [product] A clinician's comment still shows "· coach" to her client: comments carry `authorRole` only, so the tag needs the author's kind (E4) · seen on T-0137 · src/app/cloud/session/SessionReview.tsx
- 2026-11-26 [product] A clinician's or teacher's client still sees "From your coach" as the Sessions tab label and the overview's practice heading (E4) · seen on T-0137 · src/app/cloud/AthleteWorkspace.tsx, src/app/cloud/AthleteOverview.tsx
- 2026-11-26 [tool] home-per-goal's 375 px "never scrolls sideways" check failed 3 times in about 16 runs while other specs ran in parallel; 10 of 10 alone, before and after this card · seen on T-0137 · e2e/home-per-goal.spec.ts
- 2026-11-26 [tool] One e2e run on 3203 hit net::ERR_NETWORK_IO_SUSPENDED mid-run (the machine, not the app); the rerun passed · seen on T-0137 · npx playwright test

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not by the builder: the lead merges)

### Evidence

```
$ npx vitest run src/app/cloud/home   (A1, A3, A4 units)
 Test Files  3 passed (3)
      Tests  47 passed (47)

$ PORT=3203 npx playwright test e2e/demo-polish.spec.ts   (A1-A4)
  ✓ Jordan's Home starts the practice Ana assigned, and New session opens set to it (3.0s)
  ✓ New session names a clinician as the client's clinician, and a coach as a coach (4.9s)
  ✓ Calm with no professional has no empty coach pane; Train with a coach keeps it (3.8s)
  ✓ Done for today only once today's minutes meet the ring (4.8s)
  4 passed (17.4s)

$ PORT=3203 npx playwright test e2e/demo-polish.spec.ts e2e/demo-script.spec.ts e2e/p1-onboarding-matrix.spec.ts
    e2e/p1-invite-to-review.spec.ts e2e/home-per-goal.spec.ts e2e/habit.spec.ts e2e/smoke.spec.ts   (A1-A5)
  22 passed (3.9m)   # demo-script parts 1-5, p1 matrix 6, p1 invite-to-review (3.9m), home-per-goal 2, habit 2, smoke 2, demo-polish 4
  (two earlier runs of the same set: one hit net::ERR_NETWORK_IO_SUSPENDED; one failed home-per-goal's 375 px check, flaky, see Parked)

$ PORT=3203 npx playwright test e2e/home-per-goal.spec.ts -g "linked" --repeat-each=10
  10 passed (7.0s)

$ PORT=3203 npx playwright test e2e/demo-path.spec.ts e2e/demo-people.spec.ts e2e/onboarding-first-session.spec.ts
    e2e/invited-path.spec.ts e2e/onboarding-tracks.spec.ts e2e/program.spec.ts e2e/results-per-goal.spec.ts e2e/pro-terminology.spec.ts
  21 passed (2.3m)

$ rm -rf playwright-report test-results && npm run check   (A6)
check-exit=0
 lint clean · typecheck clean
 Test Files  110 passed | 1 skipped (111)
      Tests  1547 passed | 1 skipped (1548)
✓ Compiled successfully · Generating static pages (27/27)

Dev server on 3203 stopped; nothing listening on 3203 afterwards. Nothing run against Turso.

$ git diff --stat 86291b3..HEAD (all in scope)
 CARD.md, e2e/demo-polish.spec.ts (new), e2e/demo-script.spec.ts (1 line), src/app/cloud/AthleteHome.tsx,
 src/app/cloud/home/tailor.ts, src/app/cloud/home/tailor.test.ts, src/app/cloud/record/page.tsx

After merging night (bfa1bd3) and editing DEMO.md:
$ rm -rf playwright-report test-results && npm run check
check-exit=0 · lint clean · typecheck clean · Test Files 110 passed | 1 skipped · Tests 1547 passed | 1 skipped · 27/27 static pages
$ PORT=3203 npx playwright test e2e/demo-polish.spec.ts e2e/demo-script.spec.ts e2e/p1-invite-to-review.spec.ts e2e/smoke.spec.ts
  12 passed (3.8m)   # demo-polish 4, demo-script 5, p1-invite-to-review 1, smoke 2. Nothing listening on 3203 afterwards.

UNTESTED: the remaining e2e specs (onboarding*, mood, signup-consents, join-public, onboarding-pro*); the static build
served by `npm run preview`; a person reading the changed screens at 1280 px.
```
