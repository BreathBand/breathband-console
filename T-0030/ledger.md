# T-0030 · Make method-C points and histogram bins exact at band edges

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 06:43 intake: card drafted with 4 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 06:43 intake: intake confirmed; card sha256 5460122b5d144ecb84a98781d96a6cc5172168db5aaab6ae0f08a0a57b4bbc4c (arynbht@gmail.com (--yes))
- 2026-11-24 06:44 route: assembly proposed; sha256 fc050b210f9db32c9d88ed9360b6a39829b6b904ee9d910b866df5b0c702df2d; skills none; proof test-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 06:45 route: route approved; assembly sha256 fc050b210f9db32c9d88ed9360b6a39829b6b904ee9d910b866df5b0c702df2d (arynbht@gmail.com (--yes))
- 2026-11-24 06:45 isolate: worktree .worktrees/T-0030 · branch fix/t-0030 from origin/feature/t-0029 (5dbdae75be42) · port 5175 · db breathband_console_t0030 · env sha256 0b8077b6bf4d422bf5fbc2d2d3bb222338ceebc173a07d0a1db6050527aec981 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:45 build: build started · skills spine only · budget 16 steps / 60k ctx · ~23323 prompt tokens · 8 repo file(s) in context · 261719 tokens · $0.47 · 5 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:47 build: build started · skills spine only · budget 16 steps / 60k ctx · ~23370 prompt tokens · 8 repo file(s) in context · 197146 tokens · $0.49 · 4 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:48 build: build done · commit b78435b31396 · 3 file(s) this round · 698280 tokens · $0.74 · 15 turns · I fixed the off-by-one at band edges: `pacedPoints` and `histogramBin` now give exact results there. Your two example inputs now score correctly: a 3.3% peak gets 9 points and a 5.1% peak gets 3. Lint (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:48 prove: proof deferred · test-run: the judge's tier 1 run on the change is the proof (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:49 prove: proof passed · test-run (the judge's tier 1 run) (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:49 judge: judge passed · round 1 · head b78435b31396 · record sha256 160f5ecf6ca55bc2b571ec7ac43962374976b7bbd15f2762427d69a175233e9f (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 06:49 ship: draft PR opened: #38 https://github.com/BreathBand/breathband-console/pull/38 · fix/t-0030 at b78435b31396 → feature/t-0029 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:51 close: worktree removed · branch fix/t-0030 deleted (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:51 close: floorplan updated · 3 call(s) · 307976 tokens · $0.67 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:51 close: ledger sealed · merged (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 06:47 1. Add one new key to FIXED_CONSTANTS in src/lib/analysis/config.ts: `bandEdgeEpsilon: 1e-9`. Leave every existing key and value as it is.
- 2026-11-24 06:47 2. In src/lib/analysis/paced.ts, add a small helper, for example `function floorAtEdge(q: number): number { return Math.floor(q + FIXED_CONSTANTS.bandEdgeEpsilon); }`. Write no comments.
- 2026-11-24 06:47 3. Change pacedPoints so it computes `raw = points - floorAtEdge((e * PERCENT) / maxDeviationPct)` and keeps the existing min/max clamp from pacedPointRange.
- 2026-11-24 06:47 4. Change histogramBin so it computes `Math.min(last, Math.max(0, floorAtEdge((d - minSd) / stepSd)))`. After this, neither function has a bare Math.floor of a float quotient.
- 2026-11-24 06:47 5. Create src/lib/analysis/paced-edges.test.ts with no comments. It imports scorePaced, histogramBin and histogramBinCount from ./paced, and FIXED_CONSTANTS and OPEN_CONSTANTS from ./config. Its first test asserts FIXED_CONSTANTS.bandEdgeEpsilon is 1e-9 and is not a key in OPEN_CONSTANTS.
- 2026-11-24 06:47 6. In the new test, add a helper that runs scorePaced with one PacedUserTransition at Beginner and returns the scored entry for the target pacer transition. This forms d the same way scorePaced does: delta from t or level, then division by the SD.
- 2026-11-24 06:47 7. Timing at 5-5 (halfCycleS 5, durationS 21, pacer peak at t=10 or trough at t=10): for j = 1..9, user t = 10 + j*0.5 and 10 - j*0.5. Expect timingPoints === 10 - j, a non-null dTime, and missed false.
- 2026-11-24 06:47 8. Timing at 2-2 (halfCycleS 2, durationS 9, pacer peak at t=2 or 6, trough at t=4): for j = 1..9, user t = pacer.t + j*0.2 and pacer.t - j*0.2. Expect timingPoints === 10 - j.
- 2026-11-24 06:47 9. Depth at peaks (5-5, user peak at the pacer time, level 3 + j*0.3) and depth at troughs (user trough at level -3 - j*0.3), for j = 1..9: expect depthPoints === 10 - j.
- 2026-11-24 06:47 10. Add named regression cases: a user peak at 3.3% gives depthPoints 9 with dDepth near 0.1, and a user peak at 5.1% gives depthPoints 3 with dDepth near 0.7.
- 2026-11-24 06:47 11. Histogram edges: for i = 0..8, edge = -1 + i*0.25. Form d from levels, with peak level = 3 + edge*3, then d = (level - 3) / FIXED_CONSTANTS.depthSdPctOfMax. Expect histogramBin(d) === Math.min(i, histogramBinCount() - 1), so +1 lands in bin 7. Also check through scorePaced that histogram.depth counts that entry in the expected bin. Repeat with troughs: level = -3 - edge*3.
- 2026-11-24 06:47 12. Before the fix, confirm the new edge tests fail on the regression cases. After the fix, run `npm run test -- related --run src/lib/analysis/paced.ts src/lib/analysis/config.ts src/lib/analysis/paced-edges.test.ts`. If vitest run rejects the `related` subcommand, fall back to `npm run test -- src/lib/analysis`.
- 2026-11-24 06:47 13. Check that src/lib/analysis/golden/paced-golden.test.ts (Tier A and Tier B), paced.test.ts, paced-config.test.ts, config.test.ts and config-additions.test.ts all pass unchanged. Do not edit any golden or existing test.
- 2026-11-24 06:47 14. Run `npm run lint` and `npm run typecheck`. Make sure there are no new warnings, comments or suppressions, and that the diff touches only paced.ts, config.ts and paced-edges.test.ts.

## Decisions

- 2026-11-24 06:43 risk high: declared high, raised from low (no high or medium signal in the touches)
- 2026-11-24 06:44 routed to testing: testing (touches **/*.test.* (src/lib/analysis/paced-edges.test.ts))

## Stop-and-ask

- 2026-11-24 06:45 asked: budget_exhausted: the plan call reached its 4-turn limit before it replied with a plan; allow to plan again with 8 turns, or deny to plan again within 4
- 2026-11-24 06:46 answered: allowed — plan budget 8 turns (standing rule from rivetari-51: allow 8 when the plan is all that's missing; R-21)

## Proof

- 2026-11-24 06:49 tests passed (npm test, exit 0, in the judge's tier 1 run on the change) · new tests: src/lib/analysis/paced-edges.test.ts: is 1e-9 and stays out of the open group; src/lib/analysis/paced-edges.test.ts: ${c.name}, ${direction > 0 ? "late" : "early"}: j steps of ${c.step} s give 10 - j points; src/lib/analysis/paced-edges.test.ts: peaks at 3 + j x 0.3 % give 10 - j points; src/lib/analysis/paced-edges.test.ts: troughs at -3 - j x 0.3 % give 10 - j points; src/lib/analysis/paced-edges.test.ts: regression: a user peak at 3.3 % scores 9 points; src/lib/analysis/paced-edges.test.ts: regression: a user peak at 5.1 % scores 3 points; src/lib/analysis/paced-edges.test.ts: covers -1 to +1 in 0.25 steps; src/lib/analysis/paced-edges.test.ts: puts each edge in the bin it opens, and +1 in the last bin, for ${type}s
- 2026-11-24 06:49 output: …tests[22m[2m)[22m[32m 2[2mms[22m[39m [32m✓[39m src/lib/analysis/config-additions.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 2[2mms[22m[39m [2m Test Files [22m [1m[32m30 passed[39m[22m[90m (30)[39m [2m Tests [22m [1m[32m381 passed[39m[22m[90m (381)[39m [2m Start at [22m 01:48:44 [2m Duration [22m 579ms[2m (transform 37%, import 33%, tests 24%, worker 6%)[22m
- 2026-11-24 06:49 evidence: the judge's test run on the evidence branch: https://github.com/BreathBand/breathband-console/blob/evidence/T-0030/test-run.txt?raw=true

## Judge

- 2026-11-24 06:49 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 06:49 review round 1: approve; 0 blocking, 0 suggestion(s) (claude-opus-5-5) · 12614 tokens · $0.11
- 2026-11-24 06:49 acceptance A1: met — Both pacedPoints and histogramBin now floor through floorAtEdge(quotient + FIXED_CONSTANTS.bandEdgeEpsilon). bandEdgeEpsilon = 1e-9 is a new FIXED_CONSTANTS key, and a new test asserts it. No bare Mat…
- 2026-11-24 06:49 acceptance A2: met — paced-edges.test.ts goes through scorePaced, using transition times and levels. It covers 5-5 at ±j×0.5 s, 2-2 at ±j×0.2 s, peaks at 3+j×0.3 % and troughs at -3-j×0.3 %, each expecting 10-j points. It…
- 2026-11-24 06:49 acceptance A3: met — Edges -1..+1 in 0.25 steps are built from levels. Each one is checked directly against histogramBin and also through the scorePaced histogram. The expected bin is min(i, last), so +1 lands in the last…
- 2026-11-24 06:49 acceptance A4: unverified — No existing tests or goldens are touched, and config.ts only gains a key. The lint, typecheck and test results were not part of this review, so pass/fail comes from the deterministic check stage.
- 2026-11-24 06:49 judge review posted: https://github.com/BreathBand/breathband-console/pull/38#pullrequestreview-6034856838

## Outcome

- 2026-11-24 06:51 PR #38 merged by arynbht 2026-11-24 06:51 · 9m · 1170k tokens · $1.81
