# T-0019 · Additive contract fields: units, calibration, skill, method-C details, 2-marker cap

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 05:04 intake: card drafted with 5 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 05:05 intake: intake confirmed; card sha256 ffd916c38073fc552add7f13b766ea81ca613dcff79409a9ee414f5780f31c1e (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:05 route: assembly proposed; sha256 37456f7a76fa9f039013d6cbdda89a3979c3935207b70faa69c9ca7d7e0f86bc; skills none; proof migration-dry-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 05:05 route: route approved; assembly sha256 37456f7a76fa9f039013d6cbdda89a3979c3935207b70faa69c9ca7d7e0f86bc (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:24 isolate: worktree .worktrees/T-0019 · branch feature/t-0019 from origin/main (44e6ffb292b5) · port 5174 · db breathband_console_t0019 · env sha256 c6762c58bad1bad62da58ebe1e13515bcde4f277cb79c1aff678b04cd8306e2d (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:25 build: build started · skills spine only · budget 12 steps / 60k ctx · ~29044 prompt tokens · 5 repo file(s) in context · 290579 tokens · $0.53 · 5 turns (rivetari runtime (for arynbht@gmail.com))

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
