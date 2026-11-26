# T-0129 · feat: show the invite to signed-out visitors before sign-up

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0129 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §2 (invite row: "who invited them … then sign up"), §3.5; 03-launch-checklist.md D12; T-0123 owner answer 2

## Why

Someone who opens a professional's invite link without an account is sent straight to sign in, and only learns who
invited them after creating one. §2 says the invite page comes first: who invited them and what they're asking to see,
then sign up.

## Acceptance criteria

- [ ] A1: a public lookup returns only the professional's name, kind, profession or role, the scope they ask for and the
  practice, and only for a pending, unexpired invite; unknown, expired, revoked, declined and accepted codes all answer
  the same "not available" (null), with no ids, contact or athleteId · check:
  `npx vitest run src/lib/backend/local/public-invite.test.ts` and the contract suite
  `npx vitest run src/lib/backend/contract src/lib/backend/http src/lib/backend/local`
- [ ] A2: a reusable in-memory per-key limiter (token bucket, bounded keys) · check: `npx vitest run server/rate-limit.test.ts`
- [ ] A3: the server's public route answers without a session, is limited per client IP (the 31st lookup in a minute from
  one IP is 429, another IP still answers), answers unknown and non-pending codes identically, and the signed-in lookup
  is limited per person · check: `npx vitest run server/routes/coach-invites-public.test.ts` and `npx vitest run server`
- [ ] A4: signed out, `/cloud/join/?code=…` shows who's asking, what they ask to see and the first practice, with "Sign up
  to accept" carrying the code through sign-up back to the join page; a bad code shows a neutral message; signed in,
  T-0123's behaviour is unchanged · check:
  `PORT=3202 npx playwright test e2e/join-public.spec.ts e2e/invited-path.spec.ts e2e/smoke.spec.ts e2e/demo-path.spec.ts`
- [ ] A5: `npm run check` passes (after removing playwright-report/ and test-results/)

## Files in scope

- `src/app/cloud/CloudShell.tsx` (public paths only)
- `src/app/cloud/join/**`
- `src/app/cloud/signup/page.tsx` (only if the code needs carrying)
- `src/lib/backend/types.ts`, `src/lib/backend/local/index.ts`, new `src/lib/backend/local/public-invite.test.ts`
- `src/lib/backend/http/data.ts`, `src/lib/backend/http/routes.ts` (one route per DataService method)
- `src/lib/backend/contract/*`
- `server/routes/coach-invites.ts`, `server/routes/data.ts` (wiring the public route), new `server/rate-limit.ts` +
  `server/rate-limit.test.ts`, new `server/routes/coach-invites-public.test.ts`
- `firebase/firestore.rules`
- new `e2e/join-public.spec.ts`; `e2e/invited-path.spec.ts` (only its signed-out opening, see Decisions)
- `CARD.md`

## Out of scope

- The welcome page, the 16+ age gate on the invite page (§4.4), and "Ask Lena for a new link" naming for signed-out visitors
- A shared rate-limit store across instances, trusted-proxy configuration (I-16), and limits on the waitlist route
- `src/lib/domain/types.ts` (must not change)

## Constraints

- No new dependencies. No other auth changes. `src/lib/domain/types.ts` unchanged.

## Skills

- none

## Stop and ask

- If `src/lib/domain/types.ts` would need to change.

## Next step

Build: backend method, limiter, public route, join page, e2e.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (T-0123 answer 2): /cloud/join/ becomes a public path in CloudShell; a public, rate-limited invite lookup on the server; additive backend method(s) for it. No other auth changes.

## Questions for me

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (the lead opens PRs)

### Evidence

```
```
