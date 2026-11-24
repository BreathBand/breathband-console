# T-0019 · Additive contract fields: units, calibration, skill, method-C details, 2-marker cap

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 05:04 intake: card drafted with 5 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 05:05 intake: intake confirmed; card sha256 ffd916c38073fc552add7f13b766ea81ca613dcff79409a9ee414f5780f31c1e (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:05 route: assembly proposed; sha256 37456f7a76fa9f039013d6cbdda89a3979c3935207b70faa69c9ca7d7e0f86bc; skills none; proof migration-dry-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 05:05 route: route approved; assembly sha256 37456f7a76fa9f039013d6cbdda89a3979c3935207b70faa69c9ca7d7e0f86bc (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:24 isolate: worktree .worktrees/T-0019 · branch feature/t-0019 from origin/main (44e6ffb292b5) · port 5174 · db breathband_console_t0019 · env sha256 c6762c58bad1bad62da58ebe1e13515bcde4f277cb79c1aff678b04cd8306e2d (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:25 build: build started · skills spine only · budget 12 steps / 60k ctx · ~29044 prompt tokens · 5 repo file(s) in context · 290579 tokens · $0.53 · 5 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:29 build: build started · skills spine only · budget 12 steps / 60k ctx · ~29106 prompt tokens · 5 repo file(s) in context · 220583 tokens · $0.55 · 5 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:31 build: build done · commit e837425c68b3 · 4 file(s) this round · 1263630 tokens · $1.08 · 25 turns · I've added the nine contract fields, the write check, and its tests. The related tests (72 across 5 files, including the existing `local.test.ts` and `domain.test.ts`), typecheck and lint all pass. I (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:32 prove: proof passed · migration-dry-run (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:32 judge: judge passed · round 1 · head e837425c68b3 · record sha256 a7e2a0665cb1be129464c3c4726b0cb64df5220e0128d082037f45d087fb32fa (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 05:32 ship: draft PR opened: #29 https://github.com/BreathBand/breathband-console/pull/29 · feature/t-0019 at e837425c68b3 → main (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:38 close: worktree removed · branch feature/t-0019 deleted (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:38 close: floorplan updated · 1 call(s) · 28034 tokens · $0.08 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:38 close: ledger sealed · merged (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 05:29 1. Edit src/lib/domain/types.ts and add only lines, with no comments. Add `import type { SkillLevel } from "@/lib/analysis/config";` at the top. Add `export type WaveformUnits = "raw" | "pct-max";`. Add `methodC: "method-c-v1"` to SCORING_VERSIONS after `transition`. Add `skillLevel?: SkillLevel;` and `paced?: PacedDetails | null;` to SessionSummary after `groupSessionId`. Add `units?: WaveformUnits;` to Waveform. On the calibration line, change only the type to `{ min: number; max: number; a100?: number; midline?: number; peaks?: number[]; troughs?: number[] }`. Add the exported interfaces NullableInhaleExhale, DeviationHistogram ({ timing: number[]; depth: number[]; missedOrDouble: number }) and PacedDetails ({ onTargetPct: { timing: number; depth: number }; direction: { timing: NullableInhaleExhale; depth: NullableInhaleExhale }; histogram: DeviationHistogram; missed: number; double: number; transitions: number }) next to TransitionScores. Rename, retype and remove nothing, and don't touch existing comments.
- 2026-11-24 05:29 2. Create src/lib/backend/local/validate.ts with no comments. Import BackendError from "../types", FIXED_CONSTANTS and OPEN_CONSTANTS from "@/lib/analysis/config", and the SessionSummary and Waveform types. Compute the histogram bin count from FIXED_CONSTANTS.deviationHistogram as Math.round((maxSd - minSd) / stepSd), which gives 8. Export checkSessionContract(summary, waveform). It throws new BackendError("invalid-input", <message naming the field>) in four cases: summary.mode === "open" and waveform.markers.length > FIXED_CONSTANTS.maxEventMarkersPerOpenSession ("markers"); calibration.peaks or calibration.troughs is defined with a length other than 3 ("calibration.peaks" / "calibration.troughs"); summary.paced?.histogram.timing or .depth has a length other than the bin count ("paced.histogram.timing" / "paced.histogram.depth"); summary.skillLevel is defined and not Object.hasOwn(OPEN_CONSTANTS.skillBandK, it) ("skillLevel"). Paced sessions are not marker-capped.
- 2026-11-24 05:29 3. Edit src/lib/backend/local/index.ts with no comments. Import checkSessionContract from "./validate". In endGroupSession, after the loop that builds `recorded` and before `return changeGroup(...)`, add `for (const { summary, waveform } of recorded) checkSessionContract(summary, waveform);` so every summary and waveform is checked before it is written. Change nothing else, and leave DB_VERSION and db.ts untouched.
- 2026-11-24 05:29 4. Create the new test file src/lib/backend/local/contract.test.ts (vitest, no comments). Build minimal open and paced SessionSummary and Waveform fixtures. Cover these cases: an open waveform with 2 markers passes; one with 3 markers throws a BackendError with code 'invalid-input' and a message containing 'markers'; a paced waveform with 3 markers passes; calibration.peaks of length 2 is rejected; a 7-bin paced.histogram.timing is rejected; a skillLevel cast to an unknown string is rejected; every session in createSeededDb().sessions passes when paired with generateWaveform(session).
- 2026-11-24 05:29 5. In contract.test.ts, add the A4 round-trip test. Build a db from createSeededDb() and add one open and one paced session for DEMO_ATHLETE to db.sessions, each with units 'pct-max', calibration a100, midline, 3 peaks and 3 troughs, skillLevel 'advanced', scoringVersion SCORING_VERSIONS.methodC and full paced details. Put their waveforms in db.recordedWaveforms under their waveformPath. Wrap the db in memoryStore and createLocalBackend({ store, latencyMs: 0 }), then sign in as DEMO_ATHLETE. Assert that getSession and getWaveform each return toEqual the stored objects. Also assert that a seeded legacy-v1 session from getSession, and its getWaveform, have none of the keys skillLevel, paced, units, or calibration a100, midline, peaks or troughs.
- 2026-11-24 05:29 6. Run `npm run test -- related --run src/lib/backend/local/contract.test.ts src/lib/backend/local/index.ts src/lib/backend/local/validate.ts src/lib/domain/types.ts` and fix any failures in the new files only. Leave local.test.ts, domain.test.ts and other existing tests unchanged.
- 2026-11-24 05:29 7. Run `npm run typecheck` and `npm run lint` and fix any errors or new warnings in the touched files. Add no suppressions or comments.
- 2026-11-24 05:29 8. Check the result with `git diff main -- src/lib/domain/types.ts`. Only added lines are allowed, plus the one widened calibration line. Also confirm that firebase/firestore.rules, firebase/storage.rules, db.ts (DB_VERSION) and seed.ts are untouched, so the migration-dry-run proof shows no stored-data rewrite and no migration.

## Decisions

- 2026-11-24 05:04 risk medium: declared medium, raised from low (no high or medium signal in the touches)
- 2026-11-24 05:05 routed to data, testing, legal: data ("db" in the description; "migration" in the description), testing (touches **/*.test.* (src/lib/backend/local/contract.test.ts)), legal (the profile handles PII and the task touches data)
- 2026-11-24 05:05 under the threshold, for the approver: motion, infra
- 2026-11-24 05:05 decided not in: motion (scored only on description keywords)
- 2026-11-24 05:05 decided not in: infra (scored only on description keywords)
- 2026-11-24 05:05 data: no vendored skill covers it; the agent works from the spine
- 2026-11-24 05:05 legal: no vendored skill covers it; the agent works from the spine

## Stop-and-ask

- 2026-11-24 05:25 asked: budget_exhausted: the plan call reached its 4-turn limit before it replied with a plan; allow to plan again with 8 turns, or deny to plan again within 4
- 2026-11-24 05:29 answered: allowed — plan budget 8 turns; the 4-turn plan limit is too tight for non-trivial cards here (R-21). Decided by rivetari-51, the pilot's merge and stop decider for the owner

## Proof

- 2026-11-24 05:32 migration-dry-run has no proof runner yet; the test run stands in, and a person attaches the migration-dry-run proof
- 2026-11-24 05:32 tests passed (npm run test, exit 0) · new tests: src/lib/backend/local/contract.test.ts: accepts an open waveform with 2 markers; src/lib/backend/local/contract.test.ts: rejects an open waveform with 3 markers; src/lib/backend/local/contract.test.ts: accepts a paced waveform with 3 markers; src/lib/backend/local/contract.test.ts: rejects a calibration with 2 peaks; src/lib/backend/local/contract.test.ts: rejects a calibration with 4 troughs; src/lib/backend/local/contract.test.ts: rejects a 7-bin histogram; src/lib/backend/local/contract.test.ts: rejects an unknown skill level; src/lib/backend/local/contract.test.ts: accepts every seeded session with its generated waveform; src/lib/backend/local/contract.test.ts: stores sessions that pass the contract check; src/lib/backend/local/contract.test.ts: reads open and paced sessions with every new field back unchanged; src/lib/backend/local/contract.test.ts: reads a seeded legacy session with none of the new keys
- 2026-11-24 05:32 output: …2m11 tests[22m[2m)[22m[32m 52[2mms[22m[39m [32m✓[39m src/lib/backend/local/local.test.ts [2m([22m[2m27 tests[22m[2m)[22m[32m 76[2mms[22m[39m [2m Test Files [22m [1m[32m8 passed[39m[22m[90m (8)[39m [2m Tests [22m [1m[32m104 passed[39m[22m[90m (104)[39m [2m Start at [22m 00:32:01 [2m Duration [22m 421ms[2m (transform 39%, import 38%, tests 20%, worker 3%)[22m
- 2026-11-24 05:32 evidence: the test run on the evidence branch: https://github.com/BreathBand/breathband-console/blob/evidence/T-0019/test-run.txt?raw=true

## Judge

- 2026-11-24 05:32 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 05:32 review round 1: approve; 0 blocking, 3 suggestion(s) (claude-opus-5-5) · 18047 tokens · $0.18
- 2026-11-24 05:32 acceptance A1: met — All nine additions are present with the specified names and types. SkillLevel uses a type-only import. Only added lines, plus the widened calibration line. No new comments.
- 2026-11-24 05:32 acceptance A2: met — checkSessionContract throws BackendError('invalid-input') with a field-named message for each of the four cases, and applies the marker cap only when mode is 'open'.
- 2026-11-24 05:32 acceptance A3: met — Covers 2 vs 3 open markers, 3 paced markers, 2 peaks, a 7-bin histogram, and every seeded session paired with generateWaveform.
- 2026-11-24 05:32 acceptance A4: met — Open and paced sessions with all new fields are placed in a memoryStore and read back via getSession and getWaveform with toEqual. A seeded legacy session is checked for absence of the new keys.
- 2026-11-24 05:32 acceptance A5: met — The check runs over recorded sessions before changeGroup writes them. No existing tests or Firebase rules are touched. lint, typecheck and test results are left to the deterministic checks.
- 2026-11-24 05:32 judge review posted: https://github.com/BreathBand/breathband-console/pull/29#pullrequestreview-6034197576

## Outcome

- 2026-11-24 05:38 PR #29 merged by arynbht 2026-11-24 05:36 · 33m · 1793k tokens · $2.34
