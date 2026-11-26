# T-0134 · docs: decision 10 and the API house rules; Cloud Run readiness (deploy.md, GCS driver stub)

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0134 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, rows I-01 and I-16 (decisions 1, 5, 6, 10; "Later on Google Cloud")

## Why

The API (Hono on libSQL/Turso with Better Auth, one Cloud Run image) is built, but `docs/PLAN.md` still plans Firebase for
Phase 4 and the house rules in `CLAUDE.md`/`AGENTS.md` don't name the API's dependencies or `server/`. Nothing gathers what
Cloud Run needs (env, secrets, migrations job, storage) or the must-fixes the infra cards parked before a first deploy.

## Acceptance criteria

- [x] A1: `docs/PLAN.md` records decision 10 (what 04's decisions 1, 5 and 6 replace; Firebase stays a stub) · check: `grep -n "| 10 |" docs/PLAN.md`
- [x] A2: the house rules in `CLAUDE.md` and `AGENTS.md` name the API's allowed deps, `server/`, no adapter imports in screens, the extended "must agree" rule, no tests against `libsql://`, and keep "no cloud SDKs"; only the house-rules section changed and both files agree · check: `git diff 7866546 -- CLAUDE.md AGENTS.md` and a diff of the two rule blocks
- [x] A3: `docs/deploy.md` has the Cloud Run mapping, the env table (secrets marked, `PORT`, `APP_URL`, `AUTH_SECRET`, SMTP, Turso, `TRUSTED_PROXY_HOPS` added by T-0133, storage), the migrations job, "Before first deploy" and "No deploy"; every repo path it names exists · check: path-check script (Evidence)
- [x] A4: `server/storage/gcs.ts` implements `StorageService`, throws "not configured", adds no dependency · check: `npx vitest run server/storage/gcs.test.ts`; `git diff 7866546 -- package.json package-lock.json` empty
- [x] A5: `npm run check` passes (after removing `playwright-report/` and `test-results/`)

## Files in scope

- `docs/PLAN.md`, new `docs/deploy.md`
- `CLAUDE.md`, `AGENTS.md` (house-rules section only)
- `README.md`
- new `server/storage/gcs.ts`, new `server/storage/gcs.test.ts`
- `CARD.md`

## Out of scope

- `.env.example` (T-0133 owns it now; parked)
- Wiring a `gcs` storage choice into `server/main.ts` (no selector exists today)
- Fixing any "Before first deploy" item (trusted proxies, rate limits, compose ports, `.dockerignore`)

## Constraints

- No new dependencies; never install `@google-cloud/*`. Nothing deployed, no cloud resources, nothing run against Turso.

## Skills

- none

## Stop and ask

- Anything that needs `server/main.ts`, `server/auth.ts`, `.env.example` or `.dockerignore`.

## Next step

Done: for the lead to review and merge card/T-0134 into night/2026-11-26 (it already contains night at 04e32bd, T-0133). Nothing deployed.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight full-queue note): agent config (CLAUDE.md and AGENTS.md house rules) for I-01 only; I-16 docs and stub, no deploy; no new dependencies.
- 2026-11-26: no storage selector exists (`server/main.ts` builds the fs driver directly), so none was added; `gcs.ts` is standalone and `server/storage/index.ts` is unchanged. The stub checks keys like the fs driver, then rejects with `StorageNotConfiguredError`.
- 2026-11-26: the migrations job needed no code: `build/server/migrate.mjs` (T-0128) reads TURSO_DATABASE_URL/TURSO_AUTH_TOKEN and finds `./server/db/migrations` from the image's WORKDIR; built and run here on a temp file DB (5 migrations recorded).
- 2026-11-26: house rules: kept `firebase/firestore.rules`/`storage.rules` in the must-agree rule (cards still update them) and added `server/authz.ts`; the login-page exception is unchanged.
- 2026-11-26: docs/PLAN.md: besides the decision 10 row, marked the superseded parts of decisions 1 and 2, the Firebase App Hosting sentence and Phase 4, and rewrote the Cloud Run section (it still described nginx, parked on T-0128) to point at docs/deploy.md.
- 2026-11-26: decided for the owner: TURSO_DATABASE_URL is listed as a secret in deploy.md (the repo is public), alongside the token (alternative: plain env var).
- 2026-11-26: merged origin/night/2026-11-26 (T-0133, 04e32bd) as the lead asked; no conflict. Then, per the lead: README's TRUSTED_PROXY_HOPS sentence softened (expected 1/2, confirm before deploy, too high/too low warning); deploy.md calls it merged with T-0133.
- 2026-11-26 (review fix, blocking): README's deploy section no longer shows `gcloud run deploy --source .` (no build args, no env or secrets, no checklist gate); it points to docs/deploy.md. Also from the review: PLAN.md's headers line names `SECURITY_HEADERS` in server/index.ts, "Firebase rules handle authorization" and Phase 4a for the waitlist are marked superseded; deploy.md says CORS is development-only and what APP_URL does in production (authBaseUrl), drops the seed/APP_URL claim, and creates AUTH_SECRET by piping openssl into `gcloud secrets create --data-file=-`; README no longer calls the API "coming"; house rules say "the local adapter and its tests, the shared contract tests" (CLAUDE.md and AGENTS.md identical, house-rules hunks only). Removed the matching Parked line.

