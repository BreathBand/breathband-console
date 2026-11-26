# T-0119 · feat: mood check-in for Focus, before and after a session

Status: in progress
Branch: card/T-0119 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/03-launch-checklist.md J6; 01-product-spec.md (mood check-in, Focus); 02-onboarding-and-tailoring.md §3 Focus questions, §5.1 Home / Results / Gamification rows

## Why

Focus onboarding asks "Check in on your mood before and after?" and stores `goalDetails.focus.moodCheckins`
(T-0106), but nothing asks the mood, stores it or shows it. Focus's Results and Home both promise a
"mood change" (02 §5.1) and leave seams for it (T-0105, T-0108).

## Acceptance criteria

- [ ] A1: a pure module says when to ask (Focus and the preference on; skipped when off or another goal), pairs check-ins per session, computes the change and a trend · check: `npx vitest run src/lib/domain/mood.test.ts`
- [ ] A2: the local adapter stores a session's before/after mood with that session (own sessions only, 1–5 only) and lists them; http stubs the methods as unavailable · check: `npx vitest run src/lib/backend/local/mood.test.ts src/lib/backend/http/http.test.ts`
- [ ] A3: Focus's results line mentions the mood change only when both moods exist · check: `npx vitest run src/app/cloud/results/tone.test.ts src/app/cloud/results/tone-mood.test.ts`
- [ ] A4: a Focus user is asked before and after, sees the change on results, and Home's Focus slot shows the trend; a Train user isn't asked · check: `PORT=3203 npx playwright test e2e/mood.spec.ts e2e/results-per-goal.spec.ts e2e/home-per-goal.spec.ts`
- [ ] A5: everything else still passes · check: `npm run check`

## Files in scope

- `src/app/cloud/record/live/**` (the before/after prompt only; no recording or scoring changes)
- `src/app/cloud/results/tone.ts`, `src/app/cloud/results/tone-mood.test.ts` (new)
- `src/app/cloud/home/**` (the Focus slots)
- `src/lib/domain/mood.ts`, `src/lib/domain/mood.test.ts` (new)
- `src/lib/domain/types.ts` (additive: `MoodScore`, `MoodCheckin`)
- `src/lib/backend/types.ts`, `src/lib/backend/local/**` (+ new `mood.test.ts`), `src/lib/backend/http/**` (routes/stub for the new methods only)
- `firebase/firestore.rules`
- `src/app/cloud/record/record.css`, `src/app/globals.css` (styles for the prompt and slot, if needed)
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

Build: domain module, backend capability, live prompt, results line, Home slot, e2e.

## Decisions

Appended by the session, one line each, newest last.

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; never change scoring formulas; additive `types.ts` contract change (a `MoodCheckin` type) only if needed and logged; existing tests may change where said; new backend capability updates `lib/backend/types.ts`, local adapter + tests and `firestore.rules` together, http may throw "unavailable" with a TODO naming the API card.

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
<commands and results>
```
