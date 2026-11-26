# T-0120 · feat: professional onboarding ends with try-it-yourself, an invite (link and QR) and a dashboard checklist per kind

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0120 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §4.1 steps 9–11, §6 ("No band yet" sample rule); 03-launch-checklist.md E8, E9, E10

## Why

Professional onboarding stops at the terms and hands the professional an empty dashboard. They never feel a session themselves, the first invite is a separate page with no QR code to show in a room, and nothing tells a new professional what to do next or what a person will look like once they join.

## Acceptance criteria

- [x] A1: Checklist items per kind (coach, clinician, educator) and their done-state come from a pure module; the sample person shows only with zero real people · check: `npx vitest run src/lib/domain/getting-started.test.ts`
- [x] A2: The invite QR code is built from the invite link client-side (no server, static export stays) · check: `npx vitest run src/app/cloud/invite-qr.test.ts`
- [x] A3: After the terms, a professional can try a session (the existing recorder route, simulated band allowed) or skip, then create an invite and see its link, a QR code and a copy button in their own terms, then land on a dashboard checklist with a sample person labelled "Sample"; the demo coach's dashboard (who has athletes and no kind) is unchanged · check: `PORT=3202 npx playwright test e2e/onboarding-pro-invite.spec.ts e2e/onboarding-pro.spec.ts e2e/onboarding-pro-terms.spec.ts e2e/pro-terminology.spec.ts e2e/smoke.spec.ts`
- [x] A4: Sample data is never written to the account · check: the e2e above reads the local DB (no sessions for the new professional)
- [x] A5: `npm run check` passes (after removing playwright-report/ and test-results/)

## Files in scope

- `src/app/cloud/welcome/**`
- `src/app/cloud/CoachDashboard.tsx`, new `src/app/cloud/dashboard/**`
- `src/app/cloud/InviteAthlete.tsx` (QR only, and exporting its form and created-link parts for the onboarding step)
- new `src/app/cloud/invite-qr.ts`, `src/app/cloud/invite-qr.test.ts`
- new `src/lib/domain/getting-started.ts`, `src/lib/domain/getting-started.test.ts`
- `package.json`, `package-lock.json` (`qrcode`, `@types/qrcode` only)
- new `e2e/onboarding-pro-invite.spec.ts`; `e2e/onboarding-pro.spec.ts`, `e2e/onboarding-pro-terms.spec.ts`, `e2e/pro-terminology.spec.ts` only where the flow changes
- `CARD.md`

## Out of scope

