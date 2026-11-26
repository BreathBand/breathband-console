# T-0136 · chore: http is the local default; local stays the demo fallback (I-14)

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0136 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, row I-14

## Why

The API (`server/`) and the `http` adapter are complete (I-10, I-13), but `.env.example` and the README still start
everyone on the `local` adapter, and nothing has run the demo e2e in a browser against the real API. The demo itself
must stay on `local` (offline, data in the browser) without the new default silently changing what it builds.

## Acceptance criteria

- [x] A1: `.env.example` sets `NEXT_PUBLIC_BACKEND=http`, documents the API base URL and how to run the API with the
  web app, and documents `local` as the demo fallback · check: read `.env.example`; `npx vitest run src/lib/backend/http/http.test.ts`
- [x] A2: `README.md` describes the dev workflow on http (infra:up, db:migrate, db:seed, the API plus the web app) and
  the local fallback · check: read `README.md`
- [x] A3: `docs/DEMO.md` builds the demo on the local backend with an explicit command, and folds in T-0131's review
  notes (signed-out invite in the same window, don't scan the QR live, a clinician's default flags) · check: read
  `docs/DEMO.md`
- [x] A4: the demo e2e passes on local · check: `PORT=3201 npx playwright test e2e/demo-path.spec.ts e2e/demo-people.spec.ts e2e/smoke.spec.ts`
- [x] A5: the demo e2e runs on http against a fresh, seeded file DB; failures recorded, not fixed · check: `npm run e2e:http`
- [x] A6: a build with only `.env.example` values works · check: `.env.local` moved aside, `cp .env.example .env.local`, `npm run build`
- [x] A7: CI passes · check: `rm -rf playwright-report test-results && npm run check`

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

Done: for the lead to review and merge. `npm run e2e:http` (about 3.5 min) runs the demo e2e on http; the questions below are for the owner.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight full-queue note): lane 1 I-14; package.json new scripts only; no new dependencies.
- 2026-11-26: decided for the owner: `src/lib/backend/index.ts` unchanged; an unset `NEXT_PUBLIC_BACKEND` still means `local`, so a static build nobody configured works offline instead of failing every sign-in against an API that isn't there. "http is the local default" lives in `.env.example` (and the Dockerfile already builds http) (alternative: unset means `http`, which needs `NEXT_PUBLIC_API_BASE_URL` or a same-origin API to do anything).
- 2026-11-26: `.env.example` sets `NEXT_PUBLIC_API_BASE_URL=http://localhost:8787` (the web app and the API run on separate ports in development) and keeps a commented `# NEXT_PUBLIC_API_BASE_URL=` line explaining the empty value, which `src/lib/backend/http/http.test.ts` pins. The `# local | firebase | http` line, also pinned, stays.
- 2026-11-26: decided for the owner: removed `.env.example`'s `# NEXT_PUBLIC_API_URL=` line (nothing reads it; the adapter, its README, the Dockerfile and a test use `NEXT_PUBLIC_API_BASE_URL`), as T-0114 recommended (alternative: keep both names until the spec's open question is answered).
- 2026-11-26: decided for the owner: no combined "API + web" script; README says two terminals (alternative: a `dev:all` script, which needs `concurrently`, a new dependency, or a hand-written process runner).
- 2026-11-26: The http e2e is a new `playwright.http.config.ts` (`npm run e2e:http`), not a project in `playwright.config.ts`: it needs its own webServers (API on a fresh `data/e2e-http.db` reset and seeded each run, plus `next dev` built for http). `e2e/auth.ts` signs in through the local demo buttons and localStorage, so the config redirects the specs' `./auth` import to new `e2e/helpers/auth-http.ts` (same exports, the sign-in form) with a Node `registerHooks` resolve hook; no spec and not `e2e/auth.ts` changed. It skips (grepInvert) "the login page offers a demo button", which is local-only by design. One worker, because the API allows 5 sign-ins a minute per client; the helper waits out a 429 and retries.
- 2026-11-26: docs/DEMO.md's new step 13 (the signed-out invite) is not walked by `e2e/demo-script.spec.ts` (an existing spec, out of scope); `e2e/invited-path.spec.ts` covers that page. Steps after it are renumbered 14-19.

## Questions for me

