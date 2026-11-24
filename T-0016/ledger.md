# T-0016 · Give the trend charts their values as text and a data-table toggle

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 04:59 intake: card drafted with 5 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 04:59 intake: intake confirmed; card sha256 7e6185759098c00376869578674d27b9eff495aa76ea33d798ecc09b7cf0b4d4 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 04:59 route: assembly proposed; sha256 0a6f730fda243fe9c3ce833e7a8f7c928ebc99309f85ab0a514d415c33d15965; skills none; proof ui-screenshots; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 04:59 route: route approved; assembly sha256 0a6f730fda243fe9c3ce833e7a8f7c928ebc99309f85ab0a514d415c33d15965 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))

## Decisions

- 2026-11-24 04:59 risk low: no high or medium signal in the touches
- 2026-11-24 04:59 routed to ui, a11y, testing, data, legal: ui (touches **/*.css (src/app/cloud/console.css); "page" in the description; "screen" in the description; "component" in the description; skill frontend-design triggers on src/components/** (src/components/trendCharts.tsx)), a11y ("aria" in the description; "screen reader" in the description; "keyboard" in the description; skill accessibility-lead triggers on **/*.tsx (src/components/trendCharts.tsx)), testing (touches **/*.test.* (src/components/chartTable.test.ts); "test" in the description), data ("table" in the title), legal (the profile handles PII and the task touches data)
- 2026-11-24 04:59 under the threshold, for the approver: docs
- 2026-11-24 04:59 decided not in: docs (scored only on description keywords)
- 2026-11-24 04:59 accessibility-lead left out: it requires a11y-core, which isn't available
- 2026-11-24 04:59 impeccable matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 04:59 taste-skill matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 04:59 frontend-design matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 04:59 a11y: no vendored skill covers it; the agent works from the spine
- 2026-11-24 04:59 data: no vendored skill covers it; the agent works from the spine
- 2026-11-24 04:59 legal: no vendored skill covers it; the agent works from the spine
