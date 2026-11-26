# AGENTS.md

## This repo

- **breathband-console**: The public site (`/`) and the BreathCloud console (`/cloud/`) for the Breathband Flutter app. The roadmap is in `docs/PLAN.md`; check which phase a change belongs to.
- Stack: Next.js, React, TypeScript on Node 22, npm
- Commands: install `npm install` · lint `npm run lint` · typecheck `npm run typecheck` · test `npm run test` · all of CI `npm run check`

House rules:

- **Static export only** (`output: "export"`). No server actions, request-reading route handlers, `proxy`, `cookies()`/`headers()`, config rewrites/redirects/headers, or dynamic `[param]` routes. Per-record pages use query strings. Full list: docs/PLAN.md, "Static export rules".
- **Screens talk to data only through `useBackend()` / `useAuth()`.** Never import `lib/backend/local` or `lib/backend/firebase` from a page (the one exception is the demo-account hint on the login page).
- **Adding a backend capability** means updating `lib/backend/types.ts`, the local adapter, its tests, and, if it touches access, `firebase/firestore.rules` / `storage.rules`. These four must agree.
- **`lib/domain/types.ts` is the contract with the Flutter app** (`BreathBand/breathband-app`, checked out locally at `../breathband`). Don't rename or retype fields casually; the app writes them.
- **Do not install `firebase`, `firebase-admin`, `@google-cloud/*` or other cloud SDKs** until Phase 4 is started deliberately.
- Styling reads from the CSS custom properties in `src/app/globals.css`. Add tokens there instead of hard-coding colours.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