- [ ] Make `e2e/auth.ts` adapter-aware (form sign-in on http, demo buttons on local) so `playwright.http.config.ts` can drop its import-redirect hook? — Recommended: yes, in a small test-only card. Options: keep the hook; duplicate the demo specs for http.
- [ ] On http, a rate-limited sign-in (429) shows "Couldn't sign in. Check your connection and try again." on the login page, not the adapter's "Too many attempts. Wait a minute and try again." Found by the first http e2e run (smoke, 6th sign-in in a minute); the e2e now waits out 429s. Fix the login page to show the error's message for `unavailable`? — Recommended: yes (app code, not this card). Options: leave it.

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

- 2026-11-26 [product] Login page shows "Couldn't sign in. Check your connection" for a 429 on http instead of "Too many attempts" · seen on T-0136 · src/app/cloud/login/page.tsx
- 2026-11-26 [product] docs/deploy.md still lists `NEXT_PUBLIC_API_URL` as an open naming question; `.env.example` now has only `NEXT_PUBLIC_API_BASE_URL` · seen on T-0136 · docs/deploy.md
- 2026-11-26 [product] `e2e/demo-script.spec.ts` doesn't walk DEMO.md's new step 13 (Aoife's invite opened signed out in the same window) · seen on T-0136 · e2e/demo-script.spec.ts
- 2026-11-26 [tool] Stopping a background `npx serve` task left its node process listening on 3201; killed it by PID · seen on T-0136 · npx --yes serve@14.2.4 out -l 3201

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
$ npx vitest run src/lib/backend/http/http.test.ts   (A1: the .env.example tests pin the backend list and the commented base URL)
  Test Files  1 passed (1) · Tests  53 passed (53)
A1-A3: read .env.example, README.md ("Run locally", "The local fallback (no API)", Scripts), docs/DEMO.md
  (Before the demo step 1; part 4 steps 11, 13, 16; "Not built here"; part 6)

$ rm -rf playwright-report test-results && PORT=3201 npx playwright test e2e/demo-path.spec.ts e2e/demo-people.spec.ts e2e/smoke.spec.ts   (A4, local)
  10 passed (2.3m)

$ PORT=3201 npm run e2e:http -- --reporter=list   (A5, http: API on 8797, fresh data/e2e-http.db, db:reset + db:seed)
  run 1: 7 passed, 2 failed (3.4m). Both smoke tests: the 6th and 7th sign-in within a minute got 429 from
         Better Auth (5/min), and the login page showed "Couldn't sign in. Check your connection" (see Questions).
         Test harness fixed: auth-http.ts now reads the sign-in response and waits out a 429.
  run 2: 9 passed (3.4m)   # demo-path x2 (1.1m each), demo-people x5, smoke x2 (coach 1.0m: waited out a 429)
         ("the login page offers a demo button" is skipped on http: local-only by design)

$ mv .env.local aside; cp .env.example .env.local; npm run build   (A6)
  exit 0; "Environments: .env.local"; out/ inlines http://localhost:8787
  served out/ on 3201 (npx serve@14.2.4) + BASE_URL=http://localhost:3201 npx playwright test e2e/demo-people.spec.ts -g "offers a demo button"
  -> fails as expected: no "Sign in as Lena Vos" button, so the build is on http
$ (same .env.local, NEXT_PUBLIC_BACKEND=http) NEXT_PUBLIC_BACKEND=local npm run build   (DEMO.md's demo build)
  exit 0; served on 3201: BASE_URL=http://localhost:3201 npx playwright test e2e/demo-people.spec.ts e2e/smoke.spec.ts e2e/demo-path.spec.ts
  10 passed (2.2m)
  .env.local restored afterwards.

$ rm -rf playwright-report test-results && npm run check   (A7) · exit 0
  lint clean · typecheck clean
  Test Files  110 passed | 1 skipped (111) · Tests  1532 passed | 1 skipped (1533)
  ✓ Compiled successfully · ✓ Generating static pages (27/27)

git diff --stat 86291b3..HEAD (all in scope): .env.example, README.md, docs/DEMO.md, package.json (+1 script: e2e:http),
  playwright.http.config.ts (new), e2e/helpers/auth-http.ts (new), CARD.md. src/lib/backend/index.ts unchanged.

Nothing listening on 3201, 8797 or 8787 afterwards. Nothing run against Turso (file DBs only).

UNTESTED: the README's two-terminal workflow by hand (api:dev on 8787 + npm run dev on 3000, sign-up with the emailed
link, Mailpit via SMTP_HOST); `npm run infra:up`; the PowerShell form of the demo build command; e2e:http on CI or Linux.
```
