# T-0131 · docs+test: demo script v2 and the end-to-end paths it walks (U1, P1)

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0131 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/05-demo-plan.md ("Demo script v2"); 03-launch-checklist.md U1, P1

## Why

`docs/DEMO.md` is the v1 walkthrough (Alex and Lena only); the v2 script in 05 (two individuals side by side, a
clinician onboarding, invite → session → review) isn't written down against what the app does today. P1's end-to-end
coverage is partial: no single spec walks every goal, every professional kind, or invite → review, and nothing keeps
the script from drifting away from the app.

## Acceptance criteria

- [ ] A1 (U1): `docs/DEMO.md` is demo script v2 on the local backend: before-the-demo steps, Maya beside Alex, a new
  Calm person live, a clinician onboarding, invite → accept → session → review, the coach; exact clicks, demo accounts
  and passwords as the login page shows them; anything not built marked "not built" with its checklist id · check:
  read `docs/DEMO.md`; `e2e/demo-script.spec.ts` walks its steps
- [ ] A2 (P1): individual onboarding for Train, Focus and Calm, and professional onboarding for coach, clinician and
  educator · check: `PORT=3203 npx playwright test e2e/p1-onboarding-matrix.spec.ts` (twice)
- [ ] A3 (P1): a professional creates an invite with a first practice, a new person accepts it through `/cloud/join/`
  (signed in), records the assigned session on the simulated band, and the professional sees it and comments · check:
  `PORT=3203 npx playwright test e2e/p1-invite-to-review.spec.ts` (twice)
- [ ] A4: the script's steps pass in a browser · check: `PORT=3203 npx playwright test e2e/demo-script.spec.ts` (twice)
- [ ] A5: existing demo specs still pass · check: `PORT=3203 npx playwright test e2e/smoke.spec.ts e2e/demo-path.spec.ts e2e/demo-people.spec.ts`
- [ ] A6: CI passes · check: `rm -rf playwright-report test-results && npm run check`

## Files in scope

- `docs/DEMO.md`
- new `e2e/p1-*.spec.ts`
- new `e2e/demo-script.spec.ts`
- new `e2e/helpers/**`
- `CARD.md`

## Out of scope

- Any app code, including bugs the specs find (parked or asked, not fixed).
- `src/app/cloud/join/**`, `CloudShell.tsx`, `e2e/invited-path.spec.ts` (T-0129, the public join page).
- Existing specs and `e2e/auth.ts`; a "reset demo" action (U3).

## Constraints

- No new dependencies. No app code changes. Port 3203 only.

## Skills

- none

## Stop and ask

- A step of the script can't be done in the app today and isn't plainly "not built".

## Next step

Write docs/DEMO.md v2 and the three specs.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight full-queue note): lane 3 U1, P1; no app code changes; no new dependencies.

## Questions for me

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
```
