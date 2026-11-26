# T-0131 · docs+test: demo script v2 and the end-to-end paths it walks (U1, P1)

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0131 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/05-demo-plan.md ("Demo script v2"); 03-launch-checklist.md U1, P1

## Why

`docs/DEMO.md` is the v1 walkthrough (Alex and Lena only); the v2 script in 05 (two individuals side by side, a
clinician onboarding, invite → session → review) isn't written down against what the app does today. P1's end-to-end
coverage is partial: no single spec walks every goal, every professional kind, or invite → review, and nothing keeps
the script from drifting away from the app.

## Acceptance criteria

- [x] A1 (U1): `docs/DEMO.md` is demo script v2 on the local backend: before-the-demo steps, Maya beside Alex, a new
  Calm person live, a clinician onboarding, invite → accept → session → review, the coach; exact clicks, demo accounts
  and passwords as the login page shows them; anything not built marked "not built" with its checklist id · check:
  read `docs/DEMO.md`; `e2e/demo-script.spec.ts` walks its steps
- [x] A2 (P1): individual onboarding for Train, Focus and Calm, and professional onboarding for coach, clinician and
  educator · check: `PORT=3203 npx playwright test e2e/p1-onboarding-matrix.spec.ts` (twice)
- [x] A3 (P1): a professional creates an invite with a first practice, a new person accepts it through `/cloud/join/`
  (signed in), records the assigned session on the simulated band, and the professional sees it and comments · check:
  `PORT=3203 npx playwright test e2e/p1-invite-to-review.spec.ts` (twice)
- [x] A4: the script's steps pass in a browser · check: `PORT=3203 npx playwright test e2e/demo-script.spec.ts` (twice)
- [x] A5: existing demo specs still pass · check: `PORT=3203 npx playwright test e2e/smoke.spec.ts e2e/demo-path.spec.ts e2e/demo-people.spec.ts`
- [x] A6: CI passes · check: `rm -rf playwright-report test-results && npm run check`

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

Done: for the lead to review and merge; the specs run on the local backend, the invite one takes about 4 minutes.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight full-queue note): lane 3 U1, P1; no app code changes; no new dependencies.
- 2026-11-26: decided for the owner: the invite spec has demo Ana invite from her Clients page with "Weekly open check" (Open, 3 min), recorded in full so it counts toward the practice (alternative: Between visits, Paced 5-5 · 5 min, two minutes longer per run; stopping early doesn't count).
- 2026-11-26: The invited person signs up first and opens the link signed in (today's join page), so the spec doesn't depend on T-0129's signed-out join page.
- 2026-11-26: decided for the owner: script part 3 uses Calm's real first session (Just breathe, Open, 3 min) stopped early at about 40 s; the plan's "2-minute first session" isn't offered (alternative: change the session length on "Your sessions" to 2 min, which changes the person's default too).
- 2026-11-26: Window B in the script is a second profile or Guest window: two windows of one profile share one sign-in (checked: the second can't reach the demo buttons while the first is signed in). The spec uses a second browser context for it.
- 2026-11-26: Shared steps for the new specs are in new `e2e/helpers/flows.ts`; no existing spec and not `e2e/auth.ts` changed.
- 2026-11-26: Checked the "before the demo" path: the demo specs pass against `out/` served by serve@14.2.4 (as `npm run preview` does), on 3203.

## Questions for me

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

- 2026-11-26 [product] A clinician's comment shows "· coach" after her name to her client (E4) · seen on T-0131 · src/app/cloud/session/SessionReview.tsx
- 2026-11-26 [product] A clinician's client sees "From your coach" above the practice on New session (E4) · seen on T-0131 · src/app/cloud/record/page.tsx
- 2026-11-26 [product] Jordan's Home band card offers "Start Open · 3 min" while Ana's practice is Paced 5-5 · 5 min · seen on T-0131 · src/app/cloud/AthleteHome.tsx
- 2026-11-26 [product] Results round an open session's rate to a whole breath (14 br/min) while the review shows 13.9 · seen on T-0131 · src/app/cloud/record/live/Results.tsx
- 2026-11-26 [product] After a 0:37 Calm session, results and Home say "Done for today. Nice." while Today shows "0 of 3 min" · seen on T-0131 · src/app/cloud/results/tone.ts
- 2026-11-26 [product] A Calm individual with no professional (Maya, a new Calm user) sees an empty "From your coach" panel on Home · seen on T-0131 · src/app/cloud/AthleteHome.tsx
- 2026-11-26 [product] Lena's squads are Juniors and Sprint squad, not the plan's "Rowing 1st VIII" (U2) · seen on T-0131 · src/lib/backend/local/seed.ts
- 2026-11-26 [checklist] 03's statuses are stale: D3-D6, E1-E10, J3, J5, J6 say Missing or Partial but are built · seen on T-0131 · planning/v1/03-launch-checklist.md
- 2026-11-26 [tool] `npm run preview` fetches serve@14.2.4 through npx, so the first run needs the network (U3) · seen on T-0131 · package.json
- 2026-11-26 [tool] Stopping a background `npm run dev` left next's start-server child listening on the port; killed it by PID · seen on T-0131 · npm run dev -- --port 3203

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
$ PORT=3203 npx playwright test e2e/p1-onboarding-matrix.spec.ts e2e/p1-invite-to-review.spec.ts e2e/demo-script.spec.ts   (A1-A4, run 1)
  12 passed (3.9m)   # matrix 6 × ~6-8 s; invite-to-review 3.8m; demo-script 1.1s, 4.2s, 1.3m, 17.4s, 1.1m
$ (same command, run 2)
  12 passed (3.8m)
$ PORT=3203 npx playwright test e2e/smoke.spec.ts e2e/demo-path.spec.ts e2e/demo-people.spec.ts   (A5)
  10 passed (2.3m)
$ rm -rf playwright-report test-results && npm run check   (A6) · exit 0
  lint clean · typecheck clean
  Test Files  103 passed | 1 skipped (104)
       Tests  1439 passed | 1 skipped (1440)
  ✓ Compiled successfully · Generating static pages (27/27)
$ npx --yes serve@14.2.4 out -l 3203   # the static build, as DEMO.md's "Before the demo" serves it
$ PORT=3203 npx playwright test e2e/demo-script.spec.ts e2e/demo-path.spec.ts e2e/demo-people.spec.ts e2e/smoke.spec.ts
  15 passed (2.7m)
Servers stopped; nothing listening on 3203 afterwards.

git diff --stat 3bafa6a..HEAD (all in scope):
 CARD.md, docs/DEMO.md, e2e/demo-script.spec.ts (new), e2e/helpers/flows.ts (new),
 e2e/p1-invite-to-review.spec.ts (new), e2e/p1-onboarding-matrix.spec.ts (new)

UNTESTED: the script with a real band (Web Bluetooth); the script read through by a person at 1280 px in two profiles;
`npm run preview` on port 3000 offline (served with -l 3203 here, online).
```
