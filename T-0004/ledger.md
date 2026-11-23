# T-0004 · Download the Compare table as CSV

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-23 20:20 intake: card drafted with 3 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-23 20:20 intake: intake confirmed; card sha256 fcb8aab260806e4f27cb59d5959d6fd5f01a2c68119bf7760342e083d2d183e9 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-23 20:20 route: assembly proposed; sha256 efbb0a81adbc551754e83dfa9d6d313a562c96fc8d6623c35f55259673736cfe; skills none; proof ui-screenshots; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-23 20:20 route: route approved; assembly sha256 efbb0a81adbc551754e83dfa9d6d313a562c96fc8d6623c35f55259673736cfe (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))

## Decisions

- 2026-11-23 20:20 risk low: no high or medium signal in the touches
- 2026-11-23 20:20 routed to ui, data, testing, a11y, legal: ui (touches **/*.tsx (src/app/cloud/trends/page.tsx); "page" in the description; "button" in the description), data ("table" in the title), testing (touches **/*.test.* (src/lib/domain/compare-csv.test.ts)), a11y (skill accessibility-lead triggers on **/*.tsx (src/app/cloud/trends/page.tsx); the profile is public-facing and the task has UI), legal (the profile handles PII and the task touches data)
- 2026-11-23 20:20 accessibility-lead left out: it requires a11y-core, which isn't available
- 2026-11-23 20:20 data: no vendored skill covers it; the agent works from the spine
- 2026-11-23 20:20 a11y: no vendored skill covers it; the agent works from the spine
- 2026-11-23 20:20 legal: no vendored skill covers it; the agent works from the spine
