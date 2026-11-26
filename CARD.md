# T-0116 · feat: professional terminology across the coach UI and default flags per kind

Status: in progress
Branch: card/T-0116 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/03-launch-checklist.md K5, E4; 02-onboarding-and-tailoring.md §4.1 step 7, §5.2 ("People are called", "Default flags"), §7

## Why

T-0112 stores what a professional calls the people they work with (`proProfile.terminology`), but every
coach-facing screen still says "athlete(s)", so a clinician sees "athletes" everywhere. And every
professional gets the coach's "Needs a look" flags, though a clinician starts with missed days only and an
educator with none.

## Acceptance criteria

- [ ] A1: `useTerms()` gives the signed-in professional's nouns (kind default, then their own choice; "athletes" for older accounts) · check: `npx vitest run src/app/cloud/useTerms.test.ts src/lib/domain/terminology.test.ts`
- [ ] A2: default flags per kind: coach keeps `DEFAULT_ALERTS`, clinician 3 missed days only, educator off; used when no rules were saved · check: `npx vitest run src/lib/domain/default-flags.test.ts`
- [ ] A3: a clinician sees "clients" across dashboard, roster and invite; the demo coach still sees "athletes" · check: `PORT=3203 npx playwright test e2e/pro-terminology.spec.ts e2e/smoke.spec.ts`
- [ ] A4: everything else still passes · check: `npm run check`

## Files in scope

- Coach-facing screens under `src/app/cloud/**` that show "athlete(s)" to the professional: `CoachDashboard.tsx`, `Roster.tsx`, `AthletePicker.tsx`, `AthleteWorkspace.tsx`, `AthleteConsole.tsx`, `AthleteOverview.tsx`, `TrendsTab.tsx`, `PlanTab.tsx`, `NotesTab.tsx`, `SessionsTab.tsx`, `InviteAthlete.tsx`, `SquadManager.tsx`, `SquadFilter.tsx`, `CloudShell.tsx`, `useTeam.ts`, `page.tsx`, `athletes/page.tsx`, `account/**`, `group/**`, `trends/**`, `report/**`, `sharing/**`, `sessions/page.tsx`, `session/**` (coach view wording only)
- `src/app/cloud/useTerms.ts`, `src/app/cloud/useTerms.test.ts` (new)
- `src/lib/domain/terminology.ts` (extend only), `src/lib/domain/terminology.test.ts` (new cases only)
- `src/lib/domain/default-flags.ts`, `src/lib/domain/default-flags.test.ts` (new)
- `src/app/cloud/home/tailor.ts` + `tailor.test.ts` (new cases) only if the linked professional's kind is cheaply readable
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

Build: `useTerms` + default-flags helper, then sweep the coach screens.

## Decisions

Appended by the session, one line each, newest last.

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; no contract changes; existing tests may change only where wording assertions change; don't touch types.ts, backend, record/**, welcome/** (except the caveat line), package.json, server/**.

## Questions for me

## Parked

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (the lead opens it)

### Evidence

```
<commands and results>
```
