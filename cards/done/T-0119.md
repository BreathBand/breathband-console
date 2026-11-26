# T-0119 · feat: mood check-in for Focus, before and after a session

Status: done
Branch: card/T-0119 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/03-launch-checklist.md J6; 01-product-spec.md (mood check-in, Focus); 02-onboarding-and-tailoring.md §3 Focus questions, §5.1 Home / Results / Gamification rows

## Why

Focus onboarding asks "Check in on your mood before and after?" and stores `goalDetails.focus.moodCheckins`
(T-0106), but nothing asks the mood, stores it or shows it. Focus's Results and Home both promise a
"mood change" (02 §5.1) and leave seams for it (T-0105, T-0108).

## Acceptance criteria

- [x] A1: a pure module says when to ask (Focus and the preference on; skipped when off or another goal), pairs check-ins per session, computes the change and a trend · check: `npx vitest run src/lib/domain/mood.test.ts`
- [x] A2: the local adapter stores a session's before/after mood with that session (own sessions only, 1–5 only) and lists them; http stubs the methods as unavailable · check: `npx vitest run src/lib/backend/local/mood.test.ts src/lib/backend/http/http.test.ts`
- [x] A3: Focus's results line mentions the mood change only when both moods exist · check: `npx vitest run src/app/cloud/results/tone.test.ts src/app/cloud/results/tone-mood.test.ts src/app/cloud/home/focus.test.ts`
- [x] A4: a Focus user is asked before and after, sees the change on results, and Home's Focus slot shows the trend; a Train user isn't asked · check: `PORT=3203 npx playwright test e2e/mood.spec.ts e2e/results-per-goal.spec.ts e2e/home-per-goal.spec.ts`
- [x] A5: everything else still passes · check: `npm run check`

## Files in scope

- `src/app/cloud/record/live/**` (the before/after prompt only; no recording or scoring changes: `page.tsx`, `Results.tsx`, new `MoodFaces.tsx`, `mood.css`)
- `src/app/cloud/results/tone.ts`, `src/app/cloud/results/tone-mood.test.ts` (new)
- `src/app/cloud/home/**` (the Focus slots: `Slots.tsx`, new `FocusSlots.tsx`, `focus.ts`, `focus.test.ts`, `focus.css`)
- `src/lib/domain/mood.ts`, `src/lib/domain/mood.test.ts` (new)
- `src/lib/domain/types.ts` (additive: `MoodScore`, `MoodCheckin`)
- `src/lib/backend/types.ts`, `src/lib/backend/local/**` (`index.ts`, `db.ts`, `seed.ts`, new `mood.test.ts`), `src/lib/backend/http/**` (`routes.ts` and its README table, for the new methods only)
- `firebase/firestore.rules`
- `e2e/mood.spec.ts` (new)
- `CARD.md`

## Out of scope

- The saved session review (`src/app/cloud/session/**`) showing the mood change.
- Settings toggle for mood check-ins (J7) and the study-day strip.
- `server/**` routes for `mood_checkins`.

## Constraints

- No new dependencies. Scoring formulas untouched. Static export stays.
- Screens reach mood data only through `useBackend()` / `useAuth()`.

## Skills

- none (night builder brief)

## Stop and ask

- If the mood needs a field on `SessionSummary` rather than a separate list.

## Next step

Lead merges card/T-0119; then a card shows the mood change on the saved session review (see Parked).

## Decisions

Appended by the session, one line each, newest last.

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; never change scoring formulas; additive `types.ts` contract change (a `MoodCheckin` type) only if needed and logged; existing tests may change where said; new backend capability updates `lib/backend/types.ts`, local adapter + tests and `firestore.rules` together, http may throw "unavailable" with a TODO naming the API card.

- 2026-11-26: `types.ts` contract change, additive only: `MoodScore` (1–5) and `MoodCheckin` {id, athleteId, sessionId | null, phase, mood, createdAt}, mirroring the server's `mood_checkins` table — needed so the adapter, rules and app agree on one shape.
- 2026-11-26: decided for the owner: check-ins are a separate list beside the session (`saveMoodCheckins` / `listMoodCheckins`), not a field on `SessionSummary` (alternative: optional `mood` on the summary; rejected because the server already models rows per phase).
- 2026-11-26: decided for the owner: check-ins are stored only once the session is saved (both at Save); a discarded session's before-mood is dropped (alternative: store the before-mood at once with sessionId null).
- 2026-11-26: decided for the owner: check-ins are private: a linked coach can't list them, in the adapter and in `firestore.rules` (alternative: readable with the "curves" scope).
- 2026-11-26: decided for the owner: deleting a session leaves its check-ins unlinked (sessionId null), mirroring the server's `on delete set null` (alternative: delete them with the session).
- 2026-11-26: decided for the owner: a Focus profile without goal answers counts as check-in on, the question's default (alternative: off until asked).
- 2026-11-26: decided for the owner: a check-in that fails to save (the http adapter until I-10) never blocks the session save (alternative: surface the error).
- 2026-11-26: decided for the owner: the before prompt sits on the Calibrated step above Begin and is optional; the after prompt sits with the note; a second tap clears a face.
- 2026-11-26: the local DB's version goes 8 → 9 (new `moodCheckins` field and Maya's seeded check-ins). Fix round: a v8 database is migrated in place (`migrateDb` in `local/db.ts`), so accounts and sessions recorded in the browser survive; seeded check-ins land only on seeded sessions (source "app", no `groupSessionId`, so neither web recordings nor group results get demo moods); a malformed `sessions` list reseeds; versions older than 8 or unknown still reseed.
- 2026-11-26: the exam countdown was cheap (a pure `nextExam` + one line), so `focus-exams` now shows "Exam in N days."; the study-day strip stays a seam.
- 2026-11-26: fix round: one existing test changed: `src/lib/backend/http/http.test.ts` "every other method fails ... unavailable" now accepts a message naming I-09 or I-10 (was I-09 only), because the mood routes' message names "API card I-10". New test: `src/lib/backend/local/db-migrate.test.ts`. Restart now clears the before-mood.
- 2026-11-26: before the fix round, no existing test changed.
- 2026-11-26: merged night/2026-11-26 (T-0121, I-09 coaching on http): kept T-0121's adapter and tests; the remaining unavailable methods (I-10 set plus the mood check-ins) all fail naming "API card I-10", so my `http.test.ts` change is superseded by T-0121's `stringContaining("I-10")`. After the merge: `npx vitest run src/lib/backend` 18 files / 374 tests passed; `npm ci` then `npm run check` exit 0, 1206 passed | 1 skipped. New tests: `src/lib/domain/mood.test.ts`, `src/lib/backend/local/mood.test.ts`, `src/app/cloud/results/tone-mood.test.ts`, `src/app/cloud/home/focus.test.ts`, `e2e/mood.spec.ts`.
- 2026-11-26: styles went in new files beside the components (`record/live/mood.css`, `home/focus.css`) rather than `record.css` / `home.css`, which are outside the card's scope; no new colour tokens were needed.

