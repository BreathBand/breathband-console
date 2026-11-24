# T-0028 · Set up Playwright e2e with coach and athlete sign-in reusing the proof-auth flow

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 06:24 intake: card drafted with 4 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 06:24 intake: intake confirmed; card sha256 f4249a41968f84141ef30aff12120574037e0eeeaab56dd37f385b7264749b50 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 06:24 route: assembly proposed; sha256 0f7af81c9bfc489ef435a68324ea4917ce3de278070980884f5f9f671a2f79dc; skills none; proof test-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 06:24 route: route approved; assembly sha256 0f7af81c9bfc489ef435a68324ea4917ce3de278070980884f5f9f671a2f79dc (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 06:25 isolate: worktree .worktrees/T-0028 · branch chore/t-0028 from origin/main (4190baa70132) · port 5175 · db breathband_console_t0028 · env sha256 970102cdcb25a9fb17c7a7b5d090b67962d2f87b9a98169bd80e9ca7895faf05 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:25 build: build started · skills spine only · budget 12 steps / 60k ctx · ~13552 prompt tokens · 2 repo file(s) in context · 188684 tokens · $0.31 · 5 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:27 build: build started · skills spine only · budget 12 steps / 60k ctx · ~13598 prompt tokens · 2 repo file(s) in context · 240975 tokens · $0.37 · 7 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:29 build: build paused: 1 thing(s) to ask about · commit 77a3ca2258cd · 1063815 tokens · $0.71 · 32 turns (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 06:27 1. Read rivetari-session/logs/T-0010-uncommitted-R-14.patch if the worktree can reach it; if it can't, use .rivetari/proof-auth.mjs, the read-only source of the sign-in flow, plus the login page (src/app/cloud/login/page.tsx renders the 'Sign in as <displayName>' demo buttons) and the seed (src/lib/backend/local/seed.ts: demo-coach Lena Vos, demo-athlete Alex Morgan)
- 2026-11-24 06:27 2. Run `npm install --save-dev --save-exact @playwright/test@1.65.1` with no browser install. Check that package.json lists "@playwright/test": "1.65.1" with no caret, that package-lock.json changed to match and that no other dependency changed
- 2026-11-24 06:27 3. Add "e2e": "playwright test" to the package.json scripts, leaving every other script as it is
- 2026-11-24 06:27 4. Write playwright.config.ts at the repo root with defineConfig and devices from @playwright/test: testDir './e2e', a single chromium project (devices['Desktop Chrome']), a 120s timeout, retries 0, use.baseURL = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`, and a webServer of { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 180_000 } only when BASE_URL is unset. Add no comments
- 2026-11-24 06:27 5. Write e2e/auth.ts, ported from proof-auth.mjs with no import from .rivetari and no comments. It holds the DB_KEY 'breathband-console:local-db' and a private signInAs(page, name, uid) that goes to /cloud/login/, then clicks getByRole('button', { name: new RegExp(`Sign in as ${name}`) }) until page.waitForFunction sees JSON.parse(localStorage[DB_KEY]).currentUid === uid (3s per try, 90s overall, throwing an Error with context after that). Then it runs page.waitForURL for a pathname that no longer starts with /cloud/login. Export signInAsCoach(page) (Lena Vos, demo-coach) and signInAsAthlete(page) (Alex Morgan, demo-athlete), typed with Page from @playwright/test
- 2026-11-24 06:27 6. Grep src/app/cloud/athletes/ and src/app/cloud/page.tsx (plus AthleteOverview.tsx) for the Athletes roster heading or landmark and the 'Latest Total Breath Score' region (section aria-label at AthleteOverview.tsx:79), so the spec uses role-based locators that really exist
- 2026-11-24 06:27 7. Write e2e/smoke.spec.ts with two tests and no comments. Coach: signInAsCoach, expect the URL pathname to be /cloud/, page.goto('/cloud/athletes/'), then expect the Athletes heading or roster to be visible. Athlete: signInAsAthlete, expect /cloud/, then expect getByRole('region', { name: 'Latest Total Breath Score' }) to be visible. Use no fixtures named `use` and no test.skip/only
- 2026-11-24 06:27 8. Append test-results/, playwright-report/, blob-report/ and playwright/.cache/ to .gitignore under the '# testing' section
- 2026-11-24 06:27 9. Confirm vitest.config.mts include ['src/**/*.test.ts'] already leaves e2e/ out, so neither it nor tsconfig/eslint (protected) needs editing, then run `npm run lint` and `npm run typecheck` and fix any errors in the new files only
- 2026-11-24 06:27 10. Run `npm run test -- related --run playwright.config.ts e2e/auth.ts e2e/smoke.spec.ts` to show vitest collects no e2e specs. Do not run playwright install or npm run e2e
- 2026-11-24 06:27 11. Check the diff: no new comments, no suppressions, only the paths the card lists (e2e/**, playwright.config.ts, package.json, package-lock.json, .gitignore). Then commit on chore/t-0028 with a message ending in the Co-Authored-By line

## Decisions

- 2026-11-24 06:24 risk medium: derived from the touches: medium: dependencies or a lockfile (package.json, package-lock.json)
- 2026-11-24 06:24 routed to testing, security: testing (touches e2e/**; "test" in the description; "e2e" in the title; "playwright" in the title), security ("auth" in the title; "login" in the description)
- 2026-11-24 06:24 under the threshold, for the approver: ui, data, infra
- 2026-11-24 06:24 decided not in: ui (scored only on description keywords)
- 2026-11-24 06:24 decided not in: data (scored only on description keywords)
- 2026-11-24 06:24 decided not in: infra (scored only on description keywords)

## Stop-and-ask

- 2026-11-24 06:25 asked: budget_exhausted: the plan call reached its 4-turn limit before it replied with a plan; allow to plan again with 8 turns, or deny to plan again within 4
- 2026-11-24 06:26 answered: allowed — plan budget 8 turns (standing rule from rivetari-51: allow 8 when the plan is all that's missing; R-21)
- 2026-11-24 06:29 flagged: new_dependency: package.json adds @playwright/test
- 2026-11-24 06:29 asked: protected_path: package.json — changes package.json scripts (the commands the checks run)
