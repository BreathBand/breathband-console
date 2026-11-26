# T-0110 · feat: API skeleton on Hono: health, env, errors, security headers, static files

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0110 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-05 ("What we're building", decisions table, Repo layout, Local workflow; libSQL override at the top)

## Why

The API cards (auth, routes, seed) need a server to hang routes on. Today there is no server
code beyond `server/db/**`, and the security headers and caching rules live only in `nginx.conf`,
which the API replaces (decision 6).

## Acceptance criteria

- [x] A1: `GET /api/health` answers 200 with the db status · check: `TURSO_DATABASE_URL=file:./data/t0110.db npm run db:migrate`, then `TURSO_DATABASE_URL=file:./data/t0110.db API_PORT=8790 npm run api:start`, `curl -s localhost:8790/api/health` (server stopped and file deleted afterwards); up/down cases in `server/index.test.ts`
- [x] A2: every response carries the nginx.conf security headers, and `/_next/static/` also gets immutable caching · check: `npx vitest run server/` (headers on an HTML page, a `/_next/static/` asset, a 404 and an error)
- [x] A3: serves `out/` like nginx (`try_files $uri $uri/ $uri.html =404`, 404.html) · check: after `npm run build`, `curl -I localhost:8790/cloud/login/` is 200 with the headers; temp `out/` fixture cases in `server/static.test.ts`
- [x] A4: unknown `/api` routes and errors answer JSON, no stack in production; CORS for the web app with credentials in development only · check: `npx vitest run server/`
- [x] A5: CI green · check: `npm run check`

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

Lead: review and merge into night/2026-11-26. Next API card (I-06 auth) registers its routes in `createApp` before the static catch-all.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): dependencies `hono`, `@hono/node-server`, `zod` (exact versions); new package.json scripts `api:dev`, `api:start`.
- 2026-11-26: installed exact: `hono@4.13.22`, `@hono/node-server@2.1.11`, `zod@4.6.7` (dependencies, not devDependencies: the API runs them). `check` unchanged; `npm run typecheck` already covers `server/**` (tsconfig includes `**/*.ts`; `tsc --listFilesOnly` lists `server/{env,index,main,static}.ts`).
- 2026-11-26: new files beyond the listed ones: `server/development.env` (one line, `NODE_ENV=development`, loaded only by `api:dev` through `tsx watch --env-file=...`; npm runs scripts in cmd.exe on Windows, so `NODE_ENV=development tsx ...` would not work there without a new dependency like cross-env). No secrets; real environment variables win over it. `.env.local` is never loaded.
- 2026-11-26: decided for the owner: `NODE_ENV` unset means production (no stack traces, no CORS, static files on); `api:start` relies on that (alternative: default development and set production in `api:start`, which needs the same env-file trick or cross-env).
- 2026-11-26: decided for the owner: `/api/health` answers 200 even when the database is down, with `{ ok: false, db: "down" }`, and gives the db 2 s before calling it down (alternative: 503 when down; better for a readiness probe, worse for a liveness probe that would restart a healthy process during a db blip).
- 2026-11-26: decided for the owner: error bodies are `{ error: { code, message } }` with the adapter's `BackendErrorCode` names where one fits (`not-found`, `permission-denied`, `not-signed-in`, `invalid-input`), else `internal`/`error`; development adds the message and `stack` (alternative: codes chosen later by the http adapter card).
- 2026-11-26: decided for the owner: static files are served by a small `server/static.ts` (nginx's `try_files $uri $uri/ $uri.html =404` + `error_page 404 /404.html`, ETag/Last-Modified/304 like nginx, path traversal refused) rather than `@hono/node-server`'s `serveStatic`, which has no `$uri.html` step and no per-path caching (alternative: serveStatic plus wrappers). Differences from nginx: a folder without `index.html` answers 404 (nginx: 403); no Range requests.
- 2026-11-26: decided for the owner: CORS origin in development is `APP_URL`'s origin (default `http://localhost:3000`), on `/api/*` only. Request logging (`hono/logger`) to stdout in development and production, off in tests.
- 2026-11-26: health "down" test uses `http://127.0.0.1:1` (a local URL the test guard allows; nothing listens there). A file URL can't be made to fail at `select 1`: libSQL opens files eagerly and `select 1` reads no pages.

## Questions for me

## Parked

- 2026-11-26 [product] `api:start` runs through `tsx` (a devDependency); the production image (I-13) needs either tsx in dependencies or a compiled build, and Cloud Run sets `PORT`, not `API_PORT` · seen on T-0110 · package.json
- 2026-11-26 [product] `npm audit`: 4 moderate (esbuild <=0.24.2 under drizzle-kit, dev only), present before this card · seen on T-0110 · `npm audit`

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below; `server/development.env` added, see Decisions)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
$ TURSO_DATABASE_URL=file:./data/t0110.db npm run db:migrate
Migrations applied to file:./data/t0110.db.

