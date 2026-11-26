# T-0138 · fix: the results screen agrees with Home on "done for today", and the client's screens name their clinician

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0138 · Held by: nobody
Created: 2026-11-26 · Source: cards/done/T-0137.md (its review, and Parked); docs/DEMO.md parts 2-4; planning/v1/02 §5.1

## Why

After a 40-second session the results screen says "Done for today. Nice." and, twenty seconds later, Home says "Good
start. Three more minutes finishes today."; the demo script reads both aloud. The minutes wording can overstate the time
left in the last minute. A clinician's client still reads "From your coach" on their own Sessions tabs.

## Acceptance criteria

- [x] A1: the results (after Stop) and the session review say "Done for today" only once today's minutes close the ring,
  using Home's rule (`minutesLeftToday` in `home/tailor.ts`); before that, a true, encouraging line with the minutes left ·
  check: `npx vitest run src/app/cloud/results src/app/cloud/home`; `PORT=3203 npx playwright test e2e/demo-polish.spec.ts -g "agree with Home"`
- [x] A2: the minutes left are never short of the truth and the last minute reads "A minute or less", on Home and the
  results alike · check: `npx vitest run src/app/cloud/home/tailor.test.ts`
- [x] A3: a clinician's client's own tab and overview heading say "From your clinician" (PRO_WORD) · check:
  `PORT=3203 npx playwright test e2e/demo-polish.spec.ts -g "clinician's client"`
- [x] A4: DEMO.md step 13 and Part 2's "Say" line match the screens · check: `grep -n "Good start" docs/DEMO.md`
- [x] A5: demo specs still pass · check: `PORT=3203 npx playwright test e2e/demo-script.spec.ts e2e/demo-polish.spec.ts e2e/results-per-goal.spec.ts e2e/p1-invite-to-review.spec.ts e2e/smoke.spec.ts`
- [x] A6: CI passes · check: `rm -rf playwright-report test-results && npm run check`

## Files in scope

- `src/app/cloud/results/tone.ts`, `src/app/cloud/results/tone.test.ts`
- `src/app/cloud/home/tailor.ts` (share the helper), `src/app/cloud/home/tailor.test.ts`
- the results components that pass data to tone.ts: `src/app/cloud/record/live/page.tsx`, `src/app/cloud/record/live/Results.tsx`, `src/app/cloud/session/SessionReview.tsx` (only to pass the ring data)
- `src/app/cloud/AthleteWorkspace.tsx`, `src/app/cloud/AthleteOverview.tsx`
- `src/app/cloud/AthleteHome.tsx` (one line: call the shared helper; see Decisions)
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

Done: for the lead to review and merge.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (follow-up to the owner-approved U1/P1 demo cards): fixes to demo-visible defects found by T-0137's review; no contract changes; no new dependencies.
- 2026-11-26: T-0137's rule lived inline in AthleteHome (`today.closed ? 0 : today.goalMinutes - today.minutes`), not in tailor.ts. It is now `minutesLeftToday(ring)` in `home/tailor.ts`; AthleteHome calls it (one line, added to scope so Home and the results share one rule, not two copies), and so do the results (`record/live/page.tsx` → `Results.tsx`) and the session review (`SessionReview.tsx`, which shows the same line after Save: DEMO step 13 "Save session opens the review").
- 2026-11-26: Fix 2: the old expression was already the time left rounded up (3 − ⌊0:37⌋ = 3 = ⌈2:23⌉), so "Three more minutes" at 0:37 is true and matches the ring's "0 of 3 min"; kept for 2+ minutes. decided for the owner: the last minute (10 s to 1:00 left) reads "A minute or less finishes today." (alternative: "Under a minute", false at exactly 1:00 left; or seconds, which the ring doesn't show). One sentence (`moreToday`) for Home and the results.
- 2026-11-26: decided for the owner: results before the ring closes reuse Home's words for a good session ("Good start. Three more minutes finishes today." / "N days in a row. …"); a middling or poor one gets no praise (T-0108's rule): "That's a start. …" or "N days in a row. …"; a clinician's client: "Three more minutes finishes today. Ana will see this before your next visit.", then "Done for today. Ana will see …" (alternative: "Good start" whatever the score, as Home says).
- 2026-11-26: decided for the owner: the review of a session from an earlier day keeps "Done" (today's ring says nothing about that day); a session from today reads today's ring as Home does (alternative: that day's own ring, which would say "finishes today" about a past day).
- 2026-11-26: The results' ring counts this session plus the loaded history (Calm already loads it for the streak), against `dailyMinutesOf(prefs)`, as Home does even where the ring is hidden (T-0137).
- 2026-11-26: Fix 3: tab label and overview heading read `From your ${PRO_WORD[ws.coachKind ?? "coach"]}`; the overview's empty-comments line ("Comments from your coach show up here.") got the same word, same file. No professional stays "coach".
- 2026-11-26: Existing tests changed: `tailor.test.ts` one assertion ("Good start. One more minute finishes today." → "Good start. A minute or less finishes today.": the minutes wording fix 2 asks for); `e2e/results-per-goal.spec.ts` Calm-line regex widened to accept the before-the-ring lines beside the "Done for today" ones. Otherwise new tests only (tailor.test, tone.test, two in demo-polish). `e2e/demo-script.spec.ts` needed no change.
- 2026-11-26: DEMO.md: only step 13's quoted line and Part 2's "Say" line changed. Step 14's "Good start. Three more minutes finishes today." is unchanged and still right.

## Questions for me

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

- 2026-11-26 [product] DEMO.md "Don't open" still warns about the **From your coach** tab under Sessions; after T-0138 Jordan's tab reads "From your clinician" (only the "· coach" comment tag remains) · seen on T-0138 · docs/DEMO.md
- 2026-11-26 [product] A clinician's client still reads "your coach" on the Plan tab ("What your coach asked for", "When your coach sets practice…", "your coach" as the setter) and in the review's comments ("Reply to your coach…", "Between you and your coaches", "Visible to your coaches") · seen on T-0138 · src/app/cloud/PlanTab.tsx, src/app/cloud/session/SessionReview.tsx
- 2026-11-26 [product] A Focus person with no professional sees "From your teacher" on Home's side pane but "From your coach" on the Sessions tab (the tab follows the linked professional only) · seen on T-0138 · src/app/cloud/AthleteWorkspace.tsx
- 2026-11-26 [product] The results' ring takes the session's start as "today": a session across midnight counts toward the day it started there, toward the new day on Home · seen on T-0138 · src/app/cloud/record/live/page.tsx

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below; AthleteHome added, see Decisions)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not by the builder: the lead merges)

