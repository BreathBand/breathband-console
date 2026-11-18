@AGENTS.md

# Breathband Console: working agreement

Public site (`/`) and BreathCloud console (`/cloud/`) for the Breathband Flutter app. The roadmap is in `docs/PLAN.md`; check which phase a change belongs to.

## Rules

- **Static export only** (`output: "export"`). No server actions, request-reading route handlers, `proxy`, `cookies()`/`headers()`, config rewrites/redirects/headers, or dynamic `[param]` routes. Per-record pages use query strings. Full list: docs/PLAN.md, "Static export rules".
- **Screens talk to data only through `useBackend()` / `useAuth()`.** Never import `lib/backend/local` or `lib/backend/firebase` from a page (the one exception is the demo-account hint on the login page).
- **Adding a backend capability** means updating `lib/backend/types.ts`, the local adapter, its tests, and, if it touches access, `firebase/firestore.rules` / `storage.rules`. These four must agree.
- **`lib/domain/types.ts` is the contract with the Flutter app** (`../breathband`). Don't rename or retype fields casually; the app writes them.
- **Do not install `firebase`, `firebase-admin`, `@google-cloud/*` or other cloud SDKs** until Phase 4 is started deliberately.
- Styling reads from the CSS custom properties in `src/app/globals.css`. Add tokens there instead of hard-coding colours.
- `npm run check` must pass before committing (it's what CI runs).
