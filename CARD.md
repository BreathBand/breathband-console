# T-0128 · feat: production image (API + static), compose `--profile full` and `docker:smoke` on it

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0128 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-13 (decision 6: one Cloud Run service; libSQL override)

## Why

The only image is the old nginx one serving the static export; the API (which now serves `out/`
with nginx-parity headers) has no image, so neither Cloud Run nor a one-command production-like
local run is possible. `docker:smoke` still tests the nginx image.

## Acceptance criteria

- [x] A1: `Dockerfile` builds one image: the API (compiled, no tsx at runtime) serving `/api/*` and the static export on `$PORT` (8080 by default), as a non-root user, with no secrets baked in · check: `npm run docker:smoke`; `docker image inspect` (user, env)
- [x] A2: the API honours `PORT` in production (Cloud Run), `API_PORT` still wins when set · check: `npx vitest run server/env.test.ts`
- [x] A3: `npm run docker:smoke` builds the image, runs it, applies migrations inside it, checks `/api/health` (`ok`, db up), `/` and `/cloud/login/`, the security headers and `/_next/static/` caching, then removes the container; works from Git Bash and POSIX shells · check: `npm run docker:smoke` (Git Bash) and the smoke lib's unit tests
- [x] A4: `docker compose --profile full up --build` runs a one-shot migrate service and the app on 8080 against a file DB volume, with Mailpit; `infra:up` still starts only Mailpit · check: `docker compose --profile full up -d --build --wait` then `curl /api/health`; `docker compose config --services`
- [x] A5: CI green · check: `npm run check`

## Files in scope

- `Dockerfile` (rewritten), `nginx.conf` (removed), `.dockerignore`
- `docker-compose.yml`
- `scripts/docker-smoke.mjs`, `scripts/docker-smoke-lib.mjs`, `src/lib/dockerSmoke.test.ts`
- `scripts/build-server.mjs`, `src/lib/buildServer.test.ts` (new)
- `server/env.ts`, `server/env.test.ts` (`PORT`)
- `package.json` (scripts only)
- `README.md` (the Docker section)
- `CARD.md`

## Out of scope

- Deploying, pushing an image anywhere, Cloud Run docs (I-16) and CI (I-11).
- Making `http` the local dev default (I-14) and a demo seed in the image.
- `docs/PLAN.md` decisions text about nginx (parked).

## Constraints

- No new dependencies; no image pushed to a registry; nothing against Turso.
- No secrets in the image or compose file: placeholders only, `AUTH_SECRET` from the environment.
- No containers left running at the end.

## Skills

None.

## Stop and ask

- Moving a package between dependencies and devDependencies.

## Next step

Done: the lead reviews and merges card/T-0128. The one thing UNTESTED is a run of `npm run docker:smoke` from a POSIX shell on Linux/macOS.

## Decisions

Appended by the session, one line each, newest last.

- 2026-11-26: Owner approved 2026-11-26 (overnight full-queue note): lane 1 cards approved; dependencies only from drizzle-orm, drizzle-kit, @libsql/client, tsx, hono, @hono/node-server, better-auth, zod, nodemailer, @types/nodemailer, concurrently, qrcode, @types/qrcode; package.json new scripts allowed; CI config only for I-11 (not this card).
- 2026-11-26: decided for the owner: the image runs a compiled server, `npm run build:server` (scripts/build-server.mjs). esbuild, already installed with tsx and drizzle-kit (0.28.2, pinned by package-lock), bundles server/ with the `@/` alias and every pure-JS dependency; the native `libsql` binding and the packages it needs are copied next to the bundle. No tsx at run time and no package moved (alternative: move tsx to dependencies and `npm ci --omit=dev`, which ships ~300 MB of Next.js; or add esbuild as a direct devDependency, which is not on the approved list).
- 2026-11-26: decided for the owner: the new image replaces the old Dockerfile and nginx.conf is deleted, per decision 6 ("keep nginx" was rejected; the API replaces it, and the headers live in server/index.ts and server/static.ts, which are tested) (alternative: keep the nginx image as Dockerfile.static).
- 2026-11-26: decided for the owner: the image builds with NEXT_PUBLIC_BACKEND=http and an empty NEXT_PUBLIC_API_BASE_URL (same origin), and docker:smoke builds it the same way; `--build-arg NEXT_PUBLIC_BACKEND=local` still works (alternative: keep `local` as the image default until I-14).
- 2026-11-26: decided for the owner: PORT is read in production only, and API_PORT wins over it. Outside production PORT is Next's dev port (e2e sets PORT=3201), so honouring it there would put the API on the web app's port (alternative: PORT always).
- 2026-11-26: the bundle goes to build/server/ because `/build` is already gitignored and eslint-ignored, so .gitignore stays untouched.
- 2026-11-26: compose passes `AUTH_SECRET: ${AUTH_SECRET:-}`, not `:?`. Compose interpolates every profile, so `:?` would make `infra:up` fail without AUTH_SECRET (checked with a throwaway compose file). Without it the app exits with "AUTH_SECRET is required in production".
- 2026-11-26: docker:smoke passes AUTH_SECRET to `docker run` by name, with a fresh random value in the docker CLI's environment, so it never appears on a command line.
- 2026-11-26: existing test changed: src/lib/dockerSmoke.test.ts, three assertions (buildArgs' backend, runArgs' env flags, the ROUTES list) and the page lookup (PAGES), because the card changes the smoke contract. Every other assertion is unchanged and new tests were added. server/env.test.ts: new cases only.
- 2026-11-26: files added beyond the spec's list, as part of the card: scripts/build-server.mjs, src/lib/buildServer.test.ts, server/env.ts (and its test), README.md's Docker section.

