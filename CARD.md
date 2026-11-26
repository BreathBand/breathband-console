# T-0136 · chore: http is the local default; local stays the demo fallback (I-14)

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0136 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, row I-14

## Why

The API (`server/`) and the `http` adapter are complete (I-10, I-13), but `.env.example` and the README still start
everyone on the `local` adapter, and nothing has run the demo e2e in a browser against the real API. The demo itself
must stay on `local` (offline, data in the browser) without the new default silently changing what it builds.

## Acceptance criteria

- [ ] A1: `.env.example` sets `NEXT_PUBLIC_BACKEND=http`, documents the API base URL and how to run the API with the
  web app, and documents `local` as the demo fallback · check: read `.env.example`; `npx vitest run src/lib/backend/http/http.test.ts`
- [ ] A2: `README.md` describes the dev workflow on http (infra:up, db:migrate, db:seed, the API plus the web app) and
  the local fallback · check: read `README.md`
- [ ] A3: `docs/DEMO.md` builds the demo on the local backend with an explicit command, and folds in T-0131's review
  notes (signed-out invite in the same window, don't scan the QR live, a clinician's default flags) · check: read
  `docs/DEMO.md`
- [ ] A4: the demo e2e passes on local · check: `PORT=3201 npx playwright test e2e/demo-path.spec.ts e2e/demo-people.spec.ts e2e/smoke.spec.ts`
- [ ] A5: the demo e2e runs on http against a fresh, seeded file DB; failures recorded, not fixed · check: `npm run e2e:http`
- [ ] A6: a build with only `.env.example` values works · check: `.env.local` moved aside, `cp .env.example .env.local`, `npm run build`
- [ ] A7: CI passes · check: `rm -rf playwright-report test-results && npm run check`

## Files in scope

- `.env.example`
- `README.md`
- `docs/DEMO.md`
- `src/lib/backend/index.ts` (the default only, if changed)
- new `playwright.http.config.ts`
- new `e2e/helpers/**`
- `package.json` (new scripts only)
- `CARD.md`

## Out of scope

- App code: `src/app/**`, `src/lib/backend/local/**`, `src/lib/backend/http/**`, `server/**` (T-0137 is editing screens).
- Existing e2e specs, `e2e/auth.ts`, `playwright.config.ts`, `.github/**`.
- Fixing any http-path bug the e2e finds (parked or asked instead).

## Constraints

- No new dependencies. Port 3201 for the web app; never Turso.

## Skills

- none

## Stop and ask

- A demo spec can only pass on http by changing app code or an existing spec.

## Next step

Draft the docs, then the http Playwright config, then run the checks.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight full-queue note): lane 1 I-14; package.json new scripts only; no new dependencies.

## Questions for me

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
```