## Questions for me

- [ ] Should the HTTP routes for mood check-ins be part of I-10 or a card of their own? — Recommended: I-10 (the TODO in `routes.ts` and the http error name it). Options: a new I-card after I-08.

## Parked

- 2026-11-26 [product] The saved session review (`/cloud/session/`) doesn't show the mood change yet; the live results do · seen on T-0119 · src/app/cloud/session/SessionReview.tsx
- 2026-11-26 [product] No Settings switch for the mood check-in after onboarding (J7 territory) · seen on T-0119 · src/app/cloud/account/**
- 2026-11-26 [product] Demo plan says Sam is Focus with an exam on 15 Dec; the seed has Sam on Train and Maya on Focus with no exam date · seen on T-0119 · src/lib/backend/local/seed.ts, planning/v1/05-demo-plan.md
- 2026-11-26 [product] Focus Home's study-day strip is still a seam · seen on T-0119 · src/app/cloud/home/FocusSlots.tsx

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
$ npx vitest run src/lib/domain/mood.test.ts src/lib/backend/local/mood.test.ts src/lib/backend/http/http.test.ts     src/app/cloud/results/tone.test.ts src/app/cloud/results/tone-mood.test.ts src/app/cloud/home/focus.test.ts
 Test Files  6 passed (6)
      Tests  115 passed (115)

$ PORT=3203 npx playwright test e2e/mood.spec.ts e2e/results-per-goal.spec.ts e2e/home-per-goal.spec.ts
  ✓ home-per-goal.spec.ts › Home differs for Train, Focus and Calm (7.4s)
  ✓ home-per-goal.spec.ts › someone linked to a professional sees their card first (2.1s)
  ✓ mood.spec.ts › a Focus session asks the mood before and after, and the change shows on the results and Home (1.1m)
  ✓ mood.spec.ts › a Train session never asks the mood (28.2s)
  ✓ results-per-goal.spec.ts › the results differ for Train and Calm: what leads, and the coaching line (2.2m)
  5 passed (2.2m)

$ rm -rf playwright-report test-results && npm run check     (lint, typecheck, vitest, build)
exit 0
 Test Files  79 passed | 1 skipped (80)
      Tests  922 passed | 1 skipped (923)
✓ Generating static pages (27/27)

$ git diff --stat 9601548   (after the card draft)
 e2e/mood.spec.ts, firebase/firestore.rules,
 src/app/cloud/home/{FocusSlots.tsx,Slots.tsx,focus.css,focus.test.ts,focus.ts},
 src/app/cloud/record/live/{MoodFaces.tsx,Results.tsx,mood.css,page.tsx},
 src/app/cloud/results/{tone-mood.test.ts,tone.ts},
 src/lib/backend/http/{README.md,routes.ts}, src/lib/backend/local/{db.ts,index.ts,mood.test.ts,seed.ts},
 src/lib/backend/types.ts, src/lib/domain/{mood.test.ts,mood.ts,types.ts}
 23 files changed, 1082 insertions(+), 16 deletions(-)

Fix round (after merging night/2026-11-26):
$ npx vitest run src/lib/backend/local src/lib/domain/mood.test.ts
 Test Files  14 passed (14)
      Tests  120 passed (120)
$ rm -rf playwright-report test-results && npm run check
exit 0 · lint clean · Test Files 89 passed | 1 skipped · Tests 1093 passed | 1 skipped · build 27/27 pages
Follow-up (seeded filter source === "app", no group rows): npx vitest run src/lib/backend/local → 13 files, 108 tests passed; npm run check → exit 0, 1093 passed | 1 skipped, lint clean, build OK.
e2e not rerun in the fix round (UNTESTED after the fix; the UI change is one setState on restart).

Screenshots looked at (Playwright attachments): Calibrated step with the five faces; Focus results with
"32 calm seconds. On target 83% of the time. Mood up from low to good."; Maya's Home with the mood strokes,
"Your mood rises 1 point on average after a session." and "Exam in 10 days." UNTESTED: axe, 375px of the
new prompt (the faces wrap; 5 × 56px fits), firestore.rules against the emulator (no emulator run tonight).
```
