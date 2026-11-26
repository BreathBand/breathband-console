# T-0116 · feat: professional terminology across the coach UI and default flags per kind

Status: done
Branch: card/T-0116 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/03-launch-checklist.md K5, E4; 02-onboarding-and-tailoring.md §4.1 step 7, §5.2 ("People are called", "Default flags"), §7

## Why

T-0112 stores what a professional calls the people they work with (`proProfile.terminology`), but every
coach-facing screen still says "athlete(s)", so a clinician sees "athletes" everywhere. And every
professional gets the coach's "Needs a look" flags, though a clinician starts with missed days only and an
educator with none.

## Acceptance criteria

- [x] A1: `useTerms()` gives the signed-in professional's nouns (kind default, then their own choice; "athletes" for older accounts) · check: `npx vitest run src/app/cloud/useTerms.test.ts src/lib/domain/terminology.test.ts`
- [x] A2: default flags per kind: coach keeps `DEFAULT_ALERTS`, clinician 3 missed days only, educator off; used when no rules were saved · check: `npx vitest run src/lib/domain/default-flags.test.ts`
- [x] A3: a clinician sees "clients" across dashboard, roster and invite; the demo coach still sees "athletes" · check: `PORT=3203 npx playwright test e2e/pro-terminology.spec.ts e2e/smoke.spec.ts`
- [x] A4: everything else still passes · check: `npm run check`

## Files in scope

- Coach-facing screens under `src/app/cloud/**` that show "athlete(s)" to the professional: `CoachDashboard.tsx`, `Roster.tsx`, `AthletePicker.tsx`, `AthleteWorkspace.tsx`, `AthleteConsole.tsx`, `AthleteOverview.tsx`, `TrendsTab.tsx`, `PlanTab.tsx`, `NotesTab.tsx`, `SessionsTab.tsx`, `InviteAthlete.tsx`, `SquadManager.tsx`, `SquadFilter.tsx`, `CloudShell.tsx`, `useTeam.ts`, `page.tsx`, `athletes/page.tsx`, `account/**`, `group/**`, `trends/**`, `report/**`, `sharing/**`, `sessions/page.tsx`, `session/**` (coach view wording only)
- `src/app/cloud/useTerms.ts`, `src/app/cloud/useTerms.test.ts` (new)
- `src/lib/domain/terminology.ts` (extend only), `src/lib/domain/terminology.test.ts` (new cases only)
- `src/lib/domain/default-flags.ts`, `src/lib/domain/default-flags.test.ts` (new)
- `src/app/cloud/home/tailor.ts` + `tailor.test.ts` (new cases) only if the linked professional's kind is cheaply readable (it was: plus the one call in `src/app/cloud/AthleteHome.tsx`)
- `src/app/cloud/welcome/ProSteps.tsx` (the "still say athletes" caveat line only)
- `e2e/pro-terminology.spec.ts` (new)
- `CARD.md`

## Out of scope

