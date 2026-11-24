# T-0020 · Total Breath Score: mean of the four, rounded once

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 05:05 intake: card drafted with 5 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 05:05 intake: intake confirmed; card sha256 f07b3df1de96ae38c6de864adb4955fcafa8623b78d2a011a9ccefd74071f05e (arynbht@gmail.com (--yes))
- 2026-11-24 05:06 route: assembly proposed; sha256 f37f05b6eb2b3e8d6e39fa7c939ef1c29b0e9dedf27f60f08b154feec9c9504b; skills none; proof test-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 05:06 route: route approved; assembly sha256 f37f05b6eb2b3e8d6e39fa7c939ef1c29b0e9dedf27f60f08b154feec9c9504b (arynbht@gmail.com (--yes))
- 2026-11-24 05:25 isolate: worktree .worktrees/T-0020 · branch fix/t-0020 from origin/main (44e6ffb292b5) · port 5179 · db breathband_console_t0020 · env sha256 12a8d0919ea491aca63b7d25e861d704221fb69e5e55c78ed2bd0333203f66f8 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:25 build: build started · skills spine only · budget 16 steps / 60k ctx · ~16544 prompt tokens · 2 repo file(s) in context · 214552 tokens · $0.39 · 7 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:26 build: build done · commit 61a0aeeefd01 · 2 file(s) this round · 431590 tokens · $0.49 · 13 turns · I changed the Total Breath Score so it rounds once instead of twice. The new tests, the existing domain and local-backend tests, typecheck and lint all pass. I didn't run the full suite. (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:26 prove: proof deferred · test-run: the judge's tier 1 run on the change is the proof (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:26 prove: proof passed · test-run (the judge's tier 1 run) (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:27 judge: judge passed · round 1 · head 61a0aeeefd01 · record sha256 ed9754704602b017b8452814772c56099f34d7e589635dd4523255c6578c0881 (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 05:27 ship: draft PR opened: #27 https://github.com/BreathBand/breathband-console/pull/27 · fix/t-0020 at 61a0aeeefd01 → main (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:37 close: worktree removed · branch fix/t-0020 deleted (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:37 close: floorplan updated · 1 call(s) · 28073 tokens · $0.08 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:37 close: ledger sealed · merged (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 05:25 1. In src/lib/domain/scores.ts, add `import { OPEN_CONSTANTS } from "../analysis/config";` below the existing types import. config.ts imports nothing, so this can't create a cycle.
- 2026-11-24 05:25 2. Delete the private helper at scores.ts:60 (`const mean = (a: number, b: number) => Math.round(((a + b) / 2) * 10) / 10;`).
- 2026-11-24 05:25 3. Delete the JSDoc line at scores.ts:62 (`/** The combining rule the app uses (approved 16 Nov): ... */`) and add no replacement comment.
- 2026-11-24 05:25 4. Keep the signature `combineTransitionScores(timing: TransitionScores["timing"], depth: TransitionScores["depth"]): number` and replace its body with one unrounded weighted sum, rounded once: `const w = OPEN_CONSTANTS.totalBreathScoreWeights; return Math.round((w.timingIn * timing.inhale + w.timingEx * timing.exhale + w.depthIn * depth.inhale + w.depthEx * depth.exhale) * 10) / 10;`
- 2026-11-24 05:25 5. Check with `git diff src/lib/domain/scores.ts` that the only changes are the new import line, the removed mean helper, the removed JSDoc line and the new function body. isTransitionScores, isLegacyScores, scoreWord, formatScore, legacyBand, headline, WORDS and the types must be byte-identical, and there must be no new `//` or `/**` lines.
- 2026-11-24 05:25 6. Create src/lib/domain/total-score.test.ts with no comments. Import `describe, expect, it` from "vitest", `combineTransitionScores` from "./scores" and `OPEN_CONSTANTS` from "../analysis/config".
- 2026-11-24 05:25 7. A2 test: expect combineTransitionScores({inhale: 7.06, exhale: 7.06}, {inhale: 8, exhale: 8}) toBe 7.5, ({7.3, 7.4}, {8.2, 8.3}) toBe 7.8, and ({6.25, 6.25}, {8, 8}) toBe 7.1.
- 2026-11-24 05:25 8. A3 test: expect ({inhale: 8, exhale: 7}, {inhale: 7, exhale: 7}) toBe 7.3 and ({8, 8}, {8, 7}) toBe 7.8, which match the old two-step rule for whole-number inputs.
- 2026-11-24 05:25 9. A3 weights test: sum Object.values(OPEN_CONSTANTS.totalBreathScoreWeights) and assert toBeCloseTo(1, 10), so the weights in config add up to 1.
- 2026-11-24 05:25 10. Leave domain.test.ts, local.test.ts and every other existing test untouched. Don't touch src/lib/domain/types.ts, src/app/(site)/_lib/scores.ts or SCORING_VERSIONS (all out of scope).
- 2026-11-24 05:25 11. Run the related tests only: `npm run test -- related --run src/lib/domain/scores.ts src/lib/domain/total-score.test.ts`. Confirm total-score.test.ts, domain.test.ts (including lines 26-29, which expect 7.5 and 5.5) and local.test.ts pass.
- 2026-11-24 05:25 12. Run `npm run typecheck` and `npm run lint` and confirm both are clean with no new warnings, with no suppressions, no skipped tests and no new comments in the diff.

## Decisions

- 2026-11-24 05:05 risk high: declared high, raised from low (no high or medium signal in the touches)
- 2026-11-24 05:06 routed to testing, data, legal: testing (touches **/*.test.* (src/lib/domain/total-score.test.ts); "test" in the description), data ("db" in the description; "seed" in the description), legal (the profile handles PII and the task touches data)
- 2026-11-24 05:06 under the threshold, for the approver: infra
- 2026-11-24 05:06 decided not in: infra (scored only on description keywords)
- 2026-11-24 05:06 data: no vendored skill covers it; the agent works from the spine
- 2026-11-24 05:06 legal: no vendored skill covers it; the agent works from the spine

## Proof

- 2026-11-24 05:26 tests passed (npm test, exit 0, in the judge's tier 1 run on the change) · new tests: src/lib/domain/total-score.test.ts: rounds the weighted mean of the four sub-scores once; src/lib/domain/total-score.test.ts: gives the same result as before for whole-number sub-scores; src/lib/domain/total-score.test.ts: uses weights from config that add up to 1
- 2026-11-24 05:26 output: …[2m15 tests[22m[2m)[22m[32m 106[2mms[22m[39m [32m✓[39m src/lib/backend/local/local.test.ts [2m([22m[2m27 tests[22m[2m)[22m[32m 73[2mms[22m[39m [2m Test Files [22m [1m[32m8 passed[39m[22m[90m (8)[39m [2m Tests [22m [1m[32m96 passed[39m[22m[90m (96)[39m [2m Start at [22m 00:26:27 [2m Duration [22m 288ms[2m (tests 37%, import 30%, transform 28%, worker 5%)[22m
- 2026-11-24 05:26 evidence: the judge's test run on the evidence branch: https://github.com/BreathBand/breathband-console/blob/evidence/T-0020/test-run.txt?raw=true

## Judge

- 2026-11-24 05:26 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 05:27 review round 1: approve; 0 blocking, 0 suggestion(s) (claude-opus-5-5) · 10822 tokens · $0.10
- 2026-11-24 05:27 acceptance A1: met — Signature unchanged; weighted sum uses OPEN_CONSTANTS.totalBreathScoreWeights (keys timingIn/timingEx/depthIn/depthEx match config.ts:18-23), imported from ../analysis/config, rounded once with Math.r…
- 2026-11-24 05:27 acceptance A2: met — New total-score.test.ts asserts 7.5, 7.8 and 7.1 for the three cases. Hand-checked in IEEE doubles: 7.53→7.5, 7.8→7.8, 7.125→7.1.
- 2026-11-24 05:27 acceptance A3: met — Asserts 7.3 (7.25, exact in binary) and 7.8 (7.75, exact), and checks that the config weights sum to 1 with toBeCloseTo(1, 10).
- 2026-11-24 05:27 acceptance A4: met — The mean helper and the stale JSDoc are removed. Only an import line and the function body are added, with no comments, and no other hunks touch scores.ts.
- 2026-11-24 05:27 acceptance A5: unverified — No existing test files are touched. domain.test.ts:26-29 uses whole numbers, which give the same result under both rules. Lint, typecheck and test were not run in this review; the deterministic check …
- 2026-11-24 05:27 judge review posted: https://github.com/BreathBand/breathband-console/pull/27#pullrequestreview-6034154388

## Outcome

- 2026-11-24 05:37 PR #27 merged by arynbht 2026-11-24 05:36 · 33m · 657k tokens · $0.98