$ npm run build   (exit 0)
$ TURSO_DATABASE_URL=file:./data/t0110.db API_PORT=8790 npm run api:start
API (production) listening on http://localhost:8790

$ curl -s -i localhost:8790/api/health
HTTP/1.1 200 OK
content-type: application/json
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: DENY
{"ok":true,"db":"up"}

$ curl -I localhost:8790/cloud/login/
HTTP/1.1 200 OK
content-length: 11106
content-type: text/html; charset=utf-8
etag: "6b07dfed-2b62"
last-modified: Thu, 26 Nov 2026 07:29:49 GMT
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: DENY

$ curl -I localhost:8790/_next/static/chunks/0ciyhxkv573gp.js
HTTP/1.1 200 OK
cache-control: public, max-age=31536000, immutable
content-type: text/javascript; charset=utf-8
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: DENY

$ curl -I localhost:8790/cloud/login          -> HTTP/1.1 200 OK
$ curl -I localhost:8790/nope/                -> HTTP/1.1 404 Not Found, text/html (404.html), security headers
$ curl -s localhost:8790/api/nope             -> 404 {"error":{"code":"not-found","message":"Not found"}}
$ curl -I -H "Origin: http://localhost:3000" localhost:8790/api/health | grep -ic access-control   -> 0 (production)
(server stopped; data/t0110.db deleted)

$ API_PORT=8791 npm run api:dev   (TURSO_DATABASE_URL=file:./data/t0110.db)
API (development) listening on http://localhost:8791
$ curl -i -H "Origin: http://localhost:3000" localhost:8791/api/health
HTTP/1.1 200 OK
access-control-allow-credentials: true
access-control-allow-origin: http://localhost:3000
{"ok":true,"db":"up"}
(server stopped)

Graceful shutdown: scratch script imports server/main.ts in-process (API_PORT=8792), one request, then
process.emit("SIGINT") -> "SIGINT: closing the server", "exited by itself after 2 ms, code 0".
A real OS signal to a separate process is UNTESTED on this Windows machine.

$ npx vitest run server/
 Test Files  6 passed (6)
      Tests  59 passed (59)
Mutation check: removing the path containment check in server/static.ts fails 2 traversal tests; restored.

$ npm run check   (lint, typecheck, tests, build)
check exit 0
 Test Files  55 passed (55)
      Tests  600 passed (600)
Generating static pages (26/26)

$ git diff --cached --stat (feat commit, CARD.md aside)
 package-lock.json      |  27 ++++++++-
 package.json           |   9 ++-
 server/development.env |   3 +
 server/env.test.ts     |  57 ++++++++++++++++++
 server/env.ts          |  53 +++++++++++++++++
 server/index.test.ts   | 153 +++++++++++++++++++++++++++++++++++++++++++++++++
 server/index.ts        | 106 ++++++++++++++++++++++++++++++++++
 server/main.ts         |  60 +++++++++++++++++++
 server/static.test.ts  | 122 +++++++++++++++++++++++++++++++++++++++
 server/static.ts       |  90 +++++++++++++++++++++++++++++
 10 files changed, 676 insertions(+), 4 deletions(-)
```