- Email sending, CSV bulk invites, group codes for educators (E9's Later parts)
- Any change to the recorder (`src/app/cloud/record/**`), results, Home, or `src/lib/backend/**`
- The professional guide (E11) and onboarding resume state in the backend (D14)

## Constraints

- Only `qrcode` and `@types/qrcode`, exact versions. Static export. Screens use `useBackend()` / `useAuth()` / `useDevice()` only.
- No contract changes (`src/lib/domain/types.ts` untouched).

## Skills

None.

## Stop and ask

- An existing invite method missing something; anything under `src/lib/backend/**`, `src/app/cloud/home/**`, `AthleteHome.tsx`, `record/**`, `results/**`, `server/**`.

## Next step

Lead: review and merge; then the question and the Parked lines below.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): dependencies `qrcode` and `@types/qrcode` (exact versions) only; no contract changes; existing tests may change where named with the reason.
- 2026-11-26: Dependencies: `qrcode` 1.5.4 (dependencies) and `@types/qrcode` 1.5.6 (devDependencies, beside the other `@types/*`), both `--save-exact`. Only `create()` is used: it computes the modules and the page draws them as an SVG path (`src/app/cloud/invite-qr.ts`). No canvas, no data URL, nothing on a server; static export unchanged. Dark on white in both themes (`--c-chrome` on `--c-paper`, which don't flip), so no new tokens.
- 2026-11-26: decided for the owner: agreeing to the terms now saves the profile (onboardedAt, proKind, proProfile, the consents); "Try it yourself" and the invite come after it, and Done only navigates (alternative: save at Done, which can't work: the recorder is another page, and the invite should be made as the professional they now are). Saving again after going Back is harmless: the adapter adds a consent once per kind and version.
- 2026-11-26: decided for the owner: "Try it yourself" sends the professional to the existing recorder as the onboarding first session (`firstSessionHref(firstSession(null))`: paced 5-5, 3 min, `first=first-session`) after they pick their band or the simulated one; no recorder change. The recorder doesn't come back to onboarding (leaving goes to the dashboard, saving to the session page), so after trying, the invite waits on the dashboard checklist (alternative: open the recorder in a new tab, which needs a popup and splits the flow).
- 2026-11-26: decided for the owner: the invite step reuses the roster's `InviteForm` and `CreatedLink` (now exported from `InviteAthlete.tsx`), so the QR code and copy button are the same in onboarding and on the roster. It needs a name and a phone or email, as `createCoachInvite` does today (see Questions).
- 2026-11-26: decided for the owner: checklists per kind (spec §4.1 step 11, trimmed to what the data can tick): coach = invite 3 · record your own session · set a squad · assign the first practice; clinician = invite a client · try a session yourself · assign a between-visits plan; educator = invite your class · try a session yourself · run a class session · set a weekly target. Dropped: the clinician's "see a sample client" (the sample is simply there) and "read the professional guide" (E11, Later, no page yet) (alternative: tick them from browser storage). "Invited" counts people who joined plus invites still pending and unexpired. Items that need a person (squad, practice, class session, targets) say "After your first … joins" until someone has.
- 2026-11-26: decided for the owner: the checklist shows only for professionals with a `proKind`, until every item is done, with no hide button (alternative: a Hide remembered per browser). The demo coach has no kind and has athletes, so their dashboard is unchanged. While the checklist's own counts load (or fail) it shows nothing rather than a spinner.
- 2026-11-26: The sample person is T-0109's Riley (`welcome/sample-sessions.ts`), built on screen, labelled "Sample client/athlete/student: Riley" with a "Sample" tag, shown only while there are zero real people (pending invites don't hide it). Nothing is written; the e2e reads the local DB to show it.
- 2026-11-26: New files: `src/app/cloud/welcome/ProStartSteps.tsx`, `src/app/cloud/dashboard/{GettingStarted.tsx,SamplePerson.tsx,dashboard.css}`, `src/app/cloud/invite-qr.ts` (+ test), `src/lib/domain/getting-started.ts` (+ test), `e2e/onboarding-pro-invite.spec.ts`.
- 2026-11-26: Existing tests changed, each only to step through the two new steps after the terms (Skip for now, twice); no assertion changed: `e2e/onboarding-pro.spec.ts` (its `acceptDefaultsAndTerms` helper), `e2e/onboarding-pro-terms.spec.ts` (a new `skipTryAndInvite` helper, called in its three tests), and `e2e/pro-terminology.spec.ts` ("a new clinician who signs up…"). That last one was already red on this base: it went from "Your people" straight to Done, which T-0118's steps had replaced (run before my edit: timed out waiting for "Go to the dashboard"). It now steps through defaults, templates, terms, try and invite.

## Questions for me

- [ ] Educators showing a QR code in class (E9: "QR to show in class; group code") need an invite with no name or contact, which `createCoachInvite` refuses today. Add a multi-use "class link" to the backend in a later card? — Recommended: yes, with E9's group code (Later). Options: keep one invite per student; reuse athlete-created `createInvite` codes.

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

- 2026-11-26 [product] A professional's own recorded session (try it yourself) can't be found again after its session page; "My practice" (E15) would list them · seen on T-0120 · src/app/cloud/CloudShell.tsx coach nav
- 2026-11-26 [product] The dashboard's "No clients yet" card still says people create a code under Sharing; with link and QR invites it could lead with the invite · seen on T-0120 · src/app/cloud/CoachDashboard.tsx
- 2026-11-26 [product] `DataService.saveSession` is documented "Athletes only", but professionals now record their own sessions (the local adapter and firestore rules already allow anyone on their own data) · seen on T-0120 · src/lib/backend/types.ts

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
$ npx vitest run src/lib/domain/getting-started.test.ts src/app/cloud/invite-qr.test.ts
 Test Files  2 passed (2)
      Tests  14 passed (14)
  (A1: "coach: invite three athletes, …", "clinician: …", "educator: …", "a coach's invite item needs three people reached",
       "each other item follows its own fact", "the sample person shows only with zero real people; open invites don't hide it",
       "older coach accounts without a kind (the demo coach) never see it";
   A2: "draws every dark module of the link's QR code, and nothing else", "leaves a quiet zone of four modules on every side")

$ PORT=3202 npx playwright test e2e/onboarding-pro-invite.spec.ts e2e/onboarding-pro.spec.ts e2e/onboarding-pro-terms.spec.ts e2e/pro-terminology.spec.ts e2e/smoke.spec.ts
  ✓ onboarding-pro-invite › a clinician skips the try-out, invites a client with a link and QR code, and lands on a checklist with a sample client
      (QR svg; link; Copy link → clipboard equals the link; one invite stored; checklist "1 of 3 done"; "Sample client: Riley"; no sessions stored)
  ✓ onboarding-pro-invite › a coach goes from the try-out to the recorder, leaving it lands on their checklist, and a saved session ticks it
  ✓ onboarding-pro-invite › the demo coach, who has athletes and no kind of work set, sees the dashboard as before
  ✓ onboarding-pro × 3, onboarding-pro-terms × 3, pro-terminology × 3, smoke × 2
  14 passed (24.7s)
  (the coach test was then extended to record and save a 30 s simulated session; that spec alone: 3 passed (1.4m))

$ PORT=3202 npx playwright test e2e/onboarding.spec.ts e2e/onboarding-band.spec.ts e2e/onboarding-first-session.spec.ts e2e/onboarding-tracks.spec.ts e2e/demo-path.spec.ts
  11 passed (2.3m)   (the individual flow shares welcome/page.tsx's save; unchanged)

$ rm -rf playwright-report test-results && npm run check   → exit 0
 Test Files  81 passed | 1 skipped (82)
      Tests  949 passed | 1 skipped (950)
 ✓ Compiled successfully; static export built
$ npm run lint && npm run typecheck (after the last e2e edit) → clean

$ git diff --cached --stat (code commit): 18 files, +1403 −42, all in scope (new files listed under Decisions)

Screenshots (scratch, not committed): invite step and dashboard at 1280 px light and 390 px dark; the QR is dark on white in both.

UNTESTED: scanning the QR with a phone (the unit test checks the modules match qrcode's own); "Record with my band" on a real band (none here); axe on the new screens (not run).
```
