# Deploying to Cloud Run

> **No deploy.** This page describes a deploy; it hasn't happened. Card T-0134 wrote it and deployed nothing, created no
> Google Cloud resources (no project, service, job, bucket, secret or registry) and ran nothing against Turso. A person
> runs the commands below by hand, from their own machine and `gcloud` login, after the
> [Before first deploy](#before-first-deploy) list is done. CI and agents never run them, and no workflow in
> `.github/workflows/` deploys. None of the commands here has been run, so treat them as an untested sketch.

The architecture and its decisions are in [planning/v1/04-infrastructure.md](../planning/v1/04-infrastructure.md)
(decisions 1, 5, 6 and 10, the libSQL override at its top, and "Later on Google Cloud") and in
[docs/PLAN.md](PLAN.md#decisions), decision 10.

## What runs where

| Local | On Google Cloud | State in this repo |
| --- | --- | --- |
| `docker compose --profile full` (`app`) | **One Cloud Run service** from Artifact Registry: the API serves `/api/*` and the static export on one origin. Min instances 0 for staging, 1 for production | The image is built (`Dockerfile`, T-0128); `npm run docker:smoke` checks it |
| Compose `migrate` (one-shot) | **A Cloud Run job** on the same image, `node build/server/migrate.mjs`, run before each deploy | Built and tested; see [Migrations job](#migrations-job) |
| libSQL file (`file:./data/breathband.db`) | **Turso** (`libsql://…`). Cloud SQL isn't used (the libSQL override) | The shared Turso database exists; migrations 0003 and 0004 may not be applied (checklist) |
| `./data/blobs` (fs driver) | **A Cloud Storage bucket**, uniform access, no public objects | The fs driver works; the Cloud Storage driver is a stub, `server/storage/gcs.ts`. See [Storage](#storage) |
| Mailpit | Resend, Postmark or SES over SMTP, with SPF, DKIM and DMARC on the domain | `server/mailer.ts` speaks SMTP (nodemailer); no provider chosen |
| `.env.local` | **Secret Manager**, mounted as environment variables | See [Environment](#environment) |
| `setInterval` in `server/main.ts` (24 h deletion job) | Cloud Scheduler calling an authenticated job endpoint, later | Not built; see the checklist |
| Logs to stdout | Cloud Logging and Error Reporting; uptime checks on `/` and `/api/health` | Nothing to build: the API logs to stdout |

Region follows D6 / D-I (not decided). Set budget alerts (say $10 and $50) before anything is deployed. Deploys
authenticate with Workload Identity Federation, never a key in GitHub.

## The image

One image, built by `Dockerfile` (T-0128): the static export in `out/` and the API bundled by esbuild into
`build/server/` (`scripts/build-server.mjs`: `main.mjs`, `migrate.mjs` and the native libSQL binding). It runs as the
`node` user, holds no secrets (`.env*` is in `.dockerignore`) and listens on `$PORT`. Only `/app/data` is writable.

`NEXT_PUBLIC_*` values are inlined at build time, so they are build args, and changing one means a new image:

| Build arg | Production value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_BACKEND` | `http` (the image default) | `local` builds the demo fallback, which needs no API |
| `NEXT_PUBLIC_API_BASE_URL` | empty (the image default) | Empty means same origin, which is what one service gives |
| `NEXT_PUBLIC_SITE_URL` | `https://<domain>` | Canonical and Open Graph links and `sitemap.xml`; empty falls back to `http://localhost:3000` |

`gcloud run deploy --source .` can't pass build args, so `NEXT_PUBLIC_SITE_URL` would be empty. Build and push the
image instead (sketch, not run):

```sh
IMAGE=<region>-docker.pkg.dev/<project>/breathband/console:$(git rev-parse --short HEAD)
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://<domain> -t "$IMAGE" .
docker push "$IMAGE"
```

## Environment

The API reads only the process environment (`server/env.ts`, `server/db/env.ts`); it never loads a `.env` file.
**Secret** means: keep it in Secret Manager and pass it with `--set-secrets`, never `--set-env-vars`, never in the repo
(the repo is public).

| Variable | Secret | On Cloud Run | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | no | leave unset | The image sets `production`; unset also means production |
| `PORT` | no | set by Cloud Run | The image defaults it to 8080. Read in production only |
| `API_PORT` | no | **don't set** | It wins over `PORT`, so setting it would make the API listen on the wrong port |
| `APP_URL` | no | **`https://<domain>`, required** | The public origin. Better Auth trusts it as a request origin, the API allows it for CORS, and auth email links (verification, reset) land on it. The default, `http://localhost:3000`, would break sign-in and every emailed link |
| `API_URL` | no | leave unset | Unset means APP_URL in production, which is right for one service |
| `AUTH_SECRET` | **yes** | required, 32+ characters | Signs session cookies and tokens, and derives coach-invite codes (T-0122). The API refuses to start without it. Generate with `openssl rand -base64 32`. Rotating it signs everyone out and breaks pending coach-invite links |
| `TURSO_DATABASE_URL` | **yes** | `libsql://<db>-<org>.turso.io` | The image defaults it to `file:/app/data/breathband.db`, a file inside the container that is lost on restart and different on each instance. Kept as a secret so the database's address isn't public |
| `TURSO_AUTH_TOKEN` | **yes** | a token for that database only | Read by the API and the migrations job |
| `SMTP_HOST` | no | the provider's SMTP host | Required in production: the API refuses to start without it |
| `SMTP_PORT` | no | `587` (STARTTLS) or `465` (implicit TLS) | `server/mailer.ts` uses implicit TLS only on 465. Cloud Run blocks outbound port 25 |
| `SMTP_FROM` | no | `Breathband <no-reply@<domain>>` | The domain needs SPF, DKIM and DMARC for the provider |
| `SMTP_USER` | **yes** | the provider's SMTP login | |
| `SMTP_PASS` | **yes** | the provider's SMTP password or API key | |
| `STORAGE_DIR` | no | see [Storage](#storage) | The image defaults it to `/app/data/blobs`, which on Cloud Run is in-memory, per instance and lost on restart |
| `TRUSTED_PROXY_HOPS` | no | the measured hop count (open question 1) | **Added by T-0133** (in progress): 0 (its default) keys rate limits by the socket address only; N > 0 uses the Nth X-Forwarded-For entry from the right. It covers the API's own limiter in `server/rate-limit.ts` (invite lookups), not Better Auth's |

Not used in production: `MAILPIT_E2E` (a test switch), `NEXT_PUBLIC_FIREBASE_*` and `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`
(the Firebase stub), and `NEXT_PUBLIC_API_URL` (the spec's name; the code reads `NEXT_PUBLIC_API_BASE_URL`, an open
question from T-0102). `.env.example` doesn't list `PORT` or `TRUSTED_PROXY_HOPS` yet; this table is the reference until
it is synced (parked on T-0134).

The service's runtime service account needs `roles/secretmanager.secretAccessor` on these secrets only, and later
object access on the blob bucket only.

### Deploy the service (sketch, not run)

```sh
gcloud run deploy breathband-web --image "$IMAGE" --region <region> --allow-unauthenticated \
  --service-account breathband-web@<project>.iam.gserviceaccount.com \
  --set-env-vars "APP_URL=https://<domain>,SMTP_HOST=<host>,SMTP_PORT=587,SMTP_FROM=Breathband <no-reply@<domain>>,TRUSTED_PROXY_HOPS=<n>" \
  --set-secrets "AUTH_SECRET=breathband-auth-secret:latest,TURSO_DATABASE_URL=breathband-turso-url:latest,TURSO_AUTH_TOKEN=breathband-turso-token:latest,SMTP_USER=breathband-smtp-user:latest,SMTP_PASS=breathband-smtp-pass:latest" \
  --max-instances 1
```

`--max-instances 1` until rate limits and the deletion job work across instances (checklist). Cloud Run sends SIGTERM
before stopping an instance; `server/main.ts` closes the server within 10 s. `/api/health` answers 200 with
`{ ok, db }` even when the database is down (T-0110), so it suits a startup or liveness probe, not a readiness gate.

## Migrations job

The image already has the entry point: `build/server/migrate.mjs`, the bundled `server/db/migrate.ts`. It applies the
committed migrations in `server/db/migrations/` (copied into the image) to `TURSO_DATABASE_URL` with
`TURSO_AUTH_TOKEN`, records them in `__drizzle_migrations`, and exits 0 or 1. No code was missing: Compose's `migrate`
service runs the same command, and CI runs the bundle on an empty file database (T-0132).

Run it as a Cloud Run job before each service deploy (sketch, not run):

```sh
# once
gcloud run jobs create breathband-migrate --image "$IMAGE" --region <region> \
  --service-account breathband-web@<project>.iam.gserviceaccount.com \
  --command node --args build/server/migrate.mjs \
  --set-secrets "TURSO_DATABASE_URL=breathband-turso-url:latest,TURSO_AUTH_TOKEN=breathband-turso-token:latest" \
  --tasks 1 --max-retries 0

# every deploy: point the job at the new image, migrate, then deploy the service
gcloud run jobs update breathband-migrate --image "$IMAGE" --region <region>
gcloud run jobs execute breathband-migrate --region <region> --wait
```

The job runs while the old revision still serves traffic, so a migration has to work with the code before it as well as
after (add columns and tables first, drop them in a later release). Migrations are generated with `drizzle-kit
generate` and never `push`ed.

## Storage

Waveforms are gzip JSON blobs behind `StorageService` (`server/storage/index.ts`, decision 7). `server/main.ts` always
builds the fs driver (`server/storage/fs.ts`) on `STORAGE_DIR`; there is no driver setting yet. On Cloud Run that
directory is in the instance's memory: blobs vanish on restart and each instance has its own. So **a real blob store is
needed before the first deploy that keeps sessions** (open question 3).

`server/storage/gcs.ts` is a stub with the `StorageService` shape. It checks keys like the fs driver, then rejects every
call with `StorageNotConfiguredError` ("Cloud Storage is not configured"). It imports nothing from Google Cloud: the house
rules forbid `@google-cloud/*` until the owner approves an SDK. Nothing selects it. Making it real means implementing it
(open question 3), adding a driver choice and a bucket name to `server/env.ts` and `server/main.ts`, keeping the fs
driver as the default, and giving the seed (`server/db/seed.ts`) the same choice so the demo's waveforms land in the
bucket.

## Before first deploy

Every must-fix from the infrastructure cards' parked lines and reviews, and from the night report
(`nights/2026-11-26.md`, "Must fix before any deploy"). None is fixed by T-0134. Several touch auth, schema or CI and
need the owner's approval as their own card.

- [ ] **Better Auth's client IP and trusted proxies.** Better Auth reads the leftmost `X-Forwarded-For` entry, which a
  client can set, so sign-in limits can be dodged; and in the container it warns it can't find the client IP, so
  everyone shares one sign-in bucket. Set `advanced.ipAddress` (`ipAddressHeaders`, trusted proxies) in
  `server/auth.ts` to match Cloud Run (T-0111, T-0128; an auth change).
- [ ] **The real X-Forwarded-For hop count**, for Better Auth and for `TRUSTED_PROXY_HOPS` (T-0133). T-0111 says 2
  hops; T-0129 assumed 1 (Cloud Run alone). **Open question 1.** Too few and every client shares the proxy's bucket;
  too many and a client picks its own.
- [ ] **Rate limits are in memory, per instance** (`server/rate-limit.ts` and Better Auth's `storage: "memory"`). Each
  instance multiplies them. Keep `--max-instances 1`, or move them to a shared store (Better Auth's `database` storage
  needs a `rateLimit` table: a schema change) (T-0111, T-0129). **Open question 4.**
- [ ] **Rate limits on the routes that have none**: the public waitlist (`server/routes/waitlist.ts`, T-0122, T-0129),
  `POST /api/v1/account/delete`, which checks a password (`server/routes/account.ts`, T-0126), and invite-code
  redemption (`server/routes/coaching.ts`, T-0121). `server/rate-limit.ts` already has the limiter.
- [ ] **`APP_URL`** is the public `https://` origin, on the service and in any seed run. If the `run.app` address
  stays reachable too, sign-in from it fails the origin check: only APP_URL's origin is trusted.
- [ ] **`AUTH_SECRET`**: a real one in Secret Manager, never the dev-only value (the API refuses that in production).
- [ ] **Re-seed the demo with the real `AUTH_SECRET`** (T-0125). The demo coach invite on Turso was seeded with a
  throwaway secret, so its link doesn't open. Its code derives from the secret, and a plain re-seed keeps the old
  invite as "present", so run `npm run db:seed -- --refresh` with the service's AUTH_SECRET. The lead runs anything
  against Turso.
- [ ] **Turso's demo blobs live on one machine** (T-0125): the seed wrote the waveforms to that machine's
  `STORAGE_DIR` (`bb-night/data/blobs`), so no other machine or Cloud Run instance has them. Re-seed into the real blob
  store once [Storage](#storage) has one.
- [ ] **Turso migrations 0003 and 0004 aren't applied** (as of `nights/2026-11-26.md` and cards T-0126 and T-0123):
  `server/db/migrations/0003_account_deletions.sql` and `0004_coach_invite_practice.sql`. Check
  `__drizzle_migrations` first, then apply them with the migrations job or the lead's command in
  `server/db/migrate.ts`.
- [ ] **A real blob store** for waveforms (above; **open question 3**). Until then the deploy loses every saved
  session's signal.
- [ ] **The deletion job** (`server/jobs/deletion.ts`) runs on `setInterval` every 10 minutes inside the service. On
  Cloud Run, CPU is throttled between requests and instances scale to zero, so it may not run for long stretches.
  **Open question 5.** (It is safe with several instances: each claims a request before deleting, T-0126.)
- [ ] **Compose publishes its ports on every interface** (`0.0.0.0`): `docker-compose.yml` maps `1025`, `8025`,
  `8080` and `8081` without a host address, so on a shared network Mailpit's inbox (with verification and reset links)
  and the `--profile full` app are reachable by others. Bind them to `127.0.0.1`. Local only, but it matters for demos
  on venue Wi-Fi.
- [ ] **`.dockerignore` gaps** (T-0128 review). Compared with `.gitignore` it misses keys and cloud credentials
  (`*.pem`, `*.key`, `*.p8`, `*.p12`, `service-account*.json`), `.turso/`, `.firebase/`, `.vercel` and `*.sqlite`, and
  sends folders the build doesn't need (`planning/`, `nights/`, `cards/`, `e2e/`, `.github/`). They reach only the
  build stage (the final stage copies `build/server`, `server/db/migrations` and `out/`), but they are in the build
  context. Also, `gcloud builds submit` and `--source` upload by `.gcloudignore` (or `.gitignore` when there is none),
  not `.dockerignore`: decide which file governs uploads.
- [ ] **The `http` build has never run in a real browser against a deployed API**: sign up, read the email, verify,
  record, and a professional sees the session (night report, "Not run anywhere"). Do it on a staging service first.
- [ ] **Sync `.env.example` with this page** (`PORT`, `TRUSTED_PROXY_HOPS`, the API base URL's name) once T-0133 has
  merged (parked on T-0134).
- [ ] **Outside the code**: region (D6 / D-I), budget alerts, an SMTP provider with SPF, DKIM and DMARC, Workload
  Identity Federation for whoever deploys, Turso backups checked by an actual restore, and a dedicated runtime service
  account with access to its own secrets only.

## Open questions for the owner

1. **How many X-Forwarded-For hops does Cloud Run add in front of the API?** T-0111 says 2; T-0129 assumed 1. It
   likely depends on question 2: Cloud Run's own front end appends one entry, and an external HTTPS load balancer in
   front adds another. Recommended: measure it on a staging revision (log the raw header for a request from a known
   address), then set `TRUSTED_PROXY_HOPS` and Better Auth to that number. Until then T-0133's default of 0 fails
   closed (everyone shares one bucket).
2. **How does the custom domain reach the service**: Cloud Run domain mapping, or an external HTTPS load balancer
   (needed for Cloud Armor or a CDN)? Recommended: domain mapping for the demo and launch, if the region supports it.
3. **Where do waveforms live on Cloud Run?** Recommended: implement `server/storage/gcs.ts` against the Cloud Storage
   JSON API with `fetch` and a token from the metadata server: no new dependency, unit-testable with a fake `fetch`.
   Options: `@google-cloud/storage` (lifts the cloud-SDK house rule for one package); mount the bucket as a Cloud Run
   volume at `STORAGE_DIR` and keep the fs driver (no code, but its write-then-rename isn't atomic on a mounted bucket;
   untested).
4. **Rate limits across instances**: `--max-instances 1` for the demo and launch, or a shared store now? Recommended:
   one instance for now; a `rateLimit` table (schema change) before scaling out.
5. **The 24 h deletion job on Cloud Run**: min instances 1 with CPU always allocated (simplest; costs an always-on
   instance), or Cloud Scheduler calling an authenticated job endpoint (the 04 plan; needs a route). Recommended:
   Cloud Scheduler before launch; always-on is fine for a demo.
