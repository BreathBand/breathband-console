# T-0129 · feat: show the invite to signed-out visitors before sign-up

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0129 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §2 (invite row: "who invited them … then sign up"), §3.5; 03-launch-checklist.md D12; T-0123 owner answer 2

## Why

Someone who opens a professional's invite link without an account is sent straight to sign in, and only learns who
invited them after creating one. §2 says the invite page comes first: who invited them and what they're asking to see,
then sign up.

## Acceptance criteria

- [x] A1: a public lookup returns only the professional's name, kind, profession or role, the scope they ask for and the
  practice, and only for a pending, unexpired invite; unknown, expired, revoked, declined and accepted codes all answer
  the same "not available" (null), with no ids, contact or athleteId · check:
  `npx vitest run src/lib/backend/local/public-invite.test.ts` and the contract suite
  `npx vitest run src/lib/backend/contract src/lib/backend/http src/lib/backend/local`
- [x] A2: a reusable in-memory per-key limiter (token bucket, bounded keys) · check: `npx vitest run server/rate-limit.test.ts`
- [x] A3: the server's public route answers without a session, is limited per client IP (the 31st lookup in a minute from
  one IP is 429, another IP still answers), answers unknown and non-pending codes identically, and the signed-in lookup
  is limited per person · check: `npx vitest run server/routes/coach-invites-public.test.ts` and `npx vitest run server`
- [x] A4: signed out, `/cloud/join/?code=…` shows who's asking, what they ask to see and the first practice, with "Sign up
  to accept" carrying the code through sign-up back to the join page; a bad code shows a neutral message; signed in,
  T-0123's behaviour is unchanged · check:
  `PORT=3202 npx playwright test e2e/join-public.spec.ts e2e/invited-path.spec.ts e2e/smoke.spec.ts e2e/demo-path.spec.ts`
- [x] A5: `npm run check` passes (after removing playwright-report/ and test-results/)

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

Done: for the lead to review and merge. No migration. Production needs `clientIp`'s trusted hops set for the deploy (I-16, parked).

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (T-0123 answer 2): /cloud/join/ becomes a public path in CloudShell; a public, rate-limited invite lookup on the server; additive backend method(s) for it. No other auth changes.
- 2026-11-26: CloudShell: `/cloud/join/` goes in a new `OPEN_PATHS`, not `PUBLIC_PATHS`, because PUBLIC_PATHS bounce a signed-in visitor to `?next=`, which would break the signed-in join page. Open paths render bare when signed out and as ordinary pages when signed in; signing out from one still lands on /cloud/. No other gating changed.
- 2026-11-26: Backend (additive): `PublicCoachInvite` = { coachName, coachKind, coachProfession, scopeRequested, practice } and `DataService.getPublicCoachInvite(code): Promise<PublicCoachInvite | null>`. Null for unknown, expired, revoked, declined and accepted alike (no status, ids, code, dates, contact or athleteId). `src/lib/domain/types.ts` unchanged.
- 2026-11-26: Scope: `src/lib/backend/http/routes.ts` (one route per DataService method, enforced by http.test.ts), `src/lib/backend/http/README.md` (http.test.ts checks every route has a README row; one row and one note added), new `src/app/cloud/join/PublicJoin.tsx`, `server/routes/data.ts` (registers the public route before the session check, like the waitlist).
- 2026-11-26: decided for the owner: the API route is `GET /api/v1/coach-invites/{code}/preview`; every non-pending code gets the same 404 `not-found` body; 429 answers `{ error: { code: "unavailable" } }` with Retry-After, which the http adapter already maps (alternative: a new BackendErrorCode "rate-limited", a contract change).
- 2026-11-26: decided for the owner: limiter = in-memory token bucket per key (`server/rate-limit.ts`: `createRateLimiter`, `rateLimit` middleware, `clientIp`), at most 10,000 keys (full buckets dropped first, then least recently used). Public lookup 30 per minute per IP: a class opening a teacher's QR code from one school network fits; guessing all 40-bit codes takes ~70,000 years per IP (alternative: 10 per minute, which a class would trip).
- 2026-11-26: decided for the owner: the signed-in `getCoachInvite` is now limited too, 30 per minute per person, since any account could otherwise enumerate codes there without limit (alternative: leave it and park). Its answers are unchanged.
- 2026-11-26: decided for the owner: `clientIp` takes the rightmost X-Forwarded-For entry (1 trusted hop: what Cloud Run's front end appends, so a client can't forge it), else the socket address, else "unknown" (one shared bucket, fails closed) (alternative: the leftmost entry, as Better Auth reads it, which a client can set freely).
- 2026-11-26: Firestore: no rule change. A rule can't rate-limit or hide fields, and a public get keyed by code would allow unlimited guessing, so the signed-out read is a `getPublicCoachInvite` Cloud Function (Admin SDK, App Check + per-IP limit); the rules' comment says so and the collection stays readable by its coach only.
- 2026-11-26: Existing test changed: `e2e/invited-path.spec.ts`, first test, its signed-out opening only: it expected the redirect to /cloud/login/ and "Create an account", which this card replaces (owner answer 2); it now sees the invite (headline and practice note) and clicks "Sign up to accept". Everything after is unchanged. No other existing test changed; the contract file only gained tests.
- 2026-11-26: Signup page unchanged: the code already rides through `?next=` (T-0123).

