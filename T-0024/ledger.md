# T-0024 · Make generateCalibration's expected values exact or refuse off-grid knot times

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 05:52 intake: card drafted with 3 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 05:52 intake: intake confirmed; card sha256 f1f97f728d2ff1f2941f9549f271fd0dccd60ef911d6b83268ea9aabde9e9e21 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:52 route: assembly proposed; sha256 281f457e8f5a3770014d0e45ba069276baba8bb3ff4eaa02bcd4a44c31be472f; skills none; proof test-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 05:52 route: route approved; assembly sha256 281f457e8f5a3770014d0e45ba069276baba8bb3ff4eaa02bcd4a44c31be472f (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:52 isolate: worktree .worktrees/T-0024 · branch fix/t-0024 from origin/feature/t-0012 (1768961bc7d9) · port 5177 · db breathband_console_t0024 · env sha256 3e3ea862fec890bff82634c52dd9907a796a6cf7c0444a49bb6ab8c3cad0e9fb (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:52 build: build started · fast path (low risk, 2 source file(s)): planned from the card's criteria, no plan call · budget 8 steps / 15k ctx (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:53 build: build done · commit c082fae4c7ce · 2 file(s) this round · 382344 tokens · $0.57 · 7 turns · `generateCalibration` now refuses knot times that don't land on a sample, and the new tests pass. All 48 tests in `src/lib/analysis/` pass, including the existing `synth.test.ts`, which I didn't chang (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:53 prove: proof deferred · test-run: the judge's tier 1 run on the change is the proof (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:54 prove: proof passed · test-run (the judge's tier 1 run) (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:54 judge: judge passed · round 1 · head c082fae4c7ce · record sha256 97244d901384c746b1bb769684437e42831d156ffc8d2bbe79574036bff7e34e (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 05:54 ship: draft PR opened: #33 https://github.com/BreathBand/breathband-console/pull/33 · fix/t-0024 at c082fae4c7ce → feature/t-0012 (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 05:52 1. A1: generateCalibration throws a RangeError, whose message names the sample rate and the first offending knot time, when any knot time × sampleRateHz differs from a whole number by more than 1e-9. With sampleRateHz 12.5 and the default timings it throws, and a new test asserts that
- 2026-11-24 05:52 2. A2: A new test at the default 20 Hz checks that the highest 3 raw samples' mean minus the lowest 3 raw samples' mean equals expectedA100, and that their midpoint equals expectedMidline, to within 1e-9. The extremes are taken from the rendered raw samples, not from the knots
- 2026-11-24 05:52 3. A3: Every existing synth.test.ts test still passes unchanged; the new tests go in a new file src/lib/analysis/synth-calibration.test.ts. npm run lint, npm run typecheck and npm test pass

## Decisions

- 2026-11-24 05:52 risk low: no high or medium signal in the touches
- 2026-11-24 05:52 routed to testing: testing (touches **/*.test.* (src/lib/analysis/synth-calibration.test.ts))

## Proof

- 2026-11-24 05:54 tests passed (npm test, exit 0, in the judge's tier 1 run on the change) · new tests: src/lib/analysis/synth-calibration.test.ts: throws a RangeError naming the rate and the first off-grid knot at 12.5 Hz with the default timings; src/lib/analysis/synth-calibration.test.ts: names the first off-grid knot when only a later knot misses the grid; src/lib/analysis/synth-calibration.test.ts: accepts timings that land on the grid at a non-integer rate; src/lib/analysis/synth-calibration.test.ts: rejects a non-positive sample rate; src/lib/analysis/synth-calibration.test.ts: matches expectedA100 and expectedMidline from the rendered raw samples at 20 Hz
- 2026-11-24 05:54 output: …2m31 tests[22m[2m)[22m[32m 61[2mms[22m[39m [32m✓[39m src/lib/backend/local/local.test.ts [2m([22m[2m27 tests[22m[2m)[22m[32m 76[2mms[22m[39m [2m Test Files [22m [1m[32m8 passed[39m[22m[90m (8)[39m [2m Tests [22m [1m[32m115 passed[39m[22m[90m (115)[39m [2m Start at [22m 00:53:52 [2m Duration [22m 268ms[2m (tests 46%, transform 28%, import 21%, worker 5%)[22m
- 2026-11-24 05:54 evidence: the judge's test run on the evidence branch: https://github.com/BreathBand/breathband-console/blob/evidence/T-0024/test-run.txt?raw=true

## Judge

- 2026-11-24 05:54 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 05:54 review round 1: approve; 0 blocking, 2 suggestion(s) (claude-sonnet-5-5) · 12119 tokens · $0.06
- 2026-11-24 05:54 acceptance A1: met — A RangeError names the sample rate and the first off-grid knot, found in time order. A new test covers 12.5 Hz with the default timings.
- 2026-11-24 05:54 acceptance A2: met — The new test derives the extremes from rec.raw and compares them to expectedA100 and expectedMidline within 1e-9. It uses local maxima rather than the literal highest 3 samples.
- 2026-11-24 05:54 acceptance A3: unverified — The diff leaves existing tests alone, and the new tests are in a new file. The diff does not show lint, typecheck or test results. It also does not show whether any existing synth.test.ts test calls g…
- 2026-11-24 05:54 judge review posted: https://github.com/BreathBand/breathband-console/pull/33#pullrequestreview-6034366459