## Questions for me

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

- 2026-11-26 [product] sync .env.example with docs/deploy.md: add PORT, state the TRUSTED_PROXY_HOPS counts as expected-not-confirmed, settle NEXT_PUBLIC_API_URL vs NEXT_PUBLIC_API_BASE_URL · seen on T-0134 · .env.example
- 2026-11-26 [product] `src/app/cloud/CloudShell.tsx` imports `@/lib/backend/local/db` (the sidebar Reset), a second exception to "screens never import an adapter" that the house rules don't name · seen on T-0134 · src/app/cloud/CloudShell.tsx
- 2026-11-26 [product] `server/storage/index.ts` comment says the Cloud Storage driver "comes later (I-16)"; it is now a stub in gcs.ts · seen on T-0134 · server/storage/index.ts

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (the lead opens PRs)

### Evidence

All after merging origin/night/2026-11-26 (04e32bd); `npm ci` first.

```
$ rm -rf playwright-report test-results && npm run check                      # A5
exit 0 · lint clean · typecheck clean · Test Files 110 passed | 1 skipped (111) · Tests 1500 passed | 1 skipped (1501)
✓ Generating static pages using 23 workers (27/27)   (the skip is server/auth.mailpit.test.ts, needs Mailpit)

$ npx vitest run server/storage/gcs.test.ts                                      # A4
Test Files 1 passed (1) · Tests 4 passed (4)   (rejects with not configured; promises; unsafe keys first; no @google-cloud / firebase in gcs.ts or package.json)
$ git diff 7866546 -- package.json package-lock.json | wc -l                      # A4: no new dependency
0

$ grep -n "| 10 |" docs/PLAN.md                                                    # A1
59:| 10 | 2026-11-26 | **The backend is our own API, not Firebase** ...

$ git diff --stat 7866546 -- CLAUDE.md AGENTS.md; git diff -U0 7866546 -- CLAUDE.md AGENTS.md | grep "^@@"   # A2
 AGENTS.md | 10 ++++++----   CLAUDE.md | 10 ++++++----
@@ -11,3 +11,3 @@ House rules:   @@ -15 +15,3 @@ House rules:     (CLAUDE.md)
@@ -12,3 +12,3 @@ House rules:   @@ -16 +16,3 @@ House rules:     (AGENTS.md)
$ diff <(sed -n "/^House rules:/,/hard-coding colours/p" CLAUDE.md) <(sed -n "/^House rules:/,/hard-coding colours/p" AGENTS.md) && echo identical
house-rules blocks identical   ("How work is done here" and the Next.js block untouched)

$ node pathcheck.mjs docs/deploy.md     # A3: every backticked or linked path in deploy.md exists (after npm run build and build:server)
41 paths, 0 missing; skipped as not repo paths: roles/secretmanager.secretAccessor, bb-night/data/blobs, .turso/, .firebase/

$ npm run build:server && TURSO_DATABASE_URL=file:<tmp>/m.db node build/server/migrate.mjs   # migrations job entry point
Migrations applied to file:/tmp/.../m.db. · exit 0 · __drizzle_migrations: 5 rows

$ git diff --stat origin/night/2026-11-26 HEAD
 AGENTS.md 10, CARD.md, CLAUDE.md 10, README.md 19, docs/PLAN.md 37, docs/deploy.md 213 (new), server/storage/gcs.test.ts 40 (new), server/storage/gcs.ts 49 (new)
```

Fix round (after the review): `npm run check` exit 0 (110 files passed, 1 skipped; 1500 tests passed, 1 skipped; build 27/27); path check 41 paths, 0 missing; CLAUDE.md/AGENTS.md house-rules blocks identical, `git diff -U0 7866546` hunks only under "House rules:".

UNTESTED: every `gcloud` command in docs/deploy.md (by design: no deploy, no cloud resources); nothing run against Turso; e2e not run (no user flow changed).
