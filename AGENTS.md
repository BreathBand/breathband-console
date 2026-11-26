# AGENTS.md

## This repo

- **breathband-console**: The public site (`/`) and the BreathCloud console (`/cloud/`) for the Breathband Flutter app. The roadmap is in `docs/PLAN.md`; check which phase a change belongs to.
- Stack: Next.js, React, TypeScript on Node 22, npm
- Commands: install `npm install` · lint `npm run lint` · typecheck `npm run typecheck` · test `npm run test` · all of CI `npm run check`

House rules:

- **Static export only** for the web app (`output: "export"`). No server actions, request-reading route handlers, `proxy`, `cookies()`/`headers()`, config rewrites/redirects/headers, or dynamic `[param]` routes. Per-record pages use query strings. Full list: docs/PLAN.md, "Static export rules". The API is a separate Node program in `server/` (docs/PLAN.md, decision 10), never Next route handlers.
- **Screens talk to data only through `useBackend()` / `useAuth()`.** Screens still never import an adapter (`lib/backend/local`, `lib/backend/http`, `lib/backend/firebase`) or anything in `server/` (the one exception is the demo-account hint on the login page).
- **Adding a backend capability** means updating `lib/backend/types.ts`, the local adapter, the shared contract tests (`lib/backend/contract/`, run against local and http), the `http` adapter and its route in `server/`, and, if it touches access, `server/authz.ts` and `firebase/firestore.rules` / `storage.rules`. These must all agree.
- **`lib/domain/types.ts` is the contract with the Flutter app** (`BreathBand/breathband-app`, checked out locally at `../breathband`). Don't rename or retype fields casually; the app writes them.
- **Server code lives in `server/`** (Hono on Node 22, Drizzle on libSQL, Better Auth; one `package.json`). The API's allowed dependencies are `drizzle-orm`, `drizzle-kit`, `@libsql/client`, `tsx`, `hono`, `@hono/node-server`, `better-auth`, `zod`, `nodemailer`, `qrcode`, their `@types/*` packages, and `concurrently`. Anything else is a stop-and-ask.
- **Never run tests against `libsql://`** (Turso). Tests use file databases; `server/db/test-setup.ts` refuses remote URLs.
- **Do not install `firebase`, `firebase-admin`, `@google-cloud/*` or other cloud SDKs.** The Firebase adapter stays a stub, and Cloud Storage is a stub driver (`server/storage/gcs.ts`), until the owner approves an SDK deliberately.
- Styling reads from the CSS custom properties in `src/app/globals.css`. Add tokens there instead of hard-coding colours.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
