# Infrastructure: local first, Cloud Run later

> **Override, 2026-11-26 (owner): the database is libSQL, not Postgres.** Wherever this page says Postgres, read libSQL:
> - Drizzle with `drizzle-orm/libsql` and `@libsql/client`; `drizzle.config.ts` uses `dialect: "turso"`; schema from `drizzle-orm/sqlite-core` (JSON columns are `text({ mode: "json" })`, timestamps `integer({ mode: "timestamp_ms" })`); Better Auth's Drizzle adapter with `provider: "sqlite"`.
> - **Local default:** a file database, `TURSO_DATABASE_URL=file:./data/breathband.db`, no token, no container needed. Compose keeps Mailpit and the `full` profile; an optional `libsql-server` (sqld) service is fine for parity.
> - **Interim shared database:** Turso, `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the gitignored `.env.local`. Migrations and the demo seed may run against it; **tests never do** (the test setup refuses any `libsql://` URL).
> - Later on Cloud Run the app talks to Turso, so the Cloud SQL rows below fall away.
> - Postgres-specific notes (host port 5433, `psql select 1`, a Postgres service container in CI) become: the file DB, `select 1` through the client, and a file DB in CI.

## Where it stands

- Next.js 16 static export (`output: "export"`), served by nginx in a container on 8080 (`Dockerfile`, `nginx.conf`, `npm run docker:smoke`).
- Every screen talks to `AuthService` and `DataService` through `useBackend()`. Adapters: `local` (the default; `localStorage` with seeded demo data and the access rules enforced), `firebase` (a stub that throws), `http` (a documented stub for "a future Cloud Run API", PLAN.md decision 2).
- The adapter behaviour tests in `src/lib/backend/local/local.test.ts` define what every adapter must do.
- No database, no email, no file storage, no server code.

## What we're building

```
                         local (docker compose)                         later (Google Cloud)
 ┌──────────────┐   /api/*   ┌──────────────────────┐   SQL   ┌───────────────┐     Cloud Run service
 │ Browser      │──────────▶│ API (Node 22, Hono)  │───────▶│ Postgres 17   │     Cloud SQL (Postgres)
 │ static export│◀──────────│  Better Auth          │         └───────────────┘
 │ http adapter │  static   │  Drizzle ORM          │  files  ┌───────────────┐     Cloud Storage
 └──────────────┘  files    │  authz = the rules    │───────▶│ ./data/blobs  │
        ▲                   │  StorageService       │  SMTP   ┌───────────────┐     Resend / Postmark / SES
        │ Web Bluetooth     │  jobs (cron)          │───────▶│ Mailpit       │
   Breathband               └──────────────────────┘         └───────────────┘     Cloud Scheduler → job
```

### The decisions behind it

