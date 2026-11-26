# T-0102 · chore: local infrastructure: libSQL file DB, Mailpit in Compose, env scripts

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0102 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-02 (re-cut for libSQL per the override at the top)

## Why

The API cards (I-03 onward) need a local database and an SMTP inbox, and every worktree needs the
same environment names. Today there is no Compose file, no infra scripts and `.env.example` only
covers the static web app.

## Acceptance criteria

- [ ] A1: `npm run infra:up` exits 0 with Mailpit healthy · check: `npm run infra:up; echo $?` then `docker compose ps mail`
- [ ] A2: Mailpit UI answers · check: `curl -s -o /dev/null -w '%{http_code}' localhost:8025` returns `200`
- [ ] A3: local DB files, env files and agent worktrees are ignored · check: `git check-ignore data/x.db .env.local .claude/worktrees/x` lists all three
- [ ] A4: `.env.example` documents `TURSO_DATABASE_URL=file:./data/breathband.db` (no token), Turso as the shared option with a placeholder token, and the later-card names · check: `grep -E '^(# )?(TURSO_DATABASE_URL|TURSO_AUTH_TOKEN|AUTH_SECRET|APP_URL|API_PORT|SMTP_HOST|SMTP_PORT|SMTP_FROM|STORAGE_DIR|NEXT_PUBLIC_BACKEND|NEXT_PUBLIC_API_URL)=' .env.example`
- [ ] A5: CI unchanged and green · check: `npm run check`

## Files in scope

- `docker-compose.yml` (new)
- `.env.example`
- `package.json` (scripts only)
- `README.md`
- `.gitignore`
- `CARD.md`

## Out of scope

- The `full` Compose profile and production image (card I-13): placeholder comment only.
- Drizzle, `@libsql/client` or any DB code (card I-03).
- Changing the `http` adapter's env name `NEXT_PUBLIC_API_BASE_URL` (an existing test pins it).

## Constraints

- No new dependencies. `check` script unchanged.
- No real secrets or Turso URLs anywhere; the repo is public.

## Skills

None needed.

## Stop and ask

- Anything that would talk to a `libsql://` URL.

## Next step

Build docker-compose.yml, .env.example, scripts and README section; run the checks.

## Decisions

Appended by the session, one line each, newest last.

- 2026-11-26: Owner approved 2026-11-26 (overnight note): package.json new scripts (`infra:up`, `infra:down`). No dependencies.

## Questions for me

## Parked

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead opens PRs)

### Evidence

```
<commands and results>
```
