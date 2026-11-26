# T-0135 · fix: keep auth tokens out of request logs; one key for unparseable client addresses

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0135 · Held by: AB_Rouge
Created: 2026-11-26 · Source: T-0133's Parked lines and review (cards/done/T-0133.md); T-0111 (Better Auth verification and reset links)

## Why

The request log still writes Better Auth's one-time tokens (`?token=` on email verification and password-reset links) in
plain text, so anyone who reads the logs could verify an email or reset a password. Encoded values (`%253F...`) can slip
past the T-0133 redaction. The limiter gives every distinct unparseable address its own bucket, and the hop-count
wording states Cloud Run's count as settled when it is still an open owner question.

## Acceptance criteria

- [ ] A1: the log line for a verify-email link and a reset-password link (both shapes Better Auth uses) holds no token;
  method, path, status and time stay readable · check: `npx vitest run server/log-redaction.test.ts`
- [ ] A2: every `token` query value is redacted on any route, whatever the parameter name's case, and when
  percent-encoded (once or more) inside another value; a URL that fails to decode is redacted conservatively, never
  logged raw; T-0133's invite-code cases still pass · check: `npx vitest run server/log-redaction.test.ts`
- [ ] A3: every address that parses as neither IPv4 nor IPv6 maps to one shared key · check:
  `npx vitest run server/rate-limit.test.ts`
- [ ] A4: `.env.example` and the `server/env.ts` comment call Cloud Run's hop count open (1 alone, 2 behind an external
  load balancer, confirm before deploy) and warn both ways · check: `git diff night/2026-11-26 -- .env.example server/env.ts`
- [ ] A5: `npx vitest run server` and `npm run check` pass (after removing playwright-report/ and test-results/)

## Files in scope

- `server/index.ts` (the logger and its redaction only)
- `server/log-redaction.test.ts` (new cases)
- `server/rate-limit.ts`, `server/rate-limit.test.ts` (new cases)
- `.env.example` (the TRUSTED_PROXY_HOPS lines only), `server/env.ts` (that comment only)
- `CARD.md`

## Out of scope

- Better Auth's config, routes and `trustedProxies` (auth config; not approved)
- `README.md` (T-0134 softens the same sentence there)
- A per-person limit on `/invites/redeem` (parked on T-0133)

## Constraints

- No new dependencies. No auth config changes. Log-side redaction only.

## Skills

- none

## Stop and ask

- If redaction needs anything beyond the logger's print function.

## Next step

Build: redaction in server/index.ts, then addressKey, then the wording.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (follow-up to the owner-approved T-0129/T-0133 hardening): log-side redaction and limiter keying only; no auth config changes; no new dependencies.

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
