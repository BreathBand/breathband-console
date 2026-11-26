# T-0124 · feat: one program, Foundations (14 days), with progress

Status: done
Branch: card/T-0124 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/03-launch-checklist.md J5 (Demo: one); 01-product-spec.md §3.8 (programs, "first program" milestone); 02-onboarding-and-tailoring.md §5.1 (Programs promoted: Calm → Foundations (14 d)); 05-demo-plan.md (one program, Foundations)

## Why

There are no self-serve programs: Calm's Home has nothing to follow day by day, and the "first program" milestone exists but can never be earned. The demo shows one program, Foundations (14 days), with enrolment, today's session one tap away, and progress.

## Acceptance criteria

- [x] A1: Foundations is static content: 14 days, each a session preset; day N's preset and its recorder address come from one data module · check: `npx vitest run src/lib/domain/programs.test.ts`
- [x] A2: progress from sessions after enrolment: one program day per calendar day, consecutive and missed days (a missed day waits, never skips or resets), today done / next preview, finished · check: `npx vitest run src/lib/domain/programs.test.ts`
- [x] A3: finishing awards the "first program" milestone, once · check: `npx vitest run src/lib/domain/habit.test.ts src/lib/domain/programs.test.ts`
- [x] A4: enrolment is stored only in `preferences.gamification.program`, validated by the local adapter · check: `npx vitest run src/lib/backend/local`
- [x] A5: enrol from Home, start day 1 in one tap with the simulated band, Home shows 1 of 14 · check: `PORT=3203 npx playwright test e2e/program.spec.ts e2e/habit.spec.ts e2e/home-per-goal.spec.ts`
- [x] A6: CI passes · check: `npm run check`

## Files in scope

- `src/lib/domain/programs.ts`, `src/lib/domain/programs.test.ts` (new)
- `src/lib/domain/habit.ts` (award "first program"; accept `gamification.program` in its validator)
- `src/lib/domain/types.ts` (additive inside `GamificationPreferences` only)
- `src/lib/backend/local/program.test.ts` (new)
- `src/app/cloud/home/**`, `src/app/cloud/AthleteHome.tsx`, `src/app/cloud/home.css`
- `src/app/cloud/account/page.tsx` (fix round, widened by the lead), `src/app/cloud/account/merge-preferences.ts` + `.test.ts` (new)
- `src/app/cloud/profile-writes.ts` + `.test.ts` (new, final follow-up)
- `e2e/program.spec.ts` (new)
- `CARD.md`

## Out of scope

- The other five programs (J4, content not written) and program authoring for professionals
- Naming the program day on the instrument (`src/app/cloud/record/**`) or the results
- Program reminders (no reminders are sent yet); the server's `programs`/`enrollments` tables

## Constraints

- No new dependencies. Static export. Screens use `useBackend()` / `useAuth()` only.
- `src/lib/domain/first-session.ts` is imported, never edited (T-0123). Scoring untouched.

## Skills

- none

## Next step

