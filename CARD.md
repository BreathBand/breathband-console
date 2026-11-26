# T-0128 · feat: production image (API + static), compose `--profile full` and `docker:smoke` on it

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0128 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-13 (decision 6: one Cloud Run service; libSQL override)

## Why

The only image is the old nginx one serving the static export; the API (which now serves `out/`
with nginx-parity headers) has no image, so neither Cloud Run nor a one-command production-like
local run is possible. `docker:smoke` still tests the nginx image.

## Acceptance criteria

- [ ] A1: `Dockerfile` builds one image: the API (compiled, no tsx at runtime) serving `/api/*` and the static export on `$PORT` (8080 by default), as a non-root user, with no secrets baked in · check: `npm run docker:smoke`; `docker image inspect` (user, env)
- [ ] A2: the API honours `PORT` in production (Cloud Run), `API_PORT` still wins when set · check: `npx vitest run server/env.test.ts`
- [ ] A3: `npm run docker:smoke` builds the image, runs it, applies migrations inside it, checks `/api/health` (`ok`, db up), `/` and `/cloud/login/`, the security headers and `/_next/static/` caching, then removes the container; works from Git Bash and POSIX shells · check: `npm run docker:smoke` (Git Bash) and the smoke lib's unit tests
- [ ] A4: `docker compose --profile full up --build` runs a one-shot migrate service and the app on 8080 against a file DB volume, with Mailpit; `infra:up` still starts only Mailpit · check: `docker compose --profile full up -d --build --wait` then `curl /api/health`; `docker compose config --services`
- [ ] A5: CI green · check: `npm run check`

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

Build the server bundle script, then the Dockerfile.

## Decisions

Appended by the session, one line each, newest last.

- 2026-11-26: Owner approved 2026-11-26 (overnight full-queue note): lane 1 cards approved; dependencies only from drizzle-orm, drizzle-kit, @libsql/client, tsx, hono, @hono/node-server, better-auth, zod, nodemailer, @types/nodemailer, concurrently, qrcode, @types/qrcode; package.json new scripts allowed; CI config only for I-11 (not this card).

## Questions for me

None yet.

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not for this card: the lead merges)

### Evidence

```
<commands and results>
```
