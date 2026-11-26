# T-0133 · fix: harden invite-code rate limits: trust no proxy by default, limit invite responses, keep codes out of logs

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0133 · Held by: AB_Rouge
Created: 2026-11-26 · Source: T-0129 security review findings (cards/done/T-0129.md, Parked); I-16 (trusted proxies, T-0111)

## Why

T-0129's limiter trusts the rightmost X-Forwarded-For entry by default, so with no proxy in front a client picks its own
bucket and guessing invite codes is unlimited. IPv6 clients can rotate addresses inside their /64. Answering an invite
has no limit at all, and the request log writes plaintext invite codes (the database only stores hashes).

## Acceptance criteria

- [ ] A1: `TRUSTED_PROXY_HOPS` (integer, default 0) is validated with the other settings; 0 means the socket address only,
  N > 0 the Nth X-Forwarded-For entry from the right; documented in `.env.example` and the README · check:
  `npx vitest run server/env.test.ts server/rate-limit.test.ts`
- [ ] A2: `clientIp` keys IPv6 by /64, IPv4 as is, IPv4-mapped IPv6 as IPv4; tested with a fake socket address and hops 0, 1
  and 2 · check: `npx vitest run server/rate-limit.test.ts`
- [ ] A3: `POST /athletes/:id/coach-invites/:code/response` is limited per signed-in person, sharing one 30-a-minute budget
  with the signed-in lookup · check: `npx vitest run server/routes/coach-invites-response-limit.test.ts`
- [ ] A4: logged request paths never hold an invite code (coach-invite routes, and `code`/`invite` query values on the join
  and welcome pages) · check: `npx vitest run server/log-redaction.test.ts`
- [ ] A5: the public preview ignores a forged X-Forwarded-For with the default 0 hops · check:
  `npx vitest run server/routes/coach-invites-public.test.ts`
- [ ] A6: normal use still fits the limits; `npx vitest run server`, `npx vitest run src/lib/backend/http` and
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

Build: env setting, clientIp hops + /64 keys, shared lookup/response limit, log redaction, tests.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (follow-up to the owner-approved T-0129 public lookup): server-side rate-limit hardening; no auth config changes; no new dependencies.

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
