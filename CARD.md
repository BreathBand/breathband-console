# T-0111 · feat: auth with Better Auth: sign up, sign in, sign out, verification and reset by email, role and pro kind

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0111 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-06 (libSQL override at the top: Better Auth's Drizzle adapter with `provider: "sqlite"`)

## Why

The API has a health route and Better Auth's tables but no way to create an account or sign in.
The http adapter (I-07) and every data route (I-08 on) need cookie sessions, verified emails and
the user's role and pro kind.

## Acceptance criteria

- [ ] A1: sign-up email arrives in Mailpit, its link verifies, sign-in then works · check: `npm run infra:up`, then `MAILPIT_E2E=1 npx vitest run server/auth.mailpit.test.ts`
- [ ] A2: sign-in is rate limited: it trips after N attempts · check: `npx vitest run server/routes/auth.test.ts -t "rate limit"`
- [ ] A3: sign up / in / out, unverified sign-in refused, reset flow, role + proKind (+ birthYear) stored · check: `npx vitest run server/`
- [ ] A4: `AUTH_SECRET` required in production, dev-only fallback otherwise; secure cookies in production · check: `npx vitest run server/env.auth.test.ts server/routes/auth.test.ts`
- [ ] A5: CI green · check: `npm run check`; `npm run infra:down` at the end

## Files in scope

- `server/auth.ts`, `server/mailer.ts`, `server/routes/auth*.ts` (new)
- `server/index.ts` (mount only), `server/main.ts` (wire auth + mailer into `createApp`), `server/env.ts` (auth/smtp vars)
- new tests under `server/` (`server/**/*.test.ts`, new files only)
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

Build server/auth.ts, server/mailer.ts, server/routes/auth.ts, then the tests.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): dependencies `better-auth`, `nodemailer`, `@types/nodemailer` (exact versions); auth as in the plan; schema changes only under server/db/** if strictly required.

## Questions for me

## Parked

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
```