| # | Decision | Why | Alternative rejected |
| --- | --- | --- | --- |
| 1 | **A separate API in the same repo**, behind the existing `http` adapter | The seam already exists; screens don't change. The phone app needs an HTTP API to sync to anyway. The web stays a static export, so the "static export only" rule and its tests stand | Drop the static export and use Next route handlers: couples the app's sync API to the website, breaks a house rule and every static-export assumption |
| 2 | **Hono on Node 22** | Small, typed, fast to test (`app.request()` without a port), runs anywhere | Express (older typing), Fastify (fine; more ceremony) |
| 3 | **Drizzle ORM + drizzle-kit migrations, committed** | Asked for; TypeScript schema next to the domain types; SQL migrations reviewable in PRs | Prisma (heavier, generated client) |
| 4 | **Postgres 17** | Cloud SQL target; JSONB for the score details that are already nested objects | |
| 5 | **Better Auth** with its Drizzle adapter | Self-hosted, email and password with verification and reset, OAuth later, cookie sessions; no vendor until we choose one | Firebase Auth / Identity Platform (the Firebase path is superseded); Lucia (deprecated) |
| 6 | **One Cloud Run service**: the API serves `/api/*` and the static export | Same origin, so cookies need no CORS; one deploy; one thing to watch | Two services behind a load balancer (more cost and setup); keep nginx (the API replaces it, headers move into middleware) |
| 7 | **Waveforms as gzip JSON blobs behind a `StorageService`**: local disk now, Cloud Storage later | Matches `waveformPath`; keeps big arrays out of Postgres | Waveforms in Postgres (bloat, slow lists) |
| 8 | **Mailpit** for email locally | Real SMTP, an inbox UI on 8025 and an API e2e tests can read | Logging emails to the console (can't test links) |
| 9 | **The local adapter stays** as `NEXT_PUBLIC_BACKEND=local` | The demo has a fallback that needs nothing running | |
| 10 | **One `package.json`**, server code in `server/` | No workspace conversion two weeks before a demo | pnpm or npm workspaces (later, if the app's shared code needs it) |

Decisions 1, 5 and 6 replace parts of `docs/PLAN.md` (decisions 1, 2 and the Phase 4 Firebase plan). Record them there as decision 10 before building, and update the house rules in `CLAUDE.md` and `AGENTS.md`: "Do not install cloud SDKs" stays; the API's dependencies are allowed; screens still never import an adapter.

## Repo layout

```
server/
  index.ts              Hono app: /api routes, static files in production, security headers
  main.ts               Node entry (@hono/node-server), graceful shutdown
  env.ts                zod-validated environment
  auth.ts               Better Auth config (drizzle adapter, email via mailer)
  db/
    client.ts           pg Pool + drizzle()
    schema/             one file per area: auth, people, devices, sessions, coaching, group, site, audit
    migrations/         drizzle-kit output, committed
    seed.ts             demo accounts and generated sessions (reuses src/lib/analysis/synth.ts)
  routes/               profile, sessions, waveforms, coaching, squads, alerts, invites, group, waitlist, account
  authz.ts              the access rules from firebase/firestore.rules, as functions
  storage/              StorageService + fs driver (gcs driver later)
  mailer.ts             nodemailer over SMTP
  jobs/                 reminders, digests, deletions (node-cron locally)
src/lib/backend/http/   the adapter: fetch with credentials, maps errors to the adapter's error types
drizzle.config.ts
docker-compose.yml
.env.example
```

The domain types stay in `src/lib/domain/types.ts`; the server imports them through the `@/` alias. One contract, two sides.

## Schema

Table names avoid Better Auth's `user`, `session`, `account`, `verification`. Breathing sessions are `breath_sessions`.

| Table | From | Notes |
| --- | --- | --- |
| `user`, `session`, `account`, `verification` | Better Auth | `user` gets `role` (`athlete`/`coach`), `pro_kind` (nullable), `birth_year` |
| `profiles` | `UserProfile` | `display_name`, `preferences` JSONB (`UserPreferences` plus `goalDetails`, `dailyMinutes`, `reminders`, `gamification`), `onboarding` JSONB, `created_at` |
| `pro_profiles` | new (`02` §4) | `kind`, organisation, profession, sports, use cases, terminology, default targets, default flags, scope requested |
| `consents` | new | `user_id`, `kind`, `version`, `accepted_at` |
| `devices` | data model | `ble_id`, name, firmware, last seen, battery |
| `calibrations` | data model + `Waveform.calibration` | per user and device: `a100`, `midline`, min, max, normal reference, `created_at` |
| `breath_sessions` | `SessionSummary` | scalar columns for listing and filtering (`started_at`, `mode`, `pacer_half_cycle_sec`, `duration_sec`, `scoring_version`, `respiration_rate_bpm`, `total`, `source`, `skill_level`), JSONB for `scores`, `paced`, `open`; `note`, `tags`; `calibration_id`, `device_id`, `group_session_id`, `assignment_id`, `waveform_path` |
| `coach_links` | `CoachLink` | PK (`coach_id`, `athlete_id`), `scope`, `targets` JSONB |
| `invites`, `coach_invites` | `Invite`, `CoachInvite` | codes hashed, expiry, status |
| `assignments`, `comments`, `kudos`, `seen_sessions`, `coach_notes`, `squads`, `squad_members`, `alert_rules` | the coaching types | |
| `group_sessions`, `group_participants` | `GroupSession` | state only; realtime later |
| `waitlist` | `WaitlistEntry` | unique email |
| `access_log` | new | who opened which person's session, when; readable by the person |
| `mood_checkins`, `milestones`, `programs`, `enrollments` | data model | created now, filled by later cards |

Rules: every table has `created_at` and `updated_at`; foreign keys cascade from `user` for account deletion; migrations are generated (`drizzle-kit generate`), never `push`ed outside a throwaway database.

## Local workflow

```sh
cp .env.example .env.local
npm run infra:up          # docker compose up -d --wait db mail
npm run db:migrate
npm run db:seed           # demo accounts, password "breathband"
npm run dev:all           # next dev on 3000 + API on 8787 (tsx watch)
# Mailpit inbox: http://localhost:8025
npm run infra:down
```

Production-like, one command (what the demo and the standing check use):

```sh
docker compose --profile full up --build   # db, mail, migrate (one-shot), app on 8080
```

Notes:

- Postgres on host port **5433**, not 5432, so a local Postgres doesn't collide.
- In dev, the browser calls the API on another port; cookies still work because `localhost` is one site. The API allows `http://localhost:3000` with credentials in dev only.
- `NEXT_PUBLIC_BACKEND=http` and `NEXT_PUBLIC_API_URL` are build-time; the production image builds with `NEXT_PUBLIC_API_URL=""` (same origin).

`.env.example`: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `API_PORT`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `STORAGE_DIR`, `NEXT_PUBLIC_BACKEND`, `NEXT_PUBLIC_API_URL`.

## Tests

- **Contract parity is the acceptance test.** Refactor the adapter behaviour tests into a shared suite run twice: against `local`, and against `http` with the API on a real Postgres (the Compose `db` locally; a service container in CI). When both pass, the access rules hold in the API.
- API unit tests with `app.request()`; authorization tests per rule (own data, scope, revoked, curves hidden on scores-only).
- E2E: sign up → read the verification email from Mailpit's API → verify → onboard → record with the simulated band → professional sees it.
- `npm run check` gains `db:check` (drizzle-kit check) and the API typecheck.

## Later on Google Cloud

| Local | Cloud |
| --- | --- |
| Compose `db` | Cloud SQL for Postgres (private IP or the Cloud SQL connector), automated backups and point-in-time recovery |
| `./data/blobs` | Cloud Storage bucket, uniform access, no public objects |
| Mailpit | Resend, Postmark or SES, with SPF, DKIM and DMARC on the domain |
| `.env.local` | Secret Manager mounted as env |
| `migrate` service | Cloud Run job, run before each deploy |
| node-cron | Cloud Scheduler calling an authenticated job endpoint |
| `docker compose --profile full` | Cloud Run service from Artifact Registry; min instances 0 for staging, 1 for production |
| Logs to stdout | Cloud Logging and Error Reporting; uptime checks |

Region follows D-I. Budget alerts at, say, $10 and $50 before anything is deployed. Deploys authenticate with Workload Identity Federation, never a key in GitHub.

## Cards, in order

Each becomes a Rachetari card. All of them hit stop-and-ask triggers (dependencies, schema, auth, CI), so each needs your approval written into its Decisions before it can run at night (see the prompt).

| # | Card | Depends on | Files in scope (main ones) | Done when (runnable) | Triggers |
| --- | --- | --- | --- | --- | --- |
| I-00 | You: merge `feat/product-redesign` into `main`; cut `develop` | | | `git log develop` contains `8f88778` | |
| I-01 | Record decision 10 and the new house rules | I-00 | `docs/PLAN.md`, `CLAUDE.md`, `AGENTS.md`, `README.md` | Docs lint/format pass; the rules name the API's allowed deps | agent config |
| I-02 | Compose: Postgres and Mailpit; `.env.example`; `infra:up` / `infra:down` | I-00 | `docker-compose.yml`, `.env.example`, `package.json` (scripts only), `README.md` | `npm run infra:up` exits 0 with both healthy; `psql` `select 1`; Mailpit UI 200 | |
| I-03 | Drizzle and the core schema: auth tables, profiles, pro profiles, consents, devices, calibrations, breath sessions, coach links, invites; first migration | I-02 | `drizzle.config.ts`, `server/db/**`, `package.json`, `tsconfig*.json` | `db:migrate` on an empty database; `drizzle-kit check`; a schema test inserts and reads one of each | deps, schema |
| I-04 | Schema for coaching, group, site, audit and later tables | I-03 | `server/db/schema/**`, `server/db/migrations/**` | Same checks | schema |
| I-05 | API skeleton: health, env, errors, logging, security headers (from `nginx.conf`, including the `/_next/static/` fix), static files | I-02 | `server/index.ts`, `server/main.ts`, `server/env.ts`, `package.json` | `curl /api/health` 200 with db status; header test; serves `out/` | deps |
| I-06 | Auth: Better Auth, sign up/in/out, verification and reset by email, role and pro kind | I-03, I-05 | `server/auth.ts`, `server/mailer.ts`, `server/routes/auth*` | E2E: sign-up email arrives in Mailpit, link verifies, sign-in works; rate limit on sign-in | deps, auth |
| I-07 | `http` adapter: `AuthService` | I-06 | `src/lib/backend/http/**` | The auth part of the shared suite passes on `http` | |
| I-08 | Data, part 1: profile and preferences, sessions (list, get, save, delete, note), waveforms through `StorageService` | I-07, I-04 | `server/routes/{profile,sessions,waveforms}*`, `server/storage/**`, `server/authz.ts`, adapter | Shared suite sections pass on `http` | |
| I-09 | Data, part 2: coach links, invites, scopes, revoke, assignments, comments, kudos, seen, notes, targets | I-08 | `server/routes/coaching*`, `server/authz.ts`, adapter | Shared suite sections pass, including every permission case | |
| I-10 | Data, part 3: squads, alert rules, coach invites, group sessions (state), waitlist | I-09 | routes, adapter | Shared suite passes in full on `http` | |
| I-11 | The shared suite in CI against Postgres | I-10 | `.github/workflows/ci.yml`, test setup | CI green with the Postgres service | CI config |
| I-12 | Seed: the demo people (one per track, `05`), generated sessions; `db:reset` | I-08 | `server/db/seed.ts` | `db:reset && db:seed`; the demo e2e passes on `http` | |
| I-13 | Production image (API + static) and `--profile full`; `docker:smoke` on it | I-05, I-12 | `Dockerfile`, `docker-compose.yml`, `scripts/docker-smoke.mjs` | `npm run docker:smoke` passes against the new image | |
| I-14 | `http` becomes the local default; `local` documented as the demo fallback | I-10, I-13 | `.env.example`, `README.md`, `docs/DEMO.md` | `npm run check`; demo e2e on both adapters | |
| I-15 | Account deletion and data export endpoints, with the 24 h deletion job | I-10 | `server/routes/account*`, `server/jobs/**` | Tests: deletion removes every row and blob; export contains every table's rows for the user | |
| I-16 | Cloud Run readiness: the mapping above as `docs/deploy.md`, a GCS driver stub, a migrations job entry point. No deploy | I-13 | `docs/deploy.md`, `server/storage/gcs.ts` | Docs reviewed; stub compiles | |

**Night sizes:** the first night is capped at three cards by Rachetari's rules. Suggested: I-02, I-03, I-05 (I-05 doesn't need I-03). Second night: I-04, I-06, I-07. Product cards (onboarding on the local adapter) can run by day in parallel, because the seam means they don't wait for the backend.
