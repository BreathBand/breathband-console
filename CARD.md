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

- [x] A1: a pure helper gives the goal per kind (coach → Train, clinician → Calm, educator → Focus), the scope default
  (the professional's `scopeRequested`, else their kind's), and the professional's title in their own terms · check:
  `npx vitest run src/lib/domain/invite-context.test.ts`
- [x] A2: the first session is the professional's assignment (its mode, pacer and length) when one is active, else the
  track's default · check: `npx vitest run src/lib/domain/first-session.test.ts`
- [x] A3: the invite lookup returns the professional's kind, profession, requested scope and attached practice; accepting
  an invite with practice creates the assignment · check: `npx vitest run src/lib/backend/local/invite-context.test.ts`
- [x] A4: a clinician creates an invite with a first practice; a new person opens the link, signs up, sees the clinician's
  name and kind and the scope defaulted, accepts, sees the goal prefilled (Calm) and lands in the assigned practice as
  their first session; a signed-in, onboarded athlete still accepts and stays out of onboarding · check:
  `PORT=3202 npx playwright test e2e/invited-path.spec.ts e2e/onboarding.spec.ts e2e/onboarding-first-session.spec.ts e2e/onboarding-pro-invite.spec.ts`
- [x] A5: `npm run check` passes (after removing playwright-report/ and test-results/)

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

