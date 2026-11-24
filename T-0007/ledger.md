# T-0007 · Add the src/lib/analysis skeleton and a config.ts holding every Appendix open constant

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 00:13 intake: card drafted with 4 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 00:14 intake: intake confirmed; card sha256 77168488106ea8c8ac65be129e7dd12d64a00833276dfadea931c669a6a9a3e1 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 00:14 route: assembly proposed; sha256 e3d6d13ff96e92b8bca66a3d41808cb294e4cb844844f1eabe3f945a3b3ed516; skills none; proof test-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 00:14 route: route approved; assembly sha256 e3d6d13ff96e92b8bca66a3d41808cb294e4cb844844f1eabe3f945a3b3ed516 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 00:17 isolate: worktree .worktrees/T-0007 · branch chore/t-0007 from origin/main (7fa76ea1e1d8) · port 5176 · db breathband_console_t0007 · env sha256 e71055a595979fa0768e8f4114a3c4622eb1357735a5c483556b8ee289640b67 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:17 build: build started · fast path (low risk, 1 source file(s)): planned from the card's criteria, no plan call · budget 8 steps / 15k ctx (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:19 build: build done · commit ab0d4b989945 · 3 file(s) this round · 291566 tokens · $0.47 · 8 turns · I added the new `src/lib/analysis/` folder with a config module, an index file and a test file. Its tests pass, `npm run typecheck` and `npm run lint` are clean, and git status shows changes only insi (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:19 prove: proof deferred · test-run: the judge's tier 1 run on the change is the proof (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:20 prove: proof passed · test-run (the judge's tier 1 run) (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:20 judge: judge passed · round 1 · head ab0d4b989945 · record sha256 c86f6fb6578f889d6888480edc698ad0a46b14e533aa089b204bbd6ca08a197d (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 00:21 ship: draft PR opened: #11 https://github.com/BreathBand/breathband-console/pull/11 · chore/t-0007 at ab0d4b989945 → main (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 00:17 1. A1: src/lib/analysis/config.ts exports every Appendix open constant listed in the description with exactly the values given, each with a name that says what it is and a marker (for example an OPEN group or an open: true field) that tells it apart from fixed constants
- 2026-11-24 00:17 2. A2: a new test file src/lib/analysis/config.test.ts asserts each open constant's value (prominence 1, spacing 0.5, k values 1.0/0.75/0.5/0.25, top points 10, peak=inhale/trough=exhale, equal Total weights summing to 1, inhale 1.25-1.67 s, exhale 2.5-3.33 s, depth band 6 +/- 25%) and npm test passes
- 2026-11-24 00:17 3. A3: src/lib/analysis/index.ts exists and re-exports config, so later modules import from one place; npm run lint and npm run typecheck pass
- 2026-11-24 00:17 4. A4: No file outside src/lib/analysis/ changes

## Decisions

- 2026-11-24 00:13 risk low: no high or medium signal in the touches
- 2026-11-24 00:14 routed to no sector: nothing in the card or its paths matched one; the agent works from the spine
- 2026-11-24 00:14 under the threshold, for the approver: motion, infra, observability
- 2026-11-24 00:14 decided not in: motion (scored only on description keywords)
- 2026-11-24 00:14 decided not in: infra (scored only on description keywords)
- 2026-11-24 00:14 decided not in: observability (scored only on description keywords)

## Proof

- 2026-11-24 00:20 tests passed (npm test, exit 0, in the judge's tier 1 run on the change) · new tests: src/lib/analysis/config.test.ts: keeps transitions at least 1% of max in prominence and 0.5 s apart; src/lib/analysis/config.test.ts: uses k = 1.0, 0.75, 0.5 and 0.25 for the skill bands; src/lib/analysis/config.test.ts: gives 10 points for a 0-10% deviation; src/lib/analysis/config.test.ts: treats peaks as inhale and troughs as exhale; src/lib/analysis/config.test.ts: weights the four Total Breath Score parts equally, summing to 1; src/lib/analysis/config.test.ts: sets the normal inhale to 1.25-1.67 s and exhale to 2.5-3.33 s; src/lib/analysis/config.test.ts: sets the normal depth band to 6% +/- 25%; src/lib/analysis/config.test.ts: holds the fixed Appendix values; src/lib/analysis/config.test.ts: never share a name; src/lib/analysis/config.test.ts: tells open constants apart from fixed ones; src/lib/analysis/config.test.ts: groups both under ANALYSIS_CONFIG; src/lib/analysis/config.test.ts: re-exports the config
- 2026-11-24 00:20 output: …[2m17 tests[22m[2m)[22m[32m 21[2mms[22m[39m [32m✓[39m src/lib/backend/local/local.test.ts [2m([22m[2m27 tests[22m[2m)[22m[32m 83[2mms[22m[39m [2m Test Files [22m [1m[32m5 passed[39m[22m[90m (5)[39m [2m Tests [22m [1m[32m64 passed[39m[22m[90m (64)[39m [2m Start at [22m 19:20:26 [2m Duration [22m 511ms[2m (transform 56%, tests 21%, import 19%, worker 4%)[22m
- 2026-11-24 00:20 evidence: the judge's test run on the evidence branch: https://github.com/BreathBand/breathband-console/blob/evidence/T-0007/test-run.txt?raw=true

## Judge

- 2026-11-24 00:20 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 00:20 review round 1: approve; 0 blocking, 1 suggestion(s) (claude-sonnet-5-5) · 11306 tokens · $0.05
- 2026-11-24 00:20 acceptance A1: met — Every listed open value is exported in OPEN_CONSTANTS with the exact value given, and fixed values are in a separate FIXED_CONSTANTS group.
- 2026-11-24 00:20 acceptance A2: met — config.test.ts asserts each open value. The test files add no suppressions. Whether npm test passes is left to the deterministic run.
- 2026-11-24 00:20 acceptance A3: unverified — index.ts re-exports config, which is verified. Lint and typecheck results aren't visible in the diff, so they depend on the deterministic checks.
- 2026-11-24 00:20 acceptance A4: met — All three new files are under src/lib/analysis/.
- 2026-11-24 00:21 judge review posted: https://github.com/BreathBand/breathband-console/pull/11#pullrequestreview-6031685550