### Evidence

```
$ npx vitest run src/app/cloud/results src/app/cloud/home   (A1, A2: tone with the ring open and closed; minutesLeftToday, moreToday)
 Test Files  5 passed (5)
      Tests  103 passed (103)

$ PORT=3203 npx playwright test e2e/demo-polish.spec.ts   (A1, A3)
  ✓ 5 the results and the review agree with Home: a short session reads as a start, not done for today (1.1m)
  ✓ 6 a clinician's client's own tabs name the clinician, not a coach (3.3s)
  6 passed (1.5m)

$ grep -n "Good start\|coach's" docs/DEMO.md   (A4)
80:**Say:** same band, same scoring underneath; the goal changes what you see, the default session (or your coach's
109:13. **The result**: ... one line ("Good start.
111:14. **Home** (sidebar): ... "Good start. Three more minutes finishes

$ PORT=3203 npx playwright test e2e/demo-script.spec.ts e2e/demo-polish.spec.ts e2e/results-per-goal.spec.ts e2e/p1-invite-to-review.spec.ts e2e/smoke.spec.ts   (A5)
  15 passed (3.9m)   # demo-script 5, demo-polish 6, results-per-goal 1, p1-invite-to-review 1, smoke 2

$ PORT=3203 npx playwright test e2e/home-per-goal.spec.ts e2e/habit.spec.ts e2e/mood.spec.ts e2e/pro-terminology.spec.ts e2e/invited-path.spec.ts   (extra)
  11 passed (1.7m)

$ rm -rf playwright-report test-results && npm run check   (A6)
check-exit=0 · lint clean · typecheck clean
 Test Files  110 passed | 1 skipped (111)
      Tests  1556 passed | 1 skipped (1557)
✓ Compiled successfully · Generating static pages (27/27)

Nothing listening on 3203 afterwards. Nothing run against Turso.

$ git diff --stat 101f6e1..HEAD (besides CARD.md; all in scope)
 docs/DEMO.md 7, e2e/demo-polish.spec.ts 47, e2e/results-per-goal.spec.ts 5, src/app/cloud/AthleteHome.tsx 4,
 AthleteOverview.tsx 5, AthleteWorkspace.tsx 3, home/tailor.ts 26, home/tailor.test.ts 37, record/live/Results.tsx 5,
 record/live/page.tsx 18, results/tone.ts 28, results/tone.test.ts 31, session/SessionReview.tsx 15   (13 files, +202 -29)

UNTESTED: the remaining e2e specs (onboarding*, signup-consents, join-public, program, demo-path, demo-people,
p1-onboarding-matrix); the static build served by `npm run preview`; a person reading the changed screens at 1280 px.
```