Held for the owner: approve `CoachInvite.practice` (Questions). Once approved, a follow-up merges night/2026-11-26 into card/T-0123 and resolves the conflicts in `src/lib/backend/local/index.ts` and `src/lib/backend/types.ts` (T-0119 mood check-ins), then integrates `CoachInviteLookup` with T-0122 (I-10): the server and http `getCoachInvite` return coachKind, coachProfession, scopeRequested and practice, `createCoachInvite` stores `practice`, and accepting creates the assignment.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; contract changes only if strictly needed (additive only, logged); existing tests may change where said which and why.
- 2026-11-26: Contract change (additive, strictly needed): `CoachInvite.practice?: ProTemplateId | null` in `src/lib/domain/types.ts`. Someone who hasn't joined has no link, so `createAssignment` can't reach them; the practice has to travel with the invite. Accepting creates the Assignment (local adapter; in production the accept Cloud Function). `firestore.rules` allows `practice` on create as a short string or absent.
- 2026-11-26: Backend types: `createCoachInvite` input takes optional `practice`; `getCoachInvite` returns `CoachInviteLookup` = the old Pick + `practice`, `coachKind`, `coachProfession`, `scopeRequested` (all optional, read from the professional's profile at lookup time, nothing denormalised). The HTTP adapter compiles unchanged (the server doesn't serve coach invites yet).
- 2026-11-26: decided for the owner: practice set with an invite is one of the professional's kind's session or plan templates (T-0118), not free settings; group templates excluded. A plan becomes its sessions over its days (Between visits: 14 in 14 days), a single session 1 within 7 days; the note is the template's name (alternative: the full PlanTab form on the invite, much larger).
- 2026-11-26: Added `src/app/cloud/InviteAthlete.tsx` to scope: the invite form (shared by the roster and onboarding's invite step) gets an optional "First practice" select, shown only to professionals with a kind. Only the form changed; the demo coach (no kind) sees no select.
- 2026-11-26: decided for the owner: the order is invite page → accept → onboarding. Signed out: login?next=join → "Create an account" → signup (a note says they're joining from an invite) → back to /cloud/join/ → Accept → `/cloud/welcome/?invite=<code>` (alternative: onboarding first, accept last; but §3.5 has the scope chosen on the invite page, and the link must exist for the practice to become an assignment). An onboarded account accepting stays on the join page's confirmation, as before (§3.5 last bullet).
- 2026-11-26: decided for the owner: the professional's "own terms" on the invite page = their profession or role when given (physiotherapist, counsellor), else the kind (coach, clinician, teacher); older accounts with no kind are "coach". Headline per §3.5: "Aoife Byrne (physiotherapist) would like to see your scores." The scope radio starts at `scopeRequested`, else the kind's default, else scores and curves (as before).
- 2026-11-26: decided for the owner: the assigned first session keeps the person's tones choice for paced practice and is tones off for open practice (as Just breathe); the instrument names it "Assigned practice" via the existing `first=` flag (no recorder change); the done step names the template ("Between visits from Aoife").
- 2026-11-26: Existing test file changed: `src/lib/domain/first-session.test.ts` only gained a new describe block (assignment → first session); no existing assertion changed. No existing e2e changed: the flow change is new-person-after-invite only.
- 2026-11-26: Owner approved 2026-11-26 (answers in card): CoachInvite.practice?: ProTemplateId | null (additive); integrate with T-0119 (local adapter) and T-0122 (server + http getCoachInvite).

## Questions for me

- [x] Approve the additive contract field CoachInvite.practice?: ProTemplateId | null (needed so an invite can carry the first practice to someone not yet linked) — Recommended: approve; then a follow-up integrates with T-0119 (local adapter) and T-0122 (server + http getCoachInvite returning coachKind/profession/scopeRequested/practice). Options: carry the practice another way (e.g. create the assignment on accept from the pro's defaults, no contract change); drop the practice from the invite.
  Answer: approve; then a follow-up integrates with T-0119 (local adapter) and T-0122 (server + http getCoachInvite returning coachKind/profession/scopeRequested/practice)
- [x] Show the invite page to signed-out visitors before sign-up (§2: "who invited them … then sign up")? Today CloudShell sends them to sign in with `?next=`, and the lookup needs a signed-in user. — Recommended: yes, in a card that adds `/cloud/join/` to CloudShell's public paths and a public, rate-limited lookup on the server. Options: keep sign-in first; show only a generic "joining from an invite" note on sign-up (today).
  Answer: yes, in a card that adds `/cloud/join/` to CloudShell's public paths and a public, rate-limited lookup on the server

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

- 2026-11-26 [product] Home should lead with "From Aoife" until the first assignment is done (§3.5) · seen on T-0123 · src/app/cloud/AthleteHome.tsx
- 2026-11-26 [product] Clinician invites should turn streak-at-risk reminders off by default (§3.5) · seen on T-0123 · src/app/cloud/welcome/page.tsx
- 2026-11-26 [product] The server's coach invites (when they land) need `practice` stored, kind/profession/scope in the lookup, and the assignment created on accept · seen on T-0123 · server/routes/coaching.ts
- 2026-11-26 [product] Reloading /cloud/join/ after accepting but before finishing onboarding shows "You already share" with "Go to your sessions", which lands on onboarding without the invite prefill · seen on T-0123 · src/app/cloud/join/page.tsx
- 2026-11-26 [product] §4.4 says the invite page repeats the 16+ age gate for educators; sign-up gates it, the join page doesn't repeat it · seen on T-0123 · src/app/cloud/join/page.tsx

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (the lead opens PRs tonight)

### Evidence

```
$ npx vitest run src/lib/domain/invite-context.test.ts src/lib/domain/first-session.test.ts src/lib/backend/local/invite-context.test.ts
 Test Files  3 passed (3)
      Tests  30 passed (30)

$ PORT=3202 npx playwright test e2e/invited-path.spec.ts e2e/onboarding.spec.ts e2e/onboarding-first-session.spec.ts e2e/onboarding-pro-invite.spec.ts
  ✓ onboarding.spec.ts › a new athlete is set up by onboarding and their goal sets their sessions
  ✓ onboarding-pro-invite.spec.ts › a clinician skips the try-out, invites a client with a link and QR code, …
  ✓ invited-path.spec.ts › a new person opens a clinician's invite, signs up, accepts at the asked scope, starts on Calm and lands in the assigned practice
  ✓ invited-path.spec.ts › a signed-in, set-up athlete accepts a coach's invite and just confirms the share, without onboarding
  ✓ onboarding-first-session.spec.ts › Train on the simulated band: onboarding → fit → calibrate → first session → results, in one run
  ✓ onboarding-first-session.spec.ts › Calm on the simulated band: the first session is Just breathe, open, and leaving it goes Home
  ✓ onboarding-pro-invite.spec.ts › a coach goes from the try-out to the recorder, …
  ✓ onboarding-pro-invite.spec.ts › the demo coach, who has athletes and no kind of work set, sees the dashboard as before
  8 passed (1.4m)

# the invite form is shared with the pro onboarding specs, so those too:
$ PORT=3202 npx playwright test e2e/onboarding-pro.spec.ts e2e/onboarding-pro-terms.spec.ts e2e/pro-terminology.spec.ts e2e/smoke.spec.ts
  11 passed (24.7s)

$ rm -rf playwright-report test-results && npm run check
  lint: clean · typecheck: route types generated, tsc clean
  Test Files  88 passed | 1 skipped (89)
       Tests  1195 passed | 1 skipped (1196)
  build: Compiled successfully · Generating static pages (27/27)

$ git diff --stat (before commit)
 firebase/firestore.rules             |  9 +++-
 src/app/cloud/InviteAthlete.tsx      | 22 ++++++++-
 src/app/cloud/join/join.css          |  8 ++++
 src/app/cloud/join/page.tsx          | 92 +++++++++++++++++++++++++++---------
 src/app/cloud/signup/page.tsx        | 19 ++++++--
 src/app/cloud/welcome/page.tsx       | 88 ++++++++++++++++++++++++++++++----
 src/lib/backend/local/index.ts       | 37 ++++++++++++++-
 src/lib/backend/types.ts             | 34 +++++++++++--
 src/lib/domain/first-session.test.ts | 38 ++++++++++++++-
 src/lib/domain/first-session.ts      | 37 +++++++++++++--
 src/lib/domain/types.ts              |  9 ++++
 new: e2e/invited-path.spec.ts, src/lib/domain/invite-context.ts (+ test), src/lib/backend/local/invite-context.test.ts

UNTESTED: the HTTP and Firebase backends (the server doesn't serve coach invites yet; the rules weren't run in the
emulator); a real Bluetooth band (simulated band only); a screenshot and axe pass of the changed join and signup pages.
```