Review and merge; then Harry approves or rewrites Foundations' 14 days (J4), and a later card names the program day on the instrument.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; additive only inside `preferences.gamification`; existing tests may change where stated; never change scoring.
- 2026-11-26: stored shape `preferences.gamification.program = { id: "foundations", startedAt }` (types `ProgramId`, `ProgramEnrolment`, additive inside `GamificationPreferences`). Days done are read from sessions, not stored. `gamificationProblem` (habit.ts) validates it; the local adapter and `server/routes/profile.ts` already call it, so neither changed. `firestore.rules` has no preferences checks, so unchanged.
- 2026-11-26: decided for the owner: a program day is done by any session on a calendar day after enrolling, one day per calendar day (alternative: only a session started from the program's link, or one at least the day's length; the instrument is out of scope and doesn't tag sessions).
- 2026-11-26: decided for the owner: missed days skip nothing and reset nothing; the next day waits, with the line "Day N is waiting for you. A missed day resets nothing: carry on where you left off." (no red, like the paused streak). The enrolment day itself never counts as missed (alternative: days advance by the calendar and missed ones are lost).
- 2026-11-26: decided for the owner: Foundations' content is drafted in `programs.ts` (open 3 min on days 1-2, 5-5 pacer from day 3 per 02 §3.4, 5 min from day 6, 10 min on day 13, day 14 repeats day 1). Pacer 5-5 only (Harry: 2-2 and 5-5). Pending J4 approval.
- 2026-11-26: decided for the owner: Calm's Home promotes Foundations (filled "Start Foundations"); Train and Focus see it as a quiet offer (ghost button), since their own programs aren't written; a clinician's client never sees an offer (02 §5.1 "the clinician's plan only"). A finished program stays on Home for 7 days, then hides (alternative: always show the finished card).
- 2026-11-26: the day link carries `&program=foundations&day=N` after the preset; the instrument ignores them today, so a later card can name the day without changing Home.
- 2026-11-26: `home/Milestones.tsx` now reads the profile afresh before computing and writing (via new `home/gamification.ts`). Without it, the sign-in profile it wrote from would wipe an enrolment made earlier in the same visit (the http adapter never refreshes auth's profile after `updateProfile`; the local adapter does, through its auth listeners). Same files glob; no existing test changed. Validator tests live in `programs.test.ts` and new `backend/local/program.test.ts`; `habit.test.ts` untouched.

- 2026-11-26: fix round (reviewer block): the lead widened scope to `src/app/cloud/account/page.tsx`. Settings built every save as `{ ...prefs, change }` from the sign-in profile, so a save after enrolling (or after milestones were shown) wiped `gamification`. Each save now re-reads the profile through the backend and lays only the fields it changed over it (`withChanges`, new `account/merge-preferences.ts`, unit-tested). BackendProvider untouched.
- 2026-11-26: fix round: Home's `changeGamification` writes now run one at a time (a module-level queue), so enrolling while milestones are being marked can't overwrite either (reviewer suggestion 1).
- 2026-11-26: fix round: the new e2e "a Settings change made without a reload keeps the program" writes a milestone straight to storage while Settings is open, because the local adapter refreshes auth's profile on every `updateProfile` and would otherwise hide the bug. It fails without the Settings fix and passes with it.
- 2026-11-26: final follow-up (re-review): Settings' read-then-write saves could overlap, so a second save read the profile before the first landed and reverted it. Every preferences read-modify-write (Settings' saves, Home's milestones and program) now goes through one queue in the new `src/app/cloud/profile-writes.ts` (`changePreferences`); `home/gamification.ts` delegates to it. Unit tests with a slow fake backend: two overlapping Settings saves, and a program enrolment overlapping a save, both keep every change (both fail without the queue).

## Questions for me

- [ ] Foundations' 14 days are a draft (src/lib/domain/programs.ts): approve for the demo, or send Harry's version? — Recommended: use the draft for the demo, Harry approves at the 27 Nov check-in. Options: Harry rewrites first; drop to 7 days

## Parked

- 2026-11-26 [product] The instrument ignores `program`/`day` in its query string: name "Foundations · Day 1" in its bar and on the results · seen on T-0124 · src/app/cloud/record/live/page.tsx
- 2026-11-26 [product] With the http adapter `useAuth().profile` is never refreshed after `updateProfile` (the local adapter's listeners refresh it), so other screens that save from it can still write stale data · seen on T-0124 · src/lib/backend/BackendProvider.tsx, src/lib/backend/http/auth.ts
- 2026-11-26 [product] The server types `gamification` as `Record<string, boolean>`; it holds `awarded` and `program` objects · seen on T-0124 · server/db/schema/people.ts
- 2026-11-26 [product] No way to leave or restart a program · seen on T-0124 · src/app/cloud/home/ProgramCard.tsx
- 2026-11-26 [product] Seeded "today" sessions can start later than now (hours 6-20), so they're in the future early in the morning · seen on T-0124 · src/lib/backend/local/seed.ts

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
$ npx vitest run src/lib/domain/programs.test.ts src/lib/domain/habit.test.ts      (A1, A2, A3)
 Test Files  2 passed (2)
      Tests  45 passed (45)
$ npx vitest run src/lib/backend/local                                             (A4)
 Test Files  14 passed (14)
      Tests  110 passed (110)
$ PORT=3203 npx playwright test e2e/program.spec.ts e2e/habit.spec.ts e2e/home-per-goal.spec.ts   (A5)
  ✓ habit.spec.ts › Calm's Home shows the daily ring, and new milestones once
  ✓ home-per-goal.spec.ts › Home differs for Train, Focus and Calm
  ✓ home-per-goal.spec.ts › someone linked to a professional sees their card first
  ✓ habit.spec.ts › a streak pauses after two missed days, in the goal's words and without red
  ✓ program.spec.ts › enrol in Foundations from Home, do day 1 on the simulated band, see 1 of 14 (1.2m)
  5 passed (1.2m)
$ PORT=3203 npx playwright test e2e/demo-path.spec.ts e2e/smoke.spec.ts e2e/results-per-goal.spec.ts   (neighbours on Home)
  5 passed (2.3m)
$ npm run check                                                                    (A6: lint, typecheck, test, build)
 exit 0 · Test Files 93 passed | 1 skipped (94) · Tests 1223 passed | 1 skipped (1224) · 27/27 static pages
$ git diff --stat main-of-card (80e3f70..working tree)
 CARD.md, src/app/cloud/AthleteHome.tsx (+3), src/app/cloud/home.css (+82),
 src/app/cloud/home/Milestones.tsx, src/lib/domain/habit.ts, src/lib/domain/types.ts (+12)
 new: e2e/program.spec.ts, src/app/cloud/home/ProgramCard.tsx, src/app/cloud/home/gamification.ts,
      src/lib/backend/local/program.test.ts, src/lib/domain/programs.ts, src/lib/domain/programs.test.ts
Fix round:
$ npx vitest run src/lib/domain src/app/cloud
 Test Files  37 passed (37) · Tests  374 passed (374)
$ npm run check
 exit 0 · Test Files 95 passed | 1 skipped (96) · Tests 1341 passed | 1 skipped (1342) · 27/27 static pages
$ PORT=3203 npx playwright test e2e/program.spec.ts e2e/habit.spec.ts e2e/home-per-goal.spec.ts e2e/onboarding.spec.ts
 7 passed (1.4m), including program.spec.ts › a Settings change made without a reload keeps the program
 (same spec with account/page.tsx reverted: 1 failed)
Final follow-up:
$ npx vitest run src/app/cloud src/lib/domain
 Test Files  38 passed (38) · Tests  377 passed (377)
$ npm run check
 exit 0 · Test Files 96 passed | 1 skipped (97) · Tests 1344 passed | 1 skipped (1345) · 27/27 static pages
$ PORT=3203 npx playwright test e2e/program.spec.ts e2e/onboarding.spec.ts
 3 passed (1.3m)
UNTESTED: real Bluetooth band; the http adapter / server path (server/routes/profile.ts uses the same validator, not run tonight); axe not run.
```
