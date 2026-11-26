# T-0110 · feat: API skeleton on Hono: health, env, errors, security headers, static files

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0110 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-05 ("What we're building", decisions table, Repo layout, Local workflow; libSQL override at the top)

## Why

The API cards (auth, routes, seed) need a server to hang routes on. Today there is no server
code beyond `server/db/**`, and the security headers and caching rules live only in `nginx.conf`,
which the API replaces (decision 6).

## Acceptance criteria

- [ ] A1: `GET /api/health` answers 200 with the db status · check: `TURSO_DATABASE_URL=file:./data/t0110.db npm run db:migrate`, then `TURSO_DATABASE_URL=file:./data/t0110.db API_PORT=8790 npm run api:start`, `curl -s localhost:8790/api/health` (server stopped and file deleted afterwards); up/down cases in `server/index.test.ts`
- [ ] A2: every response carries the nginx.conf security headers, and `/_next/static/` also gets immutable caching · check: `npx vitest run server/` (headers on an HTML page, a `/_next/static/` asset, a 404 and an error)
- [ ] A3: serves `out/` like nginx (`try_files $uri $uri/ $uri.html =404`, 404.html) · check: after `npm run build`, `curl -I localhost:8790/cloud/login/` is 200 with the headers; temp `out/` fixture cases in `server/static.test.ts`
- [ ] A4: unknown `/api` routes and errors answer JSON, no stack in production; CORS for the web app with credentials in development only · check: `npx vitest run server/`
- [ ] A5: CI green · check: `npm run check`

## Files in scope

- `server/index.ts`, `server/main.ts`, `server/env.ts`, `server/static.ts` (new)
- `server/*.test.ts` (new)
- `package.json` (deps and `api:*` scripts; `check` unchanged), `package-lock.json`
- `CARD.md`

## Out of scope

- Auth, routes beyond health, logging to Cloud Logging (I-06 and later).
- The production image and Compose `full` profile (I-13); `nginx.conf` and `Dockerfile` stay.
- `server/db/**` (read-only, imported only).

## Constraints

- Only the approved dependencies (`hono`, `@hono/node-server`, `zod`), exact versions.
- Never load `.env.local`; read `process.env` only. File DBs only, never a `libsql://` URL.
- `src/**` untouched.

## Skills

- `quality/deslop` — `/done` runs it

## Stop and ask

- Anything that needs a file outside "Files in scope".

## Next step

Build server/env.ts, server/index.ts, server/static.ts, server/main.ts and their tests.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): dependencies `hono`, `@hono/node-server`, `zod` (exact versions); new package.json scripts `api:dev`, `api:start`.

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
<commands and results>
```
