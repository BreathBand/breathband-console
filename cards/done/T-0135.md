# T-0135 · fix: keep auth tokens out of request logs; one key for unparseable client addresses

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0135 · Held by: nobody
Created: 2026-11-26 · Source: T-0133's Parked lines and review (cards/done/T-0133.md); T-0111 (Better Auth verification and reset links)

## Why

The request log still writes Better Auth's one-time tokens (`?token=` on email verification and password-reset links) in
plain text, so anyone who reads the logs could verify an email or reset a password. Encoded values (`%253F...`) can slip
past the T-0133 redaction. The limiter gives every distinct unparseable address its own bucket, and the hop-count
wording states Cloud Run's count as settled when it is still an open owner question.

## Acceptance criteria

- [x] A1: the log line for a verify-email link and a reset-password link (both shapes Better Auth uses) holds no token;
  method, path, status and time stay readable · check: `npx vitest run server/log-redaction.test.ts`
- [x] A2: every `token` query value is redacted on any route, whatever the parameter name's case, and when
  percent-encoded (once or more) inside another value; a URL that fails to decode is redacted conservatively, never
  logged raw; T-0133's invite-code cases still pass · check: `npx vitest run server/log-redaction.test.ts`
- [x] A3: every address that parses as neither IPv4 nor IPv6 maps to one shared key · check:
  `npx vitest run server/rate-limit.test.ts`
- [x] A4: `.env.example` and the `server/env.ts` comment call Cloud Run's hop count open (1 alone, 2 behind an external
  load balancer, confirm before deploy) and warn both ways · check: `git diff night/2026-11-26 -- .env.example server/env.ts`
- [x] A5: `npx vitest run server` and `npm run check` pass (after removing playwright-report/ and test-results/)

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

Done: for the lead to review and merge. No migration, no config change; docs/deploy.md (T-0134) is the reference the new hop-count wording points at.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (follow-up to the owner-approved T-0129/T-0133 hardening): log-side redaction and limiter keying only; no auth config changes; no new dependencies.
- 2026-11-26: Better Auth 1.7.28's secret-bearing URLs (read in node_modules/better-auth/dist): `GET /api/auth/verify-email?token=&callbackURL=`, `GET /api/auth/reset-password/{token}?callbackURL=` (token in the PATH) which redirects to the app as `?token=`, and (not enabled here) `/delete-user/callback?token=`, magic-link `?token=`, OAuth `code` (already redacted by T-0133's rule). `POST /reset-password` carries its token in the body, which isn't logged.
- 2026-11-26: decided for the owner: new `redactAuthTokens` redacts the reset path segment and every query parameter named `token` or ending in it (`id_token`, `access_token`), any case, any route, also `%3F`/`%26`-encoded inside another value with any number of `25` layers, to `[token]`; `redactInviteCodes` is unchanged (alternative: only the exact name `token`).
- 2026-11-26: decided for the owner: the logger prints `redactLogLine`: both redactions on the URL as it came, then a fully percent-decoded copy (up to 8 rounds) is checked; if it still holds a secret, or doesn't decode, the query becomes `?[redacted]` and the path is kept only if it decodes clean, else cut at its first `%` (`/api/v1/coach[redacted]`). Method, status and time are untouched. Normal Better Auth links keep their readable shape (alternative: log the decoded copy, which would let `%0A` forge log lines).
- 2026-11-26: decided for the owner: `addressKey` returns `INVALID_ADDRESS_KEY` ("invalid") for anything that isn't IPv4/IPv6; `clientIp`'s no-socket fallback stays "unknown" (alternative: one key for both).
- 2026-11-26: Existing test changed: `server/rate-limit.test.ts` "keeps anything that isn't an address as it is" asserted the old behaviour item 3 removes; replaced by "gives everything that isn't an address one shared key" (plus a new middleware case). Everything else in both test files is new cases; T-0133's cases are untouched and pass.

## Questions for me

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

- 2026-11-26 [product] two fail-closed buckets remain: `clientIp` keys a missing socket as "unknown", `addressKey` keys garbage as "invalid"; harmless, but could be one · seen on T-0135 · server/rate-limit.ts
- 2026-11-26 [product] the reset token also reaches the browser as `/cloud/reset/?token=` (history, any third-party script on that page); consider moving it to the fragment or stripping it with history.replaceState once read · seen on T-0135 · the reset page (I-07)
- 2026-11-26 [tool] the bash heredoc → python path halved backslashes when writing tests (wrote a raw ESC and newline); fixed by hand · seen on T-0135 · shell

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (the lead opens PRs)

### Evidence

```
# HEAD 7cdf38d (feature commit), node_modules from `npm ci`
$ npx vitest run server/log-redaction.test.ts                       # A1, A2
      Tests  48 passed (48)    (17 T-0133 cases unchanged + 31 new:
        verify-email `?token=` -> `?token=[token]`; reset link `/api/auth/reset-password/{token}?callbackURL=` -> `/[token]`;
        the app's `/cloud/reset/?token=`; delete-user callback; `TOKEN=`, `Token=`, `ToKeN=`, `id_token=`;
        `%3Ftoken%3D`, `%3FTOKEN%3D`, `%253Ftoken%253D`, `%25253F...` inside `next`; `%74oken=`, `%54%4F%4B%45%4E=`;
        `%253Fcode%253D`, `co%2564e`, `coach%2Dinvites`, `reset%2Dpassword`; undecodable `%E0%A4`, `100%`, `%ZZ`
        -> conservative; 18 lines through createApp({ log: true }) hold no token/code; `--> GET ... 404 Nms` intact)
  sanity: with the decoded-copy check disabled 13 fail; without the reset-path rule 4 fail
$ npx vitest run server/rate-limit.test.ts                          # A3
      Tests  18 passed (18)    (9 garbage strings -> "invalid"; 4 garbage XFFs at 1 hop: 200,200,429,429 in ONE bucket,
                                a real address still 200)
$ git diff night/2026-11-26 -- .env.example server/env.ts           # A4
  .env.example: "Cloud Run's count is still open: expected 1 for Cloud Run alone and 2 behind an external load balancer;
                 confirm before deploy (see docs/deploy.md). Too high lets clients choose their own bucket; too low makes
                 everyone share one."   server/env.ts: same wording in the comment; no code change
$ npx vitest run server                                             # A5
 Test Files  22 passed | 1 skipped (23)
      Tests  287 passed | 1 skipped (288)
$ rm -rf playwright-report test-results && npm run check            # A5, exit 0
  lint: clean · typecheck: clean
 Test Files  109 passed | 1 skipped (110)
      Tests  1528 passed | 1 skipped (1529)
  build: Compiled successfully · Generating static pages (27/27)

$ git diff --stat night/2026-11-26..7cdf38d -- . ':!CARD.md'
 .env.example                 |   6 ++-
 server/env.ts                |   5 ++-
 server/index.ts              |  92 +++++++++++++++++++++++++++++++++++-
 server/log-redaction.test.ts | 105 ++++++++++++++++++++++++++++++++++++++++++-
 server/rate-limit.test.ts    |  23 ++++++++--
 server/rate-limit.ts         |   8 +++-
 6 files changed, 226 insertions(+), 13 deletions(-)

UNTESTED: a real Better Auth email link end to end through the logger (the links are built by hand in the shapes read from
better-auth 1.7.28; no Mailpit run); logs on Cloud Run; e2e (no user flow changed).
```