## Questions for me

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

- 2026-11-26 [product] the invite lookup limits are in memory per instance (more Cloud Run instances multiply them) and `clientIp` trusts 1 X-Forwarded-For hop; behind a load balancer too it must be 2, or every client shares one bucket; make it an env setting with the deploy (I-16, as T-0111's) · seen on T-0129 · server/rate-limit.ts
- 2026-11-26 [product] per-IP limits treat each IPv6 address separately; a client with a /64 can rotate addresses (key IPv6 by /64) · seen on T-0129 · server/rate-limit.ts
- 2026-11-26 [product] the signed-in `getCoachInvite` still returns kind, profession, scope, practice and status for revoked, declined and expired invites (T-0123 review); the public lookup doesn't · seen on T-0129 · server/routes/coach-invites.ts, src/lib/backend/local/index.ts
- 2026-11-26 [product] the waitlist route could use `server/rate-limit.ts` now (T-0122 question) · seen on T-0129 · server/routes/waitlist.ts
- 2026-11-26 [product] signed out, the "isn't available" message can't say "Ask Lena for a new link" (§6) without naming the professional for a used code; signed in it still does · seen on T-0129 · src/app/cloud/join/PublicJoin.tsx

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below; `src/app/cloud/join/PublicJoin.tsx` is under join/**, the README row is logged under Decisions)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (the lead opens PRs)

### Evidence

```
# HEAD 63290e6 (feature commit), node_modules from `npm ci`
$ npx vitest run src/lib/backend/local/public-invite.test.ts                        # A1
      Tests  3 passed (3)
$ npx vitest run src/lib/backend/contract src/lib/backend/http src/lib/backend/local  # A1, contract suite local + http
 Test Files  20 passed (20)
      Tests  495 passed (495)
$ npx vitest run src/lib/backend/contract/data.local.test.ts src/lib/backend/http/data.http.test.ts -t "T-0129"
      Tests  6 passed | 278 skipped (284)     # "before sign-up" x2 and the clinician's terms, on local and http
$ npx vitest run server/rate-limit.test.ts                                          # A2
      Tests  8 passed (8)
$ npx vitest run server/routes/coach-invites-public.test.ts                         # A3
      Tests  4 passed (4)   (minimum fields; same 404 for unknown/expired/revoked/declined/accepted;
                              31st lookup from one IP is 429, a forged leftmost XFF too, another IP 200;
                              signed-in lookup 429 per person, another person 200, no session 401)
$ npx vitest run server
 Test Files  18 passed | 1 skipped (19)
      Tests  205 passed | 1 skipped (206)
$ rm -rf playwright-report test-results && npm run check                            # A5, exit 0
  lint: clean · typecheck: clean
 Test Files  104 passed | 1 skipped (105)
      Tests  1418 passed | 1 skipped (1419)
  build: Compiled successfully · Generating static pages (27/27)
$ PORT=3202 npx playwright test e2e/join-public.spec.ts                              # A4
  ok signed out, the invite says who's asking and what they'd see; signing in on it comes back to accept
  ok signed out, an unknown, revoked or missing code shows a neutral message that names nobody
  2 passed (11.6s)
$ PORT=3202 npx playwright test e2e/invited-path.spec.ts e2e/smoke.spec.ts e2e/demo-path.spec.ts
  6 passed (2.3m)                          # nothing listening on 3202 afterwards (netstat)
Screenshots of the signed-out invite at 1280 and 375 px and of the "isn't available" page looked right (not committed).

$ git diff --stat d9d3b2b..63290e6
 19 files changed, 825 insertions(+), 15 deletions(-)   (src/lib/domain/types.ts not among them)

UNTESTED: the web flow against the http backend in a browser (e2e runs the local adapter); the limiter behind
Cloud Run's real proxy and across instances; the Firestore rules in the emulator (no rule changed, comment only);
an axe pass of the new page.
```
