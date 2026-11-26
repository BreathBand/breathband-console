# T-0120 · feat: professional onboarding ends with try-it-yourself, an invite (link and QR) and a dashboard checklist per kind

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0120 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §4.1 steps 9–11, §6 ("No band yet" sample rule); 03-launch-checklist.md E8, E9, E10

## Why

Professional onboarding stops at the terms and hands the professional an empty dashboard. They never feel a session themselves, the first invite is a separate page with no QR code to show in a room, and nothing tells a new professional what to do next or what a person will look like once they join.

## Acceptance criteria

- [ ] A1: Checklist items per kind (coach, clinician, educator) and their done-state come from a pure module; the sample person shows only with zero real people · check: `npx vitest run src/lib/domain/getting-started.test.ts`
- [ ] A2: The invite QR code is built from the invite link client-side (no server, static export stays) · check: `npx vitest run src/app/cloud/invite-qr.test.ts`
- [ ] A3: After the terms, a professional can try a session (the existing recorder route, simulated band allowed) or skip, then create an invite and see its link, a QR code and a copy button in their own terms, then land on a dashboard checklist with a sample person labelled "Sample"; the demo coach's dashboard (who has athletes and no kind) is unchanged · check: `PORT=3202 npx playwright test e2e/onboarding-pro-invite.spec.ts e2e/onboarding-pro.spec.ts e2e/onboarding-pro-terms.spec.ts e2e/pro-terminology.spec.ts e2e/smoke.spec.ts`
- [ ] A4: Sample data is never written to the account · check: the e2e above reads the local DB (no sessions for the new professional)
- [ ] A5: `npm run check` passes (after removing playwright-report/ and test-results/)

## Files in scope

- `src/app/cloud/welcome/**`
- `src/app/cloud/CoachDashboard.tsx`, new `src/app/cloud/dashboard/**`
- `src/app/cloud/InviteAthlete.tsx` (QR only, and exporting its form and created-link parts for the onboarding step)
- new `src/app/cloud/invite-qr.ts`, `src/app/cloud/invite-qr.test.ts`
- new `src/lib/domain/getting-started.ts`, `src/lib/domain/getting-started.test.ts`
- `package.json`, `package-lock.json` (`qrcode`, `@types/qrcode` only)
- new `e2e/onboarding-pro-invite.spec.ts`; `e2e/onboarding-pro.spec.ts`, `e2e/onboarding-pro-terms.spec.ts`, `e2e/pro-terminology.spec.ts` only where the flow changes
- `src/app/globals.css` (tokens only, if a QR colour is needed)
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

Build: getting-started module and test, QR helper, try and invite steps, dashboard checklist and sample person, e2e.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): dependencies `qrcode` and `@types/qrcode` (exact versions) only; no contract changes; existing tests may change where named with the reason.

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
