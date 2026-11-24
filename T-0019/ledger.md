# T-0019 · Additive contract fields: units, calibration, skill, method-C details, 2-marker cap

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 05:04 intake: card drafted with 5 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 05:05 intake: intake confirmed; card sha256 ffd916c38073fc552add7f13b766ea81ca613dcff79409a9ee414f5780f31c1e (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:05 route: assembly proposed; sha256 37456f7a76fa9f039013d6cbdda89a3979c3935207b70faa69c9ca7d7e0f86bc; skills none; proof migration-dry-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 05:05 route: route approved; assembly sha256 37456f7a76fa9f039013d6cbdda89a3979c3935207b70faa69c9ca7d7e0f86bc (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))

## Decisions

- 2026-11-24 05:04 risk medium: declared medium, raised from low (no high or medium signal in the touches)
- 2026-11-24 05:05 routed to data, testing, legal: data ("db" in the description; "migration" in the description), testing (touches **/*.test.* (src/lib/backend/local/contract.test.ts)), legal (the profile handles PII and the task touches data)
- 2026-11-24 05:05 under the threshold, for the approver: motion, infra
- 2026-11-24 05:05 decided not in: motion (scored only on description keywords)
- 2026-11-24 05:05 decided not in: infra (scored only on description keywords)
- 2026-11-24 05:05 data: no vendored skill covers it; the agent works from the spine
- 2026-11-24 05:05 legal: no vendored skill covers it; the agent works from the spine
