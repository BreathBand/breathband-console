# T-0133 · fix: harden invite-code rate limits: trust no proxy by default, limit invite responses, keep codes out of logs

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0133 · Held by: nobody
Created: 2026-11-26 · Source: T-0129 security review findings (cards/done/T-0129.md, Parked); I-16 (trusted proxies, T-0111)

## Why

T-0129's limiter trusts the rightmost X-Forwarded-For entry by default, so with no proxy in front a client picks its own
bucket and guessing invite codes is unlimited. IPv6 clients can rotate addresses inside their /64. Answering an invite
has no limit at all, and the request log writes plaintext invite codes (the database only stores hashes).

## Acceptance criteria

- [x] A1: `TRUSTED_PROXY_HOPS` (integer, default 0) is validated with the other settings; 0 means the socket address only,
  N > 0 the Nth X-Forwarded-For entry from the right; documented in `.env.example` and the README · check:
  `npx vitest run server/env.test.ts server/rate-limit.test.ts`
- [x] A2: `clientIp` keys IPv6 by /64, IPv4 as is, IPv4-mapped IPv6 as IPv4; tested with a fake socket address and hops 0, 1
  and 2 · check: `npx vitest run server/rate-limit.test.ts`
- [x] A3: `POST /athletes/:id/coach-invites/:code/response` is limited per signed-in person, sharing one 30-a-minute budget
  with the signed-in lookup · check: `npx vitest run server/routes/coach-invites-response-limit.test.ts`
- [x] A4: logged request paths never hold an invite code (coach-invite routes, and `code`/`invite` query values on the join
  and welcome pages) · check: `npx vitest run server/log-redaction.test.ts`
- [x] A5: the public preview ignores a forged X-Forwarded-For with the default 0 hops · check:
  `npx vitest run server/routes/coach-invites-public.test.ts`
- [x] A6: normal use still fits the limits; `npx vitest run server`, `npx vitest run src/lib/backend/http` and
  `npm run check` pass (after removing playwright-report/ and test-results/)

## Files in scope

