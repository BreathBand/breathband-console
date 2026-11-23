# AGENTS.md

<!-- Written by `rivetari init`. Everything above "This repo" is Rivetari's
contract, the same in every Rivetari repo; the "This repo" section is yours to edit.
The judge reads this file from the base branch and blocks a change that breaks it. -->

This repo is built with Rivetari. These rules apply to every agent that
works in it (Claude Code, Codex, Cursor) and to Rivetari's own agents.

## Before anything

Run `rivetari doctor`. If it fails, do what it says (often
`rivetari skills sync`) before starting work.

## Every task starts with /rivetari

In Claude Code: `/rivetari <what you want>` or `/rivetari #<issue>`.
Anywhere else, use the `rivetari task` commands the skill uses. Don't change
files in this checkout on the default branch: each task gets its own worktree and
branch, and the change reaches the default branch only through a reviewed PR.

## The beats

0. **sync**: `rivetari doctor && rivetari skills sync`. Machine and skills ready, pinned and verified.
1. **intake**: a task card with acceptance criteria, each saying how it's verified. A person confirms it.
2. **route**: the router picks sectors, at most four skills, the judge's checks and the proof. A person approves the assembly.
3. **isolate**: a worktree in `.worktrees/<id>` on its own branch from the default branch, with its own port and database.
4. **build**: one agent plans, then builds, inside the worktree; it stops and asks on the triggers below.
5. **prove**: a tool produces the proof; the agent never describes it.
6. **judge**: a clean clone of base plus the change. Deterministic checks first, then a scoped review.
7. **ship**: a draft PR written from the card, the ledger and the proof.
8. **close**: after a person merges, the ledger is sealed, the worktree removed and the metrics row appended.

The ledger in `.rivetari/tasks/<id>/` is the record and the resume point:
`rivetari task resume <id>`. Only the runtime writes it.

## Protected paths

A task never edits these. The judge marks any change to them as needing a person:

- `.rivetari/**`
- `.claude/settings.json`
- `.claude/settings.local.json`
- `.codex/**`
- `.cursor/hooks.json`
- `.cursor/rules/**`
- `.gemini/settings.json`
- `.github/hooks/**`
- `.github/workflows/**`
- `.github/actions/**`
- `lefthook.yml`
- `lefthook.yaml`
- `.lefthook.yml`
- `.pre-commit-config.yaml`
- `.husky/**`
- `commitlint.config.*`
- `**/eslint.config.*`
- `**/.eslintrc*`
- `**/.prettierrc*`
- `**/prettier.config.*`
- `**/biome.json`
- `**/biome.jsonc`
- `**/ruff.toml`
- `**/.ruff.toml`
- `**/.flake8`
- `**/.pylintrc`
- `**/mypy.ini`
- `**/.golangci.*`
- `**/clippy.toml`
- `**/.clippy.toml`
- `**/rustfmt.toml`
- `**/tsconfig*.json`
- `**/.editorconfig`
- tests that already exist (add new tests instead)
- new `eslint-disable`, `@ts-ignore`, `# noqa` or similar suppressions

## Stop and ask

Pause and ask the person before:

- adding a dependency
- a schema change or a migration
- touching a protected path, or deleting or changing an existing test
- any change to lint config, CI config or `.rivetari/**`
- going past the plan's step budget
- treating an acceptance criterion as impossible

## Proof and review

- Proof comes from tools: before and after screenshots with axe for UI work, the
  test run for everything else. It is never written up by the agent.
- The judge works on a clean clone. Lint, typecheck and tests run first; a check
  that's red on the base too is reported as pre-existing. Then comes a review where
  only three things block: a defect, a breach of this file, CONSTRAINTS.md or
  DESIGN.md, and an unmet acceptance criterion. Everything else is a suggestion.
- Blocking findings go back to the agent at most twice. After that a person decides.

## People merge

Rivetari opens draft PRs. It never merges, and neither does any agent.

## This repo

- **breathband-console**: web-app, phase build. The public site (`/`) and the BreathCloud console (`/cloud/`) for the Breathband Flutter app. The roadmap is in `docs/PLAN.md`; check which phase a change belongs to.
- Stack: Next.js, React, TypeScript on Node 22, npm
- Flags: public-facing, has-users, handles-pii
- Commands: install `npm install` · lint `npm run lint` · typecheck `npm run typecheck` · test `npm run test` · all of CI `npm run check`

House rules:

- **Static export only** (`output: "export"`). No server actions, request-reading route handlers, `proxy`, `cookies()`/`headers()`, config rewrites/redirects/headers, or dynamic `[param]` routes. Per-record pages use query strings. Full list: docs/PLAN.md, "Static export rules".
- **Screens talk to data only through `useBackend()` / `useAuth()`.** Never import `lib/backend/local` or `lib/backend/firebase` from a page (the one exception is the demo-account hint on the login page).
- **Adding a backend capability** means updating `lib/backend/types.ts`, the local adapter, its tests, and, if it touches access, `firebase/firestore.rules` / `storage.rules`. These four must agree.
- **`lib/domain/types.ts` is the contract with the Flutter app** (`../breathband`). Don't rename or retype fields casually; the app writes them.
- **Do not install `firebase`, `firebase-admin`, `@google-cloud/*` or other cloud SDKs** until Phase 4 is started deliberately.
- Styling reads from the CSS custom properties in `src/app/globals.css`. Add tokens there instead of hard-coding colours.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
