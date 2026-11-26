# T-0102 · chore: local infrastructure: libSQL file DB, Mailpit in Compose, env scripts

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0102 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-02 (re-cut for libSQL per the override at the top)

## Why

The API cards (I-03 onward) need a local database and an SMTP inbox, and every worktree needs the
same environment names. Today there is no Compose file, no infra scripts and `.env.example` only
covers the static web app.

## Acceptance criteria

- [x] A1: `npm run infra:up` exits 0 with Mailpit healthy · check: `npm run infra:up; echo $?` then `docker compose ps mail`
- [x] A2: Mailpit UI answers · check: `curl -s -o /dev/null -w '%{http_code}' localhost:8025` returns `200`
- [x] A3: local DB files, env files and agent worktrees are ignored · check: `git check-ignore data/x.db .env.local .claude/worktrees/x` lists all three
- [x] A4: `.env.example` documents `TURSO_DATABASE_URL=file:./data/breathband.db` (no token), Turso as the shared option with a placeholder token, and the later-card names · check: `grep -E '^(# )?(TURSO_DATABASE_URL|TURSO_AUTH_TOKEN|AUTH_SECRET|APP_URL|API_PORT|SMTP_HOST|SMTP_PORT|SMTP_FROM|STORAGE_DIR|NEXT_PUBLIC_BACKEND|NEXT_PUBLIC_API_URL)=' .env.example`
- [x] A5: CI unchanged and green · check: `npm run check`

## Files in scope

- `docker-compose.yml` (new)
- `.env.example`
- `package.json` (scripts only)
- `README.md`
- `.gitignore`
- `CARD.md`

## Out of scope

- The `full` Compose profile and production image (card I-13): placeholder comment only.
- Drizzle, `@libsql/client` or any DB code (card I-03).
- Changing the `http` adapter's env name `NEXT_PUBLIC_API_BASE_URL` (an existing test pins it).

## Constraints

- No new dependencies. `check` script unchanged.
- No real secrets or Turso URLs anywhere; the repo is public.

## Skills

None needed.

## Stop and ask

- Anything that would talk to a `libsql://` URL.

## Next step

Done; the lead reviews and opens the PR against the integration branch.

## Decisions

Appended by the session, one line each, newest last.

- 2026-11-26: Owner approved 2026-11-26 (overnight note): package.json new scripts (`infra:up`, `infra:down`). No dependencies.
- 2026-11-26: .gitignore already had every listed entry (`/data/`, `*.db`, `*.db-shm`, `*.db-wal`, `*.sqlite`, `.turso/`, `/.claude/worktrees/`, `*.key`, `*.p8`, `*.p12`, `service-account*.json`); left unchanged.
- 2026-11-26: decided for the owner: Mailpit pinned to `axllent/mailpit:v1.33.1` (19 days old) (alternative: v1.34.0, 9 days old, or the floating `v1` tag).
- 2026-11-26: decided for the owner: optional sqld under profile `sqld`, pinned `ghcr.io/tursodatabase/libsql-server:v0.24.32`, host port 8081 (8080 is the docker:smoke port); its healthcheck uses bash `/dev/tcp` because the image has no curl or wget (alternative: no healthcheck).
- 2026-11-26: decided for the owner: `infra:down` is `docker compose --profile "*" down` so it also removes sqld; plain `down` left the profiled container and the network behind. Volumes are kept (alternative: `down -v`, which wipes sqld data).
- 2026-11-26: decided for the owner: `TURSO_AUTH_TOKEN` and `NEXT_PUBLIC_API_URL` are commented out in .env.example, so copying it to .env.local changes nothing for the file DB or today's web build (alternative: empty uncommented values).
- 2026-11-26: kept the existing commented `NEXT_PUBLIC_API_BASE_URL` (pinned by an existing test in src/lib/backend/http/http.test.ts) and added the spec's `NEXT_PUBLIC_API_URL` beside it; see Questions.

## Questions for me

- [ ] .env.example now has two names for the API base URL: the http adapter's `NEXT_PUBLIC_API_BASE_URL` (code, its README and a test use it) and the spec's `NEXT_PUBLIC_API_URL`. Which one does the http adapter card (I-10) keep? — Recommended: keep `NEXT_PUBLIC_API_BASE_URL` and change the spec. Options: rename to `NEXT_PUBLIC_API_URL` in I-10 (changes an existing test); keep both.

## Parked

- 2026-11-26 [tool] the sqld image `libsql-server:v0.24.32` has no curl or wget, so any health probe needs bash `/dev/tcp` · seen on T-0102 · docker-compose.yml

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead opens PRs)

### Evidence

```
$ npm run infra:up
 Container breathband-mail-1 Healthy 
exit=0
$ docker compose ps mail
breathband-mail-1 Up 1 second (healthy)
$ curl -s -o /dev/null -w '%{http_code}' localhost:8025
200
$ git check-ignore data/x.db .env.local .claude/worktrees/x
data/x.db
.env.local
.claude/worktrees/x
$ grep -E (A4 pattern) .env.example   (11 names)
NEXT_PUBLIC_BACKEND=local
TURSO_DATABASE_URL=file:./data/breathband.db
# TURSO_AUTH_TOKEN=<turso-auth-token>
AUTH_SECRET=<generate-a-random-32-byte-secret>
APP_URL=http://localhost:3000
API_PORT=8787
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM="Breathband <no-reply@breathband.local>"
STORAGE_DIR=./data/blobs
# NEXT_PUBLIC_API_URL=http://localhost:8787

$ docker compose --profile sqld up -d --wait sqld   (optional profile, checked once)
 Container breathband-sqld-1 Healthy   (exit 0; POST /v2/pipeline "select 1" returned 1)

$ npm run check
> npm run lint && npm run typecheck && npm test && npm run build
lint: no output (clean); typecheck: clean
 Test Files  44 passed (44)
      Tests  489 passed (489)
✓ Compiled successfully
✓ Generating static pages using 23 workers (26/26)
exit=0

$ npm run infra:down
 Network breathband_default Removed   (exit 0; no breathband containers left)

$ git diff --cached --stat   (before the build commit)
 .env.example       | 32 +++++++++++++++++++++++++++
 README.md          | 21 ++++++++++++++++++
 docker-compose.yml | 65 ++++++++++++++++++++++++++++++++++++++++++++++++++++++
 package.json       |  4 +++-
 (plus CARD.md)

UNTESTED: infra:up and infra:down from a macOS/Linux shell (run on Windows only; the "*" quoting is POSIX-safe).
```