## Questions for me

None.

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

- 2026-11-26 [product] Better Auth warns it can't find the client IP, so rate limiting shares one bucket; behind Cloud Run set `advanced.ipAddress.ipAddressHeaders` (x-forwarded-for) · seen on T-0128 · server/auth.ts
- 2026-11-26 [product] docs/PLAN.md decision 1 and its "Cloud Run" section, and the next.config.ts comment, still describe the nginx image · seen on T-0128 · docs/PLAN.md, next.config.ts
- 2026-11-26 [product] .env.example doesn't mention PORT (the production fallback for Cloud Run) · seen on T-0128 · .env.example
- 2026-11-26 [product] `--profile full` has no demo seed: db:seed runs through tsx and isn't in the image; a compiled seed entry in build:server would let the demo use the full profile · seen on T-0128 · server/db/seed.ts
- 2026-11-26 [product] the image is 292 MB, most of it the node:22-alpine base (node binary 124 MB, npm 18 MB); this card's layers are ~38 MB, and libsql ships both its musl and gnu binaries · seen on T-0128 · docker image ls

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not for this card: the lead merges)

### Evidence

```
$ npm run docker:smoke            (Git Bash on Windows, Docker 29.5.3) -> exit 0
Docker 29.5.3; building breathband-console:smoke with NEXT_PUBLIC_BACKEND=http
Started container breathband-smoke-31764-1795715043659 on http://localhost:8080
✓ Migrations applied to file:/app/data/breathband.db.
✓ /api/health (security headers)
✓ / (security headers; scripts cached immutable)
✓ /cloud/login/ (security headers; scripts cached immutable)
✓ docker:smoke passed
Removed container breathband-smoke-31764-1795715043659
UNTESTED: the same command from a POSIX shell on Linux/macOS (the script is plain Node and spawns docker without a shell).

$ docker image inspect breathband-console:smoke   (A1)
user=node env=[PATH=... NODE_VERSION=22.23.5 YARN_VERSION=1.22.22 NODE_ENV=production PORT=8080
  TURSO_DATABASE_URL=file:/app/data/breathband.db STORAGE_DIR=/app/data/blobs]
cmd=[node --enable-source-maps build/server/main.mjs] ports=map[8080/tcp:{}]   size=292MB
$ docker run --rm image: find / -name ".env*" -o -name "*.db" -o -name "*.pem"
/etc/ssl/cert.pem  /etc/ssl1.1/cert.pem      (CA bundles only; no .env, no database)
$ docker run --rm image: id; touch /app/x
uid=1000(node) ...   touch: /app/x: Permission denied

$ npx vitest run server/env.test.ts src/lib/dockerSmoke.test.ts src/lib/buildServer.test.ts   (A2, A3)
 Test Files  3 passed (3)
      Tests  43 passed (43)

$ docker compose config --services                -> mail
$ docker compose --profile full config --services -> mail, migrate, app
$ AUTH_SECRET=<random> docker compose --profile full up -d --build --wait   (A4) -> exit 0
app running Up 5 seconds (healthy) · mail running (healthy) · migrate Exited (0)
migrate-1  | Migrations applied to file:/app/data/breathband.db.
$ curl localhost:8080/api/health -> {"ok":true,"db":"up"};  /cloud/login/ -> 200
$ POST /api/auth/sign-up/email (test address) -> 200, emailVerified:false;
  Mailpit search -> 1 message, "Confirm your email for Breathband"
$ docker compose --profile full down -v -> mail, app, migrate, the app-data volume and the network removed

$ rm -rf playwright-report test-results && npm run check   (A5) -> exit 0
lint: clean · typecheck: clean
 Test Files  100 passed | 1 skipped (101)
      Tests  1388 passed | 1 skipped (1389)
✓ Generating static pages using 23 workers (27/27)
$ npm run db:check -> Everything's fine
e2e: not run (no user flow changed).

$ git diff --stat e659eb3..cc312e5
 .dockerignore 9, Dockerfile 52, README.md 17, docker-compose.yml 53, nginx.conf 20 (deleted),
 package.json 4 (scripts build:server, start), scripts/build-server.mjs 119 (new),
 scripts/docker-smoke-lib.mjs 87, scripts/docker-smoke.mjs 67, server/env.test.ts 15, server/env.ts 9,
 src/lib/buildServer.test.ts 96 (new), src/lib/dockerSmoke.test.ts 109
 13 files changed, 580 insertions(+), 77 deletions(-)

Containers left running by this card: none (docker ps shows only relevance-audit-pg, which isn't this repo's).
```
