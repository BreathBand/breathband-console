# T-0022 · Give the trend charts their values as text and a data-table toggle

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 05:33 intake: card drafted with 5 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 05:33 intake: intake confirmed; card sha256 694b405ae13b35a6630179b4bcbd0709a3ca10cd2427de021f3e51ddfb2e0cf8 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:33 route: assembly proposed; sha256 21639eb31e7b4099d5bb9494175fd946f6b406db229746d9d1cb6936f7aca617; skills a11y-core, accessibility-lead, frontend-design; proof ui-screenshots; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 05:33 route: route approved; assembly sha256 21639eb31e7b4099d5bb9494175fd946f6b406db229746d9d1cb6936f7aca617 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))

## Decisions

- 2026-11-24 05:33 risk low: no high or medium signal in the touches
- 2026-11-24 05:33 routed to ui, a11y, testing, data, legal: ui (touches **/*.css (src/app/cloud/console.css); "page" in the description; "screen" in the description; "component" in the description; skill frontend-design triggers on src/components/** (src/components/trendCharts.tsx)), a11y ("aria" in the description; "screen reader" in the description; "keyboard" in the description; skill accessibility-lead triggers on **/*.tsx (src/components/trendCharts.tsx)), testing (touches **/*.test.* (src/components/chartTable.test.ts); "test" in the description), data ("table" in the title), legal (the profile handles PII and the task touches data)
- 2026-11-24 05:33 under the threshold, for the approver: docs
- 2026-11-24 05:33 decided not in: docs (scored only on description keywords)
- 2026-11-24 05:33 impeccable matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 05:33 taste-skill matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 05:33 data: no vendored skill covers it; the agent works from the spine
- 2026-11-24 05:33 legal: no vendored skill covers it; the agent works from the spine
