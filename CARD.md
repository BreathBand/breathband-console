# T-0121 · feat: API data part 2: coach links, invites, scopes, revoke, assignments, comments, kudos, seen, notes, targets

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0121 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/04-infrastructure.md, card I-09 ("Tests": contract parity incl. every permission case)

## Why

I-08 serves profile, sessions and waveforms over `/api/v1`, but every coaching method of the http adapter still
fails with "unavailable", and the contract harness makes coach links by writing them directly. I-09 serves coach
links, invites, scope, revoke, assignments, comments, kudos, seen marks, private notes and targets with the access
rules on the server, and proves parity with the local adapter in shared contract sections.

## Acceptance criteria

- [x] A1: contract sections for links/invites/scope/revoke, notes, seen, targets, assignments, comments and kudos pass on local and http, covering own vs linked vs unlinked vs revoked, scores-only vs curves, private notes never visible to the athlete · check: `npx vitest run src/lib/backend/contract src/lib/backend/http server`
- [x] A2: authz unit tests for each new rule · check: `npx vitest run server/authz.test.ts`
- [x] A3: invite codes are stored only as hashes, expire, and redeem once (API checks) · check: `npx vitest run src/lib/backend/http/data.http.test.ts`
- [x] A4: CI green · check: `npm run check` (playwright-report/ and test-results/ removed first)

## Files in scope

- `server/routes/coaching*.ts` (new), `server/routes/data.ts` (one line: mount them on the data routes' Hono instance)
- `server/authz.ts`, `server/authz.test.ts`
- `server/index.ts` (mount, if needed)
- new tests under `server/`
- `src/lib/backend/http/**` (incl. `http.test.ts` where the I-09 stubs are replaced, logged)
- `src/lib/backend/contract/**` (new sections; harness changes)
- `server/db/**` only for a strictly needed generated migration (logged)
- `CARD.md`

## Out of scope

- Squads, alert rules, coach invites (coach → athlete), group sessions, waitlist (I-10).
- Screens (`src/app/**`), the local adapter (`src/lib/backend/local/**`), `src/lib/domain/types.ts`.
- Seed (I-12), account deletion (I-15).

## Constraints

- No new dependencies. File DBs only, never `libsql://`. Never read `.env.local`.
- `src/app/**`, `src/lib/domain/types.ts`, `src/lib/backend/local/**`, `src/lib/backend/types.ts`, `package.json` untouched.

## Skills

- `quality/deslop` — `/done` runs it

## Stop and ask

- A schema change beyond what the coaching tables strictly need.

## Next step

Lead: review and merge into night/2026-11-26 (no migration). I-10 adds squads, alerts, coach invites, groups and the waitlist on the same `server/routes/data.ts` pattern; the harness now links people through real invites.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no new dependencies; schema changes only if strictly needed (new generated migration under server/db/**, logged; the lead applies it to Turso); harness changes in `src/lib/backend/contract/**` allowed.
- 2026-11-26: no schema change: tables from 0000/0001 suffice. No new dependencies (hashing is `node:crypto`).
- 2026-11-26: new files `server/routes/coaching.ts` (links, invites, seen, notes, targets) and `server/routes/coaching-feedback.ts` (assignments, comments, kudos); mounted with 4 lines in `server/routes/data.ts` (same Hono instance, so one error handler and the session middleware cover them), not in `server/index.ts`.
- 2026-11-26: authz rules added: `canReadLink`, `canManageSharing`, `canRedeemInvite`, `canCoach`, `canCancelAssignment`, `canComment`, `canDeleteComment`, `canUseCoachData` (each mirrors a firestore.rules clause and the local adapter's check).
- 2026-11-26: invites: only `sha256(normalised code)` is stored; 7-day expiry, status pending → redeemed claimed with a conditional UPDATE so a code redeems once even when two coaches race. A redeem onto an existing link keeps that link's scope and targets (as local).
- 2026-11-26: decided for the owner: any signed-in person may redeem an invite (parity with local and firestore's Cloud Function note) (alternative: role "coach" only; see Questions).
- 2026-11-26: decided for the owner: `markSessionSeen` on the API needs the session to exist (`not-found`) and a link to the athlete (`permission-denied`); local accepts any key. Needed because `seen_sessions.session_id` is a foreign key (alternative: silently ignore unknown keys). http-only test in `data.http.test.ts`.
- 2026-11-26: decided for the owner: `listAthletes`/`listCoaches` return profiles without birth year and consents, like `getProfile` of another person (T-0117) (alternative: full profiles as local).
- 2026-11-26: decided for the owner: a coach's notes and seen marks stay after revoke (as local); a revoked coach can still cancel practice they set (firestore.rules: setter only, no link needed).
- 2026-11-26: harness: `link()` now goes through DataService for real on both adapters (`linkThroughInvites`: athlete's createInvite → coach's redeemInvite; setCoachScope; revokeCoach). The http harness's email-confirmation fetch now sends its own `X-Forwarded-For` (Better Auth's per-IP rate limit answered 429 once the coaching sections made ~100 people).
- 2026-11-26: existing test changed: `src/lib/backend/http/http.test.ts` "I-09/I-10: every other method fails" became "I-10: ..." (skips the 18 coaching methods, expects "I-10" in the message, which `index.ts` now says); two new I-09 tests added beside it. README updated to match.

## Questions for me

- [ ] Should redeeming an athlete's invite be for professionals (role "coach") only? Today any signed-in person can, on local and the API alike. — Recommended: yes, in a follow-up that changes local, the API and firestore.rules together. Options: keep as is.

## Parked

- 2026-11-26 [product] the local adapter's `markSessionSeen` accepts any key (no link, no session check) while the API refuses both · seen on T-0121 · src/lib/backend/local/index.ts
- 2026-11-26 [product] an athlete can't list or withdraw invites they've made (no DataService method; `invites.status` has "revoked" unused) · seen on T-0121 · src/lib/backend/types.ts

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
$ npx vitest run src/lib/backend/contract src/lib/backend/http server     # A1
 Test Files  17 passed | 1 skipped (18)          (skipped: auth.mailpit.test.ts without MAILPIT_E2E)
      Tests  417 passed | 1 skipped (418)
$ npx vitest run src/lib/backend/contract/data.local.test.ts src/lib/backend/http/data.http.test.ts
      Tests  177 passed (177)                    (coaching section: 39 tests on each adapter; + 4 coaching API checks on http)
$ npx vitest run server/authz.test.ts                                     # A2
      Tests  24 passed (24)
$ A3: data.http.test.ts "the coaching API behind the http DataService": hash only, expired refused, racing redeem once, seen marks; passed above
$ sanity: with canUseCoachData and canComment always true, 3 authz tests and 3 http contract tests fail (note hidden from athlete, seen list, stranger/revoked comments); restored
$ npm run typecheck   ok;   npx eslint server src/lib/backend   clean
$ npm run check       (playwright-report/ and test-results/ removed first)   # A4; exit 0
 Test Files  84 passed | 1 skipped (85)
      Tests  1160 passed | 1 skipped (1161); build 27/27 static pages
$ git diff --cached --stat: 14 files, +1116 −39 (non-test source ≈ 490 lines)
```

UNTESTED: the http adapter in a real browser against `npm run api:dev`; a `NEXT_PUBLIC_BACKEND=http` build of the coaching screens; no e2e (none for this lane).