- `server/rate-limit.ts`, `server/rate-limit.test.ts`
- `server/routes/coach-invites.ts`
- `server/routes/coach-invites-public.test.ts` (new cases only), new `server/routes/coach-invites-response-limit.test.ts`
- `server/env.ts`, `server/env.test.ts` (new cases only)
- `server/index.ts` (where `logger()` is wired), new `server/log-redaction.test.ts`
- `.env.example`, `README.md` (the server's env documentation only)
- `CARD.md`

## Out of scope

- Better Auth's own `trustedProxies` / IP headers (auth config; not approved here, parked)
- A shared rate-limit store across instances; limits on the waitlist route
- Client, local adapter and contract changes (the limits are server-side only)

## Constraints

- No new dependencies. No auth config changes. `src/lib/domain/types.ts` unchanged.

## Skills

- none

## Stop and ask

- If wiring the setting needs `server/main.ts` or `server/routes/data.ts`.

## Next step

Done: for the lead to review and merge. No migration. The deploy must set TRUSTED_PROXY_HOPS (I-16); unset, Cloud Run's clients would share one bucket (fails closed).

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (follow-up to the owner-approved T-0129 public lookup): server-side rate-limit hardening; no auth config changes; no new dependencies.
- 2026-11-26: Cloud Run's real hop count is still open: T-0111 says its front end gives 2 X-Forwarded-For hops, T-0129 assumed 1. I-16 must find it out and set TRUSTED_PROXY_HOPS for the deploy. Until then the default 0 keys on the socket (behind Cloud Run, the proxy's address: one shared bucket, fails closed, never open).
- 2026-11-26: decided for the owner: TRUSTED_PROXY_HOPS is an integer 0 to 10 in server/env.ts's schema (readEnv refuses a bad value at startup), read per request through a new `trustedProxyHops()` there, and not added to `Env`: it needs no threading through server/main.ts, createApp or server/routes/data.ts (out of scope), and env.test.ts's existing `toEqual` stays as it was (alternative: `Env.trustedProxyHops` passed down through AppDeps and DataDeps).
- 2026-11-26: decided for the owner: `clientIp` returns the bucket key: IPv4 as is (a port dropped), IPv6 as its /64 (`2001:db8:1:2::/64`; brackets and zone dropped), IPv4-mapped IPv6 (`::ffff:a.b.c.d`, also in hex) as IPv4, anything else as is; no new dependency (node:net). With N hops and fewer entries, the socket's address (alternative: "unknown").
- 2026-11-26: decided for the owner: one per-person limiter in `coachInviteRoutes` guards both `GET /coach-invites/:code` and `POST /athletes/:id/coach-invites/:code/response`, keyed by the signed-in uid, 30 a minute together; it runs before the permission check, so a refused answer changes nothing (alternative: a second limiter for answers, which would double the guesses).
- 2026-11-26: decided for the owner: the logger's print function redacts with `redactInviteCodes` (exported from server/index.ts): the segment after `/coach-invites/` (preview, lookup, revoke, response), and the `code` / `invite` query values, also percent-encoded inside `?next=`, since in production the API serves /cloud/join/?code= and /cloud/welcome/?invite= too. Athletes' own invite codes go in request bodies (`/invites/redeem`), which aren't logged. Codes become `[code]` (alternative: drop query strings from logs entirely).
- 2026-11-26: Existing tests changed: `server/rate-limit.test.ts`'s two `clientIp` cases relied on the old default (1 hop); they're replaced by cases with a fake socket and 0, 1 and 2 hops (the file is in scope). `server/routes/coach-invites-public.test.ts`: its existing describe gained a `beforeEach` setting TRUSTED_PROXY_HOPS=1 (it simulates Cloud Run); no existing assertion changed, but its 31st-lookup case fails under the new default without it. `server/env.test.ts`: only new cases.
- 2026-11-26: Scope: `README.md` gained one sentence in "Run in a container" (where the server's run-time env is documented), as the prompt asked.

## Questions for me

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

- 2026-11-26 [product] Better Auth's own limiter still reads the leftmost X-Forwarded-For (client-forgeable without a proxy) and ignores TRUSTED_PROXY_HOPS; set `advanced.ipAddress` (ipAddressHeaders/trustedProxies) to match (auth config, needs approval; I-16) · seen on T-0133 · server/auth.ts
- 2026-11-26 [product] the request log also writes Better Auth's `?token=` values (email verification, password reset links) in plaintext; redact them like invite codes · seen on T-0133 · server/index.ts
- 2026-11-26 [product] `POST /coaches/:id/invites/redeem` (an athlete's invite code, in the body) has no API limit of its own; give it the per-person budget too · seen on T-0133 · server/routes/coaching.ts
- 2026-11-26 [product] docker-compose.yml's `full` profile and docs/PLAN.md#cloud-run don't mention TRUSTED_PROXY_HOPS (0 is right for compose; the Cloud Run deploy must set it) · seen on T-0133 · docker-compose.yml, docs/PLAN.md

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (the lead opens PRs)

### Evidence

```
# HEAD 91f664d (feature commit), node_modules from `npm ci`
$ npx vitest run server/env.test.ts                                 # A1
      Tests  14 passed (14)
$ npx vitest run server/rate-limit.test.ts                          # A1, A2
      Tests  17 passed (17)    (socket only with 0 hops / unset; rightmost with 1; 2nd from right with 2;
                                env read; a bad value is a 500, never "trust the header"; /64 and ::ffff: keys)
$ npx vitest run server/routes/coach-invites-response-limit.test.ts # A3
      Tests  3 passed (3)      (31st answer 429, invite still pending, another person accepts it;
                                15 lookups + 15 answers then both 429; signed out 401)
  sanity: with the limit taken off the response route, 2 of the 3 fail
$ npx vitest run server/log-redaction.test.ts                       # A4
      Tests  17 passed (17)    (14 lines logged through createApp({ log: true }), none holds the code)
$ npx vitest run server/routes/coach-invites-public.test.ts         # A5
      Tests  6 passed (6)      (30 lookups with 30 forged XFFs then 429 at 0 hops; IPv6 /64 shares a bucket,
                                another /64 doesn't; ::ffff:a.b.c.d is a.b.c.d)
$ npx vitest run server                                             # A6
 Test Files  22 passed | 1 skipped (23)
      Tests  255 passed | 1 skipped (256)
$ npx vitest run src/lib/backend/http                               # A6, contract suite on http
 Test Files  3 passed (3)
      Tests  229 passed (229)
$ rm -rf playwright-report test-results && npm run check            # A6, exit 0
  lint: clean · typecheck: clean
 Test Files  109 passed | 1 skipped (110)
      Tests  1496 passed | 1 skipped (1497)
  build: Compiled successfully · Generating static pages (27/27)
$ npm run build:server
  Built build/server/main.mjs and build/server/migrate.mjs

$ git diff --stat 6d4051b..91f664d
 11 files changed, 479 insertions(+), 37 deletions(-)
 (.env.example, README.md, server/env.ts, server/env.test.ts, server/index.ts, server/log-redaction.test.ts,
  server/rate-limit.ts, server/rate-limit.test.ts, server/routes/coach-invites.ts,
  server/routes/coach-invites-public.test.ts, server/routes/coach-invites-response-limit.test.ts)

UNTESTED: behind Cloud Run's real proxy (hop count open, I-16); a real Node socket's remoteAddress (tests pass a fake
`incoming.socket`; the http contract suite runs on a real server and passed); e2e (no user flow changed).
```