- The athlete's own screens (AthleteHome, home/**, results/**, record/**, the athlete's session review wording).
- Emails (the server's digest wording) and `server/**`; the backend telling "no saved rules" apart (`src/lib/backend/**`).
- Default targets and scope per kind (E6, the rest of §4.1 step 7).

## Constraints

- No new dependencies. No contract changes (`src/lib/domain/types.ts` untouched). Static export stays.
- Screens get terms through `useAuth()`'s profile + `peopleNouns()` only.

## Skills

- `quality/deslop` — `/done` runs it on the diff.

## Stop and ask

- If default flags need the backend to say whether rules were saved.

## Next step

Lead reviews and opens the draft PR; parked items go to BACKLOG.md.

## Decisions

Appended by the session, one line each, newest last.

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; no contract changes; existing tests may change only where wording assertions change; don't touch types.ts, backend, record/**, welcome/** (except the caveat line), package.json, server/**.

- 2026-11-26: decided for the owner: saved alert rules equal to `DEFAULT_ALERTS` are read as "never saved", so a non-coach gets their kind's defaults (alternative: the backend says whether a row exists; that's `src/lib/backend/**`, out of this card). Side effect: a clinician or educator who saves exactly the coach's full set sees their kind's defaults again. Parked.
- 2026-11-26: decided for the owner: a coach (and an account of unknown kind) keeps the full `DEFAULT_ALERTS`, a superset of the spec's "3 missed days, Total down 2", so existing coaches see no change (alternative: switch coaches to just those two).
- 2026-11-26: decided for the owner: "N of M athletes trained" became "N of M {people} practised", since "clients trained" reads wrong (alternative: keep "trained" for coaches only).
- 2026-11-26: decided for the owner: the report's "Prepared by" reads "Name, coach / clinician / teacher" from the kind (`PRO_WORD`); the live-group chart's aria-label says "people" instead of "athletes".
- 2026-11-26: T-0105's `professionalOf()` now takes the linked professional's `proKind` (read from `listCoaches()`'s profile, already loaded); needed one line in `src/app/cloud/AthleteHome.tsx` (pass `ws.coachKind`), outside the listed scope but invited by the lead.
- 2026-11-26: existing test changed for wording only: `src/app/cloud/trends/compare-table.test.ts` reads the page source, so its first header is now `{terms.One}` and its label regex also accepts `label={...}`; the header/label order check is unchanged.
- 2026-11-26: added `aPerson()` ("an athlete" / "a client") to `src/lib/domain/terminology.ts` and `proKindOf()` / `useProKind()` beside `useTerms()`.

## Questions for me

## Parked

- 2026-11-26 [product] Alert rules: the API can't say "nothing saved", so a non-coach who saves exactly the coach's full set falls back to their kind's defaults; `getAlertRules` could return null (or the kind's defaults server-side, `pro_profiles.default_flags` exists) · seen on T-0116 · src/lib/backend/local/index.ts getAlertRules
- 2026-11-26 [product] Compare CSV header still says "Athlete" for every professional · seen on T-0116 · src/lib/domain/csv.ts compareCsv
- 2026-11-26 [product] Two-person recording (`record/duo`) and the open-session note in SessionReview ("the athlete tapped") still say athlete to a professional · seen on T-0116 · src/app/cloud/record/duo, src/app/cloud/session/SessionReview.tsx
- 2026-11-26 [product] The role label under the name (sidebar) and "Account type" in Settings say "Coach" for a clinician or educator · seen on T-0116 · src/app/cloud/CloudShell.tsx, src/app/cloud/account/page.tsx
- 2026-11-26 [product] Athlete-facing copy names the coach's page "Athletes" ("They enter it on their Athletes page") whatever the professional calls it · seen on T-0116 · src/app/cloud/settings/SharingPanel.tsx
- 2026-11-26 [product] Emails (E4 "and emails") still use fixed wording; server digests should read `pro_profiles.terminology` · seen on T-0116 · server/**
- 2026-11-26 [tool] `npm run lint` lints `playwright-report/` after an e2e run (133 errors) because eslint.config.mjs doesn't ignore it; delete the folder before `npm run check` · seen on T-0116 · eslint.config.mjs

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below), except the one AthleteHome line under Decisions
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (the lead opens it)

### Evidence

```
$ npx vitest run src/app/cloud/useTerms.test.ts src/lib/domain/terminology.test.ts src/lib/domain/default-flags.test.ts src/app/cloud/home/tailor.test.ts src/app/cloud/trends/compare-table.test.ts
 Test Files  5 passed (5)
      Tests  46 passed (46)

$ PORT=3203 npx playwright test e2e/pro-terminology.spec.ts e2e/smoke.spec.ts
  ✓ smoke › the coach signs in and sees the Athletes roster
  ✓ smoke › the athlete signs in and sees their last session on the home page
  ✓ pro-terminology › a clinician sees clients across the dashboard, roster and invite, and starts with the missed-days flag only
  ✓ pro-terminology › the demo coach still sees athletes, and the coach's full set of flags
  ✓ pro-terminology › a new clinician who signs up lands on a dashboard waiting for their first client
  5 passed (17.1s)

$ PORT=3203 npx playwright test e2e/onboarding-pro.spec.ts   (welcome caveat line changed)
  3 passed (17.0s)

$ npm run check   (lint, typecheck, tests, build; after deleting playwright-report/)
exit=0
✓ Types generated successfully
 Test Files  71 passed | 1 skipped (72)
      Tests  813 passed | 1 skipped (814)
✓ Compiled successfully; 27 static pages

$ git diff --stat e255db7..4babb4a
 28 files changed, 479 insertions(+), 107 deletions(-)
 new: e2e/pro-terminology.spec.ts, src/app/cloud/useTerms.ts (+test), src/lib/domain/default-flags.ts (+test)

UNTESTED: the other e2e specs (demo-path, habit, home-per-goal, onboarding*, results-per-goal, signup-consents) were not run; the athlete Home for a clinician-linked person (now kind "clinician") has unit coverage only.
```
