# T-0111 · feat: auth with Better Auth: sign up, sign in, sign out, verification and reset by email, role and pro kind

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0111 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-06 (libSQL override at the top: Better Auth's Drizzle adapter with `provider: "sqlite"`)

## Why

The API has a health route and Better Auth's tables but no way to create an account or sign in.
The http adapter (I-07) and every data route (I-08 on) need cookie sessions, verified emails and
the user's role and pro kind.

## Acceptance criteria

- [x] A1: sign-up email arrives in Mailpit, its link verifies, sign-in then works · check: `npm run infra:up`, then `MAILPIT_E2E=1 npx vitest run server/auth.mailpit.test.ts`
- [x] A2: sign-in is rate limited: it trips after N attempts (N = 5 per 60 s per IP) · check: `npx vitest run server/routes/auth.test.ts -t "rate limit"`
- [x] A3: sign up / in / out, unverified sign-in refused, reset flow, role + proKind (+ birthYear) stored · check: `npx vitest run server/`
- [x] A4: `AUTH_SECRET` required in production, dev-only fallback otherwise; secure cookies in production · check: `npx vitest run server/auth.test.ts server/routes/auth.test.ts`
- [x] A5: CI green · check: `npm run check`; `npm run infra:down` at the end

## Files in scope

- `server/auth.ts`, `server/mailer.ts`, `server/routes/auth*.ts` (new)
- `server/index.ts` (mount only), `server/main.ts` (wire auth + mailer into `createApp`), `server/env.ts` (auth/smtp vars)
- new tests under `server/` (`server/**/*.test.ts`, new files only): `server/auth.test.ts`, `server/mailer.test.ts`, `server/routes/auth.test.ts`, `server/auth.mailpit.test.ts`
- `server/db/migrations/**`, `server/db/schema/auth.ts` only if Better Auth strictly requires a column (logged under Decisions)
- `package.json`, `package-lock.json`, `.env.example`, `CARD.md`

## Out of scope

- The `http` adapter's `AuthService` (I-07, `src/**`).
- OAuth providers, account deletion/export (I-15), authz rules for data routes (I-08).
- Production email provider (Resend/Postmark/SES).

## Constraints

- Only the approved dependencies, exact versions. File DBs only, never `libsql://`. Never read `.env.local`.
- `src/**` untouched.

## Skills

- `quality/deslop` — `/done` runs it

## Stop and ask

- A schema change beyond a column Better Auth strictly requires.

## Next step

Lead: review and merge into night/2026-11-26. I-07 (http adapter AuthService) calls /api/auth/* (see Decisions for callbackURL/redirectTo and error shape).

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): dependencies `better-auth`, `nodemailer`, `@types/nodemailer` (exact versions); auth as in the plan; schema changes only under server/db/** if strictly required.
- 2026-11-26: installed exact: `better-auth@1.7.28`, `nodemailer@10.6.1` (dependencies), `@types/nodemailer@8.0.2` (devDependency). `npm audit` unchanged (the 4 moderate drizzle-kit/esbuild ones already parked on T-0110).
- 2026-11-26: no schema change and no `0002` migration: Better Auth's Drizzle adapter runs on the existing `user`/`session`/`account`/`verification` tables as they are (its schema check passes; all flows tested on a migrated file DB). Rate limits are kept in memory, so no `rateLimit` table either.
- 2026-11-26: `server/main.ts` edited (beyond "index.ts mount only") to build the mailer and auth and pass `auth` to `createApp`; `auth` is optional in `AppDeps`, so existing tests that build the app without it are unchanged. No existing test changed.
- 2026-11-26: production checks live in `authSecret()` and `createMailer()`, called at startup by main.ts, not in `readEnv()`: the existing env test expects `readEnv({})` (production) to succeed. Production refuses to start without `AUTH_SECRET` (32+ chars, not the dev value) or without `SMTP_HOST`. New env vars: `AUTH_SECRET`, `API_URL`, `SMTP_USER`, `SMTP_PASS`.
- 2026-11-26: decided for the owner: sign-in limit 5 per 60 s per client IP (`SIGN_IN_RATE_LIMIT`) with Better Auth's own limiter, on in every mode, in memory; its defaults stay for sign-up (3/10 s) and reset requests (3/60 s) (alternative: a Hono middleware limiter, or Better Auth's default 3/10 s for sign-in).
- 2026-11-26: decided for the owner: `role`, `proKind`, `birthYear` are inputs at sign-up and on update-user (onboarding picks the kind and age after the account step), validated: role athlete|coach (default athlete), proKind coach|clinician|educator|null, birthYear integer 1900..this year|null. proKind is not tied to role (alternative: refuse proKind unless role is coach).
- 2026-11-26: decided for the owner: the verification link signs the person in (`autoSignInAfterVerification`), and an unverified sign-in attempt emails a fresh link (`sendOnSignIn`) (alternative: verify only, then sign in by hand).
- 2026-11-26: decided for the owner: email links point at the API (`authBaseUrl`: `API_URL`, else APP_URL in production, else http://localhost:API_PORT) and redirect to the web app; a relative verification callbackURL (Better Auth's default "/") is rewritten onto APP_URL (`callbackOnApp`). For I-07: pass `callbackURL` on sign-up and `redirectTo` (e.g. `APP_URL/cloud/reset/`) on request-password-reset; the reset page receives `?token=` and POSTs `/api/auth/reset-password`.
- 2026-11-26: decided for the owner: `/api/auth/*` answers with Better Auth's own bodies (`{ code, message }`, e.g. `EMAIL_NOT_VERIFIED`, 429 `{ message }`), not the API's `{ error: { code, message } }` shape; I-07 maps them (alternative: wrap Better Auth's responses here).
- 2026-11-26: cookies: prefix `breathband`, HttpOnly, SameSite=Lax; Secure and `__Secure-` prefix in production. Origin check kept on in tests (Better Auth skips it when NODE_ENV=test); APP_URL's origin is trusted. Reset tokens last 1 h, verification links 24 h, reset revokes existing sessions; sessions use Better Auth's defaults (7 days, refreshed daily). Telemetry off.

## Questions for me

- [x] 02-onboarding-and-tailoring.md step 3 says verification is "a banner, not a wall: you can keep going", but this card (and I-06) refuses sign-in until the email is verified. Keep the wall? — Recommended: keep it for now (it is what the card asked for and protects sharing); revisit when onboarding is built. Options: turn `requireEmailVerification` off and gate sharing/reminders on `emailVerified` instead.
  Answer: keep it for now (it is what the card asked for and protects sharing); revisit when onboarding is built

## Parked

- 2026-11-26 [product] behind Cloud Run's front end `X-Forwarded-For` has two hops, which Better Auth won't trust without `advanced.ipAddress.trustedProxies`/`ipAddressHeaders`; until set, all clients share one sign-in bucket (5/min for everyone) · seen on T-0111 · server/auth.ts (I-16)
- 2026-11-26 [product] rate limits are in memory per instance; more than one Cloud Run instance multiplies them (Better Auth's `database` storage needs a `rateLimit` table) · seen on T-0111 · server/auth.ts

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below; `server/main.ts` wiring, see Decisions)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
$ npm run infra:up
 Container breathband-mail-1 Healthy
$ MAILPIT_E2E=1 npx vitest run server/auth.mailpit.test.ts        # A1 (real SMTP to Mailpit, real HTTP server)
 Test Files  1 passed (1)
      Tests  1 passed (1)
$ npx vitest run server/routes/auth.test.ts -t "rate limit"        # A2
 Test Files  1 passed (1)
      Tests  1 passed | 23 skipped (24)
$ npx vitest run server/routes/auth.test.ts server/auth.test.ts server/mailer.test.ts server/env.test.ts server/index.test.ts   # A3, A4
 Test Files  5 passed (5)
      Tests  68 passed (68)
$ npx vitest run server/auth.mailpit.test.ts                       # without MAILPIT_E2E: skipped, so check needs no Docker
 Test Files  1 skipped (1)
$ npm run check                                                    # A5: lint, typecheck, tests, build
 Test Files  58 passed | 1 skipped (59)
      Tests  649 passed | 1 skipped (650)
 ✓ Compiled successfully; 26/26 static pages; exit 0
$ manual smoke: TURSO_DATABASE_URL=file:./data/t0111.db npm run db:migrate; NODE_ENV=development API_PORT=8791 SMTP_HOST=localhost SMTP_PORT=1025 npx tsx server/main.ts
  POST /api/auth/sign-up/email (Origin http://localhost:3000) -> 200, role coach / proKind educator / birthYear 1990, CORS + security headers; email in Mailpit
  NODE_ENV=production without AUTH_SECRET -> exits: "AUTH_SECRET is required in production"
  (server stopped, data/t0111.db deleted)
$ npm run infra:down
 Container breathband-mail-1 Removed
$ git diff --cached --stat
 .env.example                |  14 +-
 CARD.md                     |  33 +++-
 package-lock.json           | 440 +++++++++++++++++++++++++++++++++++++++-----
 package.json                |   3 +
 server/auth.mailpit.test.ts | 133 +++++++++++++
 server/auth.test.ts         |  99 ++++++++++
 server/auth.ts              | 143 ++++++++++++++
 server/env.ts               |  16 +-
 server/index.ts             |   6 +
 server/mailer.test.ts       |  78 ++++++++
 server/mailer.ts            |  93 ++++++++++
 server/main.ts              |  12 ++
 server/routes/auth.test.ts  | 385 ++++++++++++++++++++++++++++++++++++++
 server/routes/auth.ts       |  12 ++
```

UNTESTED: a real SMTP provider with SMTP_USER/SMTP_PASS (only Mailpit and a fake transport); behaviour behind Cloud Run's proxy (see Parked).
