# T-0012 · Synthetic breathing-signal generator with fault profiles

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 04:58 intake: card drafted with 6 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 04:58 intake: intake confirmed; card sha256 5f114a9ce00aab3d095e3d2c99029e0bdcad46a91f51e71b11099dd8aeb162ad (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 04:58 route: assembly proposed; sha256 df3f311f1ea9b8767f91afa65100c62c92220633cda3d759a4dbda054ad9d910; skills none; proof test-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 04:58 route: route approved; assembly sha256 df3f311f1ea9b8767f91afa65100c62c92220633cda3d759a4dbda054ad9d910 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:01 isolate: worktree .worktrees/T-0012 · branch feature/t-0012 from origin/main (c7f8fd24c171) · port 5175 · db breathband_console_t0012 · env sha256 e3b261e6cc5110287b46607fddd96b0b8bad9b7845944eb050dfd33c975abe65 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:01 build: build started · skills spine only · budget 8 steps / 15k ctx · ~14219 prompt tokens · 2 repo file(s) in context · 197283 tokens · $0.48 · 7 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:07 build: build done · commit 1768961bc7d9 · 3 file(s) this round · 727426 tokens · $1.44 · 12 turns · I added the synthetic breathing-signal generator in `src/lib/analysis/synth.ts`. Its 31 new tests pass, and so does the existing `config.test.ts` (43 tests across the two files). `npm run lint` and `n (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:07 prove: proof deferred · test-run: the judge's tier 1 run on the change is the proof (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:07 prove: proof passed · test-run (the judge's tier 1 run) (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:09 judge: judge passed · round 1 · head 1768961bc7d9 · record sha256 97af3cc46f80efde97c018c5d640f80ad15111b043c2b30752372606f65c9993 (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 05:09 ship: draft PR opened: #23 https://github.com/BreathBand/breathband-console/pull/23 · feature/t-0012 at 1768961bc7d9 → main (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 05:01 1. In src/lib/analysis/synth.ts, add the core types: a BreathPattern (inhaleS, exhaleS, peakPct, troughPct, shiftS), SynthOptions (durationS, sampleRateHz, optional noise) and a result of {t, user, pacer?}. Sample i is at t = i / sampleRateHz and there are round(durationS × sampleRateHz) samples. Implement a pure piecewise-cosine evaluator that matches the group pacer in src/lib/domain/group.ts: it starts at a trough at t = 0, rises first over inhaleS from trough to peak, then falls over exhaleS, using −cos within each half. Apply shiftS as a time offset (a negative shift means early). Write no comments and use no browser or Node APIs.
- 2026-11-24 05:01 2. In synth.ts, implement generateSignal(pattern, options) and generatePiecewise(segments: {fromS, pattern}[], options), which picks the pattern in force at each t so a session can change pattern at a marker. Build the pacer from FIXED_CONSTANTS.pacersS half cycles with an amplitude of FIXED_CONSTANTS.referenceDepthPeakToTroughPctOfMax / 2 (±3%), so the on-time pattern equals the pacer exactly. Add toRaw(pctSignal, {a100, midline}) using raw = midline + pct / 100 × a100.
- 2026-11-24 05:01 3. In synth.ts, implement a mulberry32-style seeded PRNG and a Box–Muller Gaussian sampler, written fresh and not imported from src/lib/backend. Add three optional noise kinds: per-sample Gaussian noise (sampleSdPct), per-transition amplitude jitter on each peak and trough level (amplitudeSdPct), and per-transition timing jitter on each transition time (timingSdS). Draw each from its own seeded stream so that an SD of 0 returns the clean signal exactly.
- 2026-11-24 05:01 4. In synth.ts, export the PACED_GOLDEN profiles for the 5-5 pacer over 180 s: onTime; early, with shift = −timingSdBreathFraction × 0.35 × 10 s, which gives −1.75 s with the first peak at 3.25 s (this reads the card's '0.35 timing SD' as 0.35 × timingSdBreathFraction × cycle; check that reading against Appendix and the card wording while building); halfDepth ±1.5; deep ±5.4 (1.8 × 3); offset +4.5/−1.5; and a 9 s cycle (4.5/4.5). Derive every number from FIXED_CONSTANTS.
- 2026-11-24 05:01 5. In synth.ts, export DEMO_FAULTS for paced and open sessions. Open sessions use a normal pattern taken from OPEN_CONSTANTS normal durations and depth. The faults are early, shallow, tooDeep and tooFast. Add a lostThenRecovered builder that takes a normal pattern and a lost span [fromS, toS] and makes that span flat at 0, with seeded single-sample spikes of magnitude above FIXED_CONSTANTS.artifactLimitPctOfMax and alternating sign. The samples outside the span match the normal pattern.
- 2026-11-24 05:01 6. In synth.ts, export generateCalibration({a100, midline, breaths, sampleRateHz}). It writes maximal breaths in raw units with chosen distinct peak and trough levels, and returns the samples plus expectedA100 (mean of the 3 highest peaks − mean of the 3 lowest troughs) and expectedMidline, computed from the chosen levels. Add `export * from "./synth";` to src/lib/analysis/index.ts.
- 2026-11-24 05:01 7. Write the new test file src/lib/analysis/synth.test.ts (vitest). Cover the output length; the 1.5/3.0 pattern hitting ±3 within 1e-9; the raw mapping; piecewise switching; the on-time profile equal to the pacer within 1e-9; the early profile's first peak at 3.25 s; each depth profile's max and min; 9 s peak spacing; the lost span being flat except for spikes, every spike beyond ±100, and the signal matching before and after the span; same seed gives the same arrays and a different seed gives different ones; SD 0 gives the clean signal exactly; the measured noise SD over 180 s at 20 Hz is within 10%; and the calibration extremes against the expected A100 and midline.
- 2026-11-24 05:01 8. Run `npm run test -- related --run src/lib/analysis/synth.ts src/lib/analysis/synth.test.ts src/lib/analysis/index.ts`, `npm run lint` and `npm run typecheck`. Fix any failures without adding comments or suppressions, and check that the diff touches only the three files named in the card.

## Decisions

- 2026-11-24 04:58 risk low: no high or medium signal in the touches
- 2026-11-24 04:58 routed to testing: testing (touches **/*.test.* (src/lib/analysis/synth.test.ts))
- 2026-11-24 04:58 under the threshold, for the approver: motion, data, infra, docs, observability
- 2026-11-24 04:58 decided not in: motion (scored only on description keywords)
- 2026-11-24 04:58 decided not in: data (scored only on description keywords)
- 2026-11-24 04:58 decided not in: infra (scored only on description keywords)
- 2026-11-24 04:58 decided not in: docs (scored only on description keywords)
- 2026-11-24 04:58 decided not in: observability (scored only on description keywords)

## Proof

- 2026-11-24 05:07 tests passed (npm test, exit 0, in the judge's tier 1 run on the change) · new tests: src/lib/analysis/synth.test.ts: writes durationS × sampleRateHz samples at i / sampleRateHz; src/lib/analysis/synth.test.ts: peaks at +3 and troughs at -3 for a 1.5 s inhale / 3.0 s exhale; src/lib/analysis/synth.test.ts: starts the pacer at a trough at t = 0 and rises first, ±3% of max; src/lib/analysis/synth.test.ts: maps % of max to raw units as midline + pct / 100 × a100; src/lib/analysis/synth.test.ts: switches pattern at a marker; src/lib/analysis/synth.test.ts: returns a pacer only when every segment is paced; src/lib/analysis/synth.test.ts: rejects an empty segment list and bad rates; src/lib/analysis/synth.test.ts: runs every profile for 180 s against the 5-5 pacer; src/lib/analysis/synth.test.ts: onTime equals the pacer sample by sample; src/lib/analysis/synth.test.ts: early is 0.35 timing SD (1.75 s) early, first peak at 3.25 s; src/lib/analysis/synth.test.ts: shortCycle peaks 9 s apart against the 10 s pacer; src/lib/analysis/synth.test.ts: has early, shallow, too deep, too fast and lost-then-recovered for paced and open sessions; src/lib/analysis/synth.test.ts: makes each fault differ from its normal pattern in the named way; src/lib/analysis/synth.test.ts: gives identical arrays for the same seed and different arrays for another; src/lib/analysis/synth.test.ts: gives the clean signal exactly when every SD is 0; src/lib/analysis/synth.test.ts: jitters transition levels and times by about their SDs; src/lib/analysis/synth.test.ts: uses a PRNG in [0, 1) that repeats for a seed; src/lib/analysis/synth.test.ts: knows A100 and the midline from the recording's highest peaks and lowest troughs; src/lib/analysis/synth.test.ts: rejects fewer than three breaths; src/lib/analysis/synth.test.ts: re-exports synth
- 2026-11-24 05:07 output: …2m[2m15 tests[22m[2m)[22m[32m 113[2mms[22m[39m [32m✓[39m src/lib/analysis/synth.test.ts [2m([22m[2m31 tests[22m[2m)[22m[32m 60[2mms[22m[39m [2m Test Files [22m [1m[32m7 passed[39m[22m[90m (7)[39m [2m Tests [22m [1m[32m110 passed[39m[22m[90m (110)[39m [2m Start at [22m 00:07:14 [2m Duration [22m 318ms[2m (tests 42%, transform 29%, import 25%, worker 5%)[22m
- 2026-11-24 05:07 evidence: the judge's test run on the evidence branch: https://github.com/BreathBand/breathband-console/blob/evidence/T-0012/test-run.txt?raw=true

## Judge

- 2026-11-24 05:07 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 05:09 review round 1: approve; 0 blocking, 5 suggestion(s) (claude-opus-5-5) · 44782 tokens · $0.46
- 2026-11-24 05:09 acceptance A1: met — generateSignal/generatePiecewise, pacer output, rawValue/toRaw; tests cover length, the 1.5/3.0 ±3 pattern and the raw mapping.
- 2026-11-24 05:09 acceptance A2: met — PACED_GOLDEN has all six profiles; the early shift is derived from timingSdBreathFraction; tests assert each defining property.
- 2026-11-24 05:09 acceptance A3: met — Paced and open faults present. The lost-span test checks flatness, single-sample spikes and an exact match outside the span. The ±100% check relies on artifactLimitPctOfMax ≥ 100.
- 2026-11-24 05:09 acceptance A4: met — mulberry32 lives in analysis; three seeded noise kinds; same and different seed, zero SD, and per-sample SD within 10% are all tested.
- 2026-11-24 05:09 acceptance A5: met — Test passes for the default timings at 20 Hz. See the defect: expected values are not exact for off-grid knot times.
- 2026-11-24 05:09 acceptance A6: unverified — Constants come from config.ts and index.ts re-exports synth. No lint, typecheck or test run output was provided with the diff.
- 2026-11-24 05:09 judge review posted: https://github.com/BreathBand/breathband-console/pull/23#pullrequestreview-6034022531
