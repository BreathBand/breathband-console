# T-0123 · feat: the invited path: invite page with scope choice, goal prefilled from the professional's kind, the assignment as the first session

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0123 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §2 (invite row), §3.5; 03-launch-checklist.md D12

## Why

Someone who opens a professional's invite link today sees "Lena Vos would like to see your sessions" with no idea what
kind of professional is asking, the scope always starts at "scores and curves", and after accepting a new person goes
through onboarding as if nobody had invited them: the goal isn't prefilled and their first session ignores any practice
the professional set.

## Acceptance criteria

- [ ] A1: a pure helper gives the goal per kind (coach → Train, clinician → Calm, educator → Focus), the scope default
  (the professional's `scopeRequested`, else their kind's), and the professional's title in their own terms · check:
  `npx vitest run src/lib/domain/invite-context.test.ts`
- [ ] A2: the first session is the professional's assignment (its mode, pacer and length) when one is active, else the
  track's default · check: `npx vitest run src/lib/domain/first-session.test.ts`
- [ ] A3: the invite lookup returns the professional's kind, profession, requested scope and attached practice; accepting
  an invite with practice creates the assignment · check: `npx vitest run src/lib/backend/local/invite-context.test.ts`
- [ ] A4: a clinician creates an invite with a first practice; a new person opens the link, signs up, sees the clinician's
  name and kind and the scope defaulted, accepts, sees the goal prefilled (Calm) and lands in the assigned practice as
  their first session; a signed-in, onboarded athlete still accepts and stays out of onboarding · check:
  `PORT=3202 npx playwright test e2e/invited-path.spec.ts e2e/onboarding.spec.ts e2e/onboarding-first-session.spec.ts e2e/onboarding-pro-invite.spec.ts`
- [ ] A5: `npm run check` passes (after removing playwright-report/ and test-results/)

## Files in scope

- `src/app/cloud/join/**`
- `src/app/cloud/signup/page.tsx` (invite code carried through `?next=`)
- `src/app/cloud/welcome/**` (invite prefill and the first session only)
- `src/app/cloud/InviteAthlete.tsx` (the invite form's optional first practice only)
- `src/lib/domain/first-session.ts`, `src/lib/domain/first-session.test.ts`
- new `src/lib/domain/invite-context.ts`, `src/lib/domain/invite-context.test.ts`
- `src/lib/domain/types.ts` (additive: `CoachInvite.practice`)
- `src/lib/backend/types.ts`, `src/lib/backend/local/index.ts`, new `src/lib/backend/local/invite-context.test.ts`,
  `firebase/firestore.rules` (the four in agreement)
- new `e2e/invited-path.spec.ts`
- `CARD.md`

## Out of scope

- Home leading with "From Lena" until the first assignment is done (Home is another lane's)
- Clinician invites turning streak-at-risk reminders off (§3.5) and onboarding resume state (D14)
- Showing the invite before sign-up to signed-out visitors (needs CloudShell's public paths and a public lookup)

## Constraints

- No new dependencies. Contract changes additive only, logged below.
- Don't touch `src/lib/backend/http/**`, `server/**`, `src/app/cloud/home/**`, `AthleteHome.tsx`, `src/app/cloud/record/**`,
  the coach dashboard, `package.json`.

## Skills

- none

## Stop and ask

- If the flow needs CloudShell or the recorder changed.

## Next step

Build: domain helper, backend lookup + practice on accept, join page, signup note, welcome prefill, e2e.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; contract changes only if strictly needed (additive only, logged); existing tests may change where said which and why.

## Questions for me

## Parked

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (lead opens PRs tonight)

### Evidence

```
<commands and results>
```
