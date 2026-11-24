# T-0010 · Set up Playwright e2e with coach and athlete sign-in reusing the proof-auth flow

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 00:15 intake: card drafted with 4 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 00:15 intake: intake confirmed; card sha256 1574c86f8e2e72a11c45475af80e0420b770c5b78c36118163ea6f670d4dee7c (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 00:15 route: assembly proposed; sha256 615e91cf72903886fdad2ed3503fadb9d5fb7c56c0e87db8e92f64a55deacb9c; skills none; proof test-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 00:15 route: route approved; assembly sha256 615e91cf72903886fdad2ed3503fadb9d5fb7c56c0e87db8e92f64a55deacb9c (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 00:26 isolate: worktree .worktrees/T-0010 · branch chore/t-0010 from origin/main (7fa76ea1e1d8) · port 5178 · db breathband_console_t0010 · env sha256 684cc4f05b85cee28c8b5a7c64c6ac7a47dc7a396ef76d002c935de0784341c9 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:27 build: build started · skills spine only · budget 12 steps / 60k ctx · ~13084 prompt tokens · 2 repo file(s) in context · 191749 tokens · $0.33 · 5 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:39 build: build started · skills spine only · budget 12 steps / 60k ctx · ~13136 prompt tokens · 2 repo file(s) in context · 194649 tokens · $0.36 · 4 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:41 build: build paused: 1 thing(s) to ask about · commit 7fa76ea1e1d8 · 1034741 tokens · $0.74 · 28 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:43 build: build paused: 1 thing(s) to ask about · commit 7fa76ea1e1d8 · 431289 tokens · $0.42 · 10 turns · retry (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 04:50 build: build paused: 1 thing(s) to ask about · commit 7fa76ea1e1d8 · 508033 tokens · $0.49 · 11 turns · retry (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 00:39 1. Run `npm install --save-dev --save-exact @playwright/test@<latest 1.x>` so package.json gets an exact devDependency and package-lock.json is updated (a person already approved this dependency). Then add `"e2e": "playwright test"` to the package.json scripts. Leave every other script as it is.
- 2026-11-24 00:39 2. Create playwright.config.ts at the repo root with defineConfig from @playwright/test: testDir './e2e', one chromium project, baseURL = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`, fullyParallel false, retries 0, reporter 'list', trace 'retain-on-failure'. Add a webServer block only when BASE_URL is unset: { command: 'npm run dev', url: that baseURL, reuseExistingServer: true, timeout: 180_000, env with PORT }. That way `BASE_URL=http://localhost:8080 npm run e2e` runs the same specs against the container without starting dev. No code comments.
- 2026-11-24 00:39 3. Create e2e/auth.ts, a typed port of .rivetari/proof-auth.mjs (not imported from it). Constants: DB_KEY 'breathband-console:local-db', COACH {name: /Sign in as Lena Vos/, uid: 'demo-coach'}, ATHLETE {name: /Sign in as Alex Morgan/, uid: 'demo-athlete'}. A shared signInAs(page, persona) goes to '/cloud/login/', clicks the demo-account button, then waits up to 3s for localStorage[DB_KEY].currentUid === uid, and repeats the click until a 90s deadline (then throws an Error naming the persona). After that it waits for the URL to leave /cloud/login. Export signInAsCoach(page) and signInAsAthlete(page). No comments.
- 2026-11-24 00:39 4. Create e2e/smoke.spec.ts with two tests. (1) Coach: signInAsCoach, expect the URL to be /cloud/, goto '/cloud/athletes/', expect heading level 1 'Athletes' and region 'Athletes' (roster pane, Roster.tsx:72/80) to be visible. (2) Athlete: signInAsAthlete, expect the URL pathname '/cloud/' and region 'Latest Total Breath Score' (AthleteOverview.tsx:79) to be visible. Use generous expect timeouts so the first dev compile has time to finish.
- 2026-11-24 00:39 5. Add Playwright output to .gitignore under '# testing': /test-results/, /playwright-report/, /blob-report/, /playwright/.cache/.
- 2026-11-24 00:39 6. Check that vitest still ignores e2e/: vitest.config.mts already sets include to ['src/**/*.test.ts'], so no edit is needed. Confirm by running `npm run test -- related --run e2e/smoke.spec.ts e2e/auth.ts` and checking that no e2e spec is collected.
- 2026-11-24 00:39 7. Install the browser with `npm exec -- playwright install chromium`, then run `PORT=5178 npm run e2e` (the worktree's port) and confirm both smoke tests pass against the dev server it starts.
- 2026-11-24 00:39 8. Run `npm run lint` and `npm run typecheck`. tsconfig includes **/*.ts, so e2e/ and playwright.config.ts get typechecked against @playwright/test types. Fix any issues in the new files only, without suppressions, without touching tsconfig/eslint config, and without adding comments.
- 2026-11-24 00:39 9. Review the diff: only e2e/**, playwright.config.ts, package.json, package-lock.json and .gitignore changed. No comments, no suppressions, no .rivetari edits.

## Decisions

- 2026-11-24 00:15 risk medium: derived from the touches: medium: dependencies or a lockfile (package.json, package-lock.json)
- 2026-11-24 00:15 routed to testing, security: testing (touches e2e/**; "test" in the description; "e2e" in the title; "playwright" in the title), security ("auth" in the title; "login" in the description)
- 2026-11-24 00:15 under the threshold, for the approver: ui, infra
- 2026-11-24 00:15 decided not in: ui (scored only on description keywords)
- 2026-11-24 00:15 decided not in: infra (scored only on description keywords)

## Stop-and-ask

- 2026-11-24 00:27 asked: budget_exhausted: the plan call reached its 4-turn limit before it replied with a plan; allow to plan again with 8 turns, or deny to plan again within 4
- 2026-11-24 00:34 answered: allowed — Person approves planning with 8 turns; person also pre-approves @playwright/test as an exact-version devDependency for this card
- 2026-11-24 00:41 asked: agent_question: May I run `npm exec -- playwright install chromium` and then `PORT=5178 npm run e2e` in this worktree to confirm the smoke specs pass (A3)?
- 2026-11-24 00:41 answered: allowed — Person approved @playwright/test for this card; installing its chromium browser and running the e2e specs locally is part of that approval
- 2026-11-24 00:43 asked: agent_question: Can this session be allowed to run `npm exec -- playwright install chromium` and `PORT=5178 npm run e2e` in the T-0010 worktree, or will a person run them and confirm the two smoke tests pass?
- 2026-11-24 04:49 answered: allowed — Owner (present, 2026-11-24): already allowed at 00:41. Run playwright install chromium and PORT=5178 npm run e2e in the worktree.
- 2026-11-24 04:50 asked: agent_question: Both commands are still blocked by the tool permissions here despite the earlier OK. Can you allow `npm exec -- playwright install chromium` and `PORT=5178 npm run e2e` in this session, or run them yourself in the worktree?
