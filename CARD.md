# T-0105 · feat: athlete home tailored per goal

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0105 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §5.1 (Home row) and §3.5; 03-launch-checklist.md I2; 01-product-spec.md (Home)

## Why

The athlete's Home looks the same whatever their goal. v1 tailors it: Train is dense (week card
with average rate, depth trend, sessions vs plan), Focus leads with the score, Calm is minimal with
one encouraging line, and someone who came through a professional sees that person's card first.

## Acceptance criteria

- [x] A1: a pure layout choice per goal: which sections, density and emphasis for Train / Focus / Calm; the professional's card only when linked to one (clinician: always first, no streak; coach: until the first assignment is done) · check: `npx vitest run src/app/cloud/home/`
- [x] A2: Train's week card numbers (sessions vs plan, average rate, depth trend) and Calm's line are computed and tested · check: same command
- [x] A3: in the browser, Home differs between Train, Focus and Calm for the demo athlete (goal switched in Settings) · check: `PORT=3203 npx playwright test e2e/home-per-goal.spec.ts`
- [x] A4: everything else still passes · check: `npm run check`

## Files in scope

- `src/app/cloud/AthleteHome.tsx`
- `src/app/cloud/AthleteHome.test.ts` (unchanged in the end; the new tests live beside the new module)
- `src/app/cloud/home.css`
- `src/app/cloud/home/**` (new): `tailor.ts`, `tailor.test.ts`, `WeekCard.tsx`, `ProfessionalCard.tsx`, `Slots.tsx`
- `e2e/home-per-goal.spec.ts` (new)
- `CARD.md`

## Out of scope

- Focus's mood change and exam countdown / study-day strip (need J6 and D4–D6 data): seams only (`HomeSlot` in `home/Slots.tsx`, listed per goal in `homeLayout().slots`).
- Calm's daily ring (J1): seam only (`calm-ring` slot).
- Recording the professional's kind (`proKind`) or how a link was made (invite vs athlete's code): lane 2 owns `types.ts`; the card reads whatever link exists.
- Results emphasis per goal (the other half of I2), session defaults, reminders.

## Constraints

- No new dependencies. No edits to `src/lib/domain/types.ts`, `src/lib/backend/**`, signup, welcome, record.
- Data only through `useBackend()` / `useAuth()` (via the workspace).

## Skills

None needed.

## Stop and ask

- Anything that needs a new field on the profile or link.

## Next step

Done; the lead reviews and opens the PR against the integration branch.

## Decisions

Appended by the session, one line each, newest last.

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; existing tests may change only where named here (none changed); files limited to the list above.
- 2026-11-26: the module is `home/tailor.ts`, not `home/layout.ts`: `layout.ts` under `src/app` is a Next.js route layout and broke `next typegen`.
- 2026-11-26: decided for the owner: "came through a professional" = the athlete has a linked coach (`ws.coachName`), read as kind `coach`, because a `CoachLink` records neither how it was made nor the professional's kind (alternative: wait for a `proKind` / `via` field from lane 2). `professionalOf()` is the one place to change.
- 2026-11-26: decided for the owner: the professional's card leads Home until the first practice they set is done (§3.5); a clinician's always leads and turns the streak off (§5.1 "no streak pressure"). While it leads, the side pane's "From your coach" block is dropped so the practice and comment aren't shown twice (alternative: keep both).
- 2026-11-26: decided for the owner: Train's week card = sessions since Monday vs the weekly target, mean open-session rate over the last 7 days, mean depth sub-score over the last 7 days and its change on the 7 before (alternative: calendar weeks for rate and depth too, which go blank every Monday).
- 2026-11-26: decided for the owner: Focus shows the score trend over 2 weeks without the rate bars; Train keeps 8 weeks with rate bars; no goal keeps today's page (alternative: Focus at 7 days, the History default in §5.1).
- 2026-11-26: decided for the owner: Calm's line copy: "Nice. Three days in a row." / "Done for today. Nice." / "Yesterday's done. Three minutes today makes two days in a row." / "Two days in a row. Three minutes today keeps it going." / "Your next session takes three minutes." (minutes from the saved session length).

## Questions for me

- [x] Should the "invited" card require an actual invite (the professional's link or code) rather than any coach link? It needs a field on `CoachLink` (e.g. `via: "invite" | "code"`) and `proKind` on the profile, both lane 2's `types.ts` — Recommended: add both with the D1 card and change `professionalOf()` then. Options: keep "any linked coach"; add only `proKind`.
  Answer: add both with the D1 card and change `professionalOf()` then

## Parked

- 2026-11-26 [product] DESIGN.md's Home row ("four stats; the 8-week score trend") no longer describes the per-goal Home; update it to mention Train / Focus / Calm and the professional's card · seen on T-0105 · DESIGN.md
- 2026-11-26 [tool] e2e/auth.ts only exports Alex and Lena sign-ins; the new spec signs in as Maya by clicking her demo card directly · seen on T-0105 · e2e/home-per-goal.spec.ts

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (the lead opens it)

### Evidence

```
$ npx vitest run src/app/cloud/home/ src/app/cloud/AthleteHome.test.ts
 Test Files  2 passed (2)
      Tests  26 passed (26)      (21 new in home/tailor.test.ts)

$ PORT=3203 npx playwright test e2e/home-per-goal.spec.ts
  ✓  1 [chromium] › e2e\home-per-goal.spec.ts:25:1 › Home differs for Train, Focus and Calm (7.8s)
  ✓  2 [chromium] › e2e\home-per-goal.spec.ts:63:1 › someone linked to a professional sees their card first (2.3s)
  2 passed (13.7s)
  (screenshots of each goal, the professional's card, and 375 px attached to the HTML report)

$ PORT=3203 npx playwright test e2e/smoke.spec.ts e2e/onboarding.spec.ts
  3 passed (8.3s)

$ npm run check            (lint, typecheck, test, build)
 eslint: clean
 next typegen && tsc --noEmit: clean
 Test Files  45 passed (45)
      Tests  512 passed (512)
 ✓ Compiled successfully; static export built
 exit 0

UNTESTED: e2e/demo-path.spec.ts (records real-time sessions; Home assertion there is "Last session" region, unchanged); axe on Home.

$ git diff --stat main-of-card (see commit)
 CARD.md, e2e/home-per-goal.spec.ts, src/app/cloud/AthleteHome.tsx, src/app/cloud/home.css,
 src/app/cloud/home/{tailor.ts,tailor.test.ts,WeekCard.tsx,ProfessionalCard.tsx,Slots.tsx}
```
