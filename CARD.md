# T-0134 · docs: decision 10 and the API house rules; Cloud Run readiness (deploy.md, GCS driver stub)

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0134 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, rows I-01 and I-16 (decisions 1, 5, 6, 10; "Later on Google Cloud")

## Why

The API (Hono on libSQL/Turso with Better Auth, one Cloud Run image) is built, but `docs/PLAN.md` still plans Firebase for
Phase 4 and the house rules in `CLAUDE.md`/`AGENTS.md` don't name the API's dependencies or `server/`. Nothing gathers what
Cloud Run needs (env, secrets, migrations job, storage) or the must-fixes the infra cards parked before a first deploy.

## Acceptance criteria

- [ ] A1: `docs/PLAN.md` records decision 10 (what 04's decisions 1, 5 and 6 replace; Firebase stays a stub) · check: `grep -n "| 10 |" docs/PLAN.md`
- [ ] A2: the house rules in `CLAUDE.md` and `AGENTS.md` name the API's allowed deps, `server/`, no adapter imports in screens, the extended "must agree" rule, no tests against `libsql://`, and keep "no cloud SDKs"; only the house-rules section changed and both files agree · check: `git diff 7866546 -- CLAUDE.md AGENTS.md` and a diff of the two rule blocks
- [ ] A3: `docs/deploy.md` has the Cloud Run mapping, the env table (secrets marked, `PORT`, `APP_URL`, `AUTH_SECRET`, SMTP, Turso, `TRUSTED_PROXY_HOPS` added by T-0133, storage), the migrations job, "Before first deploy" and "No deploy"; every repo path it names exists · check: path-check script (Evidence)
- [ ] A4: `server/storage/gcs.ts` implements `StorageService`, throws "not configured", adds no dependency · check: `npx vitest run server/storage/gcs.test.ts`; `git diff 7866546 -- package.json package-lock.json` empty
- [ ] A5: `npm run check` passes (after removing `playwright-report/` and `test-results/`)

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

Build: PLAN.md decision 10, house rules, README, gcs stub + test, deploy.md; then checks.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight full-queue note): agent config (CLAUDE.md and AGENTS.md house rules) for I-01 only; I-16 docs and stub, no deploy; no new dependencies.

## Questions for me

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (the lead opens PRs)

### Evidence

```
```
