# T-0016 · Give the trend charts their values as text and a data-table toggle

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 04:59 intake: card drafted with 5 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 04:59 intake: intake confirmed; card sha256 7e6185759098c00376869578674d27b9eff495aa76ea33d798ecc09b7cf0b4d4 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 04:59 route: assembly proposed; sha256 0a6f730fda243fe9c3ce833e7a8f7c928ebc99309f85ab0a514d415c33d15965; skills none; proof ui-screenshots; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 04:59 route: route approved; assembly sha256 0a6f730fda243fe9c3ce833e7a8f7c928ebc99309f85ab0a514d415c33d15965 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:13 isolate: worktree .worktrees/T-0016 · branch feature/t-0016 from origin/main (44e6ffb292b5) · port 5174 · db breathband_console_t0016 · env sha256 e53820e5fd9382ec33b3de1c4177a6088babcf6a33eac6231f7d6026bd3c419b (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:13 build: build started · skills spine only · budget 8 steps / 15k ctx · ~25259 prompt tokens · 1 repo file(s) in context · 298704 tokens · $0.58 · 8 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:17 build: build done · commit c6490c6eda6d · 4 file(s) this round · 2342018 tokens · $1.78 · 36 turns · The three trend charts now have a screen-reader summary and a "Show values as a table" toggle. Lint, typecheck and the new tests (10) all pass. I haven't checked them in a browser: the dev server star (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:18 prove: proof passed · ui-screenshots (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:19 judge: judge passed · round 1 · head c6490c6eda6d · record sha256 c925415f14dd3562939a68c08d918e454335302548334c60ee43e348e7c480ec (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 05:19 ship: draft PR opened: #25 https://github.com/BreathBand/breathband-console/pull/25 · feature/t-0016 at c6490c6eda6d → main (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 05:13 1. Create src/components/chartTable.ts, a pure module with no React, exporting shortDate (moved out of trendCharts.tsx) and these row builders: timeTrendTable(points, format, date?), which sorts by t and returns rows of [label, format(v), out ? 'Outside the target' : ''] plus headers; periodBarsTable(bars, unit), one row per bar of [label, `${value} ${unit}`]; compareTable(series, starts, periodWord, format, date?), one row per bucket of [`${periodWord} ${date}`.trim(), ...one value per series or '–' for null] with the series names as column headers; and a chartSummary({ count, t0, t1, values, format, date? }) helper that returns a sentence giving the point count, date range and lowest, highest and latest value. The optional date formatter keeps the tests locale-independent
- 2026-11-24 05:13 2. Add src/components/chartTable.test.ts (vitest, plain .ts) covering A1: TimeTrend rows sorted by time with the tooltip label, the formatted value and 'Outside the target' only when out is set; one PeriodBars row per bar with label and value plus unit; CompareChart rows per bucket with the period word and date, one column per series and '–' for null, including periodWord ''; summary sentence count, range, lowest, highest and latest (and an empty-input case). Pass a fixed date formatter for deterministic strings
- 2026-11-24 05:13 3. In trendCharts.tsx, import shortDate and the builders from ./chartTable and add a small internal ChartTable component. It takes caption, headers, rows and summary, and calls React useId for summaryId and tableId so the report's screen and print copies never share an id. It renders a <p className="sr-only" id={summaryId}> summary, plus a wrapper with className="viz-data no-print" holding a <button type="button" className="link small" aria-expanded aria-controls={tableId}> labelled 'Show values as a table' / 'Hide the table', and, when open, a .table-scroll div wrapping a <table className="table" id={tableId}> with <caption>{ariaLabel}</caption>, <th scope="col"> headers and <th scope="row"> first cells. Add no code comments
- 2026-11-24 05:13 4. Wire TimeTrend, PeriodBars and CompareChart: keep each existing .viz div unchanged (same fixed width and height, so the collapsed chart looks the same), wrap it in a fragment followed by ChartTable rendered only when the chart has data (sorted.length > 0, bars.length > 0, starts.length > 0 with some non-null value), and add aria-describedby={summaryId} to each svg while keeping role=img and aria-label. Props stay exactly as they are (no required additions)
- 2026-11-24 05:13 5. In console.css's trend charts section, add token-only styles for .viz-data (margin-top var(--s-2), max-width 100%, min-width 0), its .table-scroll (overflow-x auto so the table fits its pane at 375px), and its caption (left-aligned, var(--f-cond)/var(--t-13), color var(--c-ink-2)). Make sure .no-print already hides it in print. No hard-coded colours and no comments
- 2026-11-24 05:13 6. Check the callers' layout assumptions without editing them: Measured in TrendsTab.tsx, trends/page.tsx and the report's rp-screen/rp-print Chart wrapper. Confirm the extra toggle row below the chart doesn't clip in the panes, and that the aria-hidden print copy gets its own useId ids and is hidden by .no-print
- 2026-11-24 05:13 7. Run npm run lint, npm run typecheck, and npm run test -- related --run src/components/chartTable.ts src/components/chartTable.test.ts src/components/trendCharts.tsx. Fix any failures without adding suppressions or comments
- 2026-11-24 05:13 8. Start the dev server on port 5174 and smoke-check the three card pages at 375, 768 and 1280px so the ui-screenshots/axe proof can run. On each page: the toggle sits under each chart with data and is absent on empty charts; Tab plus Enter or Space opens the table; there's no sideways page scroll at 375px; print emulation of /cloud/report/?athlete=demo-athlete shows no toggle or table

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

## Proof

- 2026-11-24 05:18 screenshots: /cloud/sessions/?athlete=demo-athlete&tab=trends, /cloud/trends/, /cloud/report/?athlete=demo-athlete at sm/md/lg, before and after (18 images) in .rivetari/tasks/T-0016/proof/ (not pushed: upload failed: …nUZR42PKQFksBr9QKVXCPusD3OiA/RkQ5kP8qV/Jl1WywAp/6+dcmPM2zL1UrUahe4JqfnWWKXIul3uUbfP8njAFLW1OFr3gdFtZ72cNH+PtQT7/brW+NXqJAHh0y9V8/U/A1U7AfwIMAD7mS3pCbuWJAAAAAElFTkSuQmCC" /> </a> </div> </body> </html>)
- 2026-11-24 05:18 axe: 0 serious or critical violations
- 2026-11-24 05:18 visual diff: not automated yet; the before/after images are the comparison
- 2026-11-24 05:18 signed in: .rivetari/proof-auth.mjs ran on each side before its shots

## Judge

- 2026-11-24 05:18 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 05:19 review round 1: approve; 0 blocking, 3 suggestion(s) (claude-opus-5-5) · 20034 tokens · $0.21
- 2026-11-24 05:19 acceptance A1: met — chartTable.test.ts covers sorting, the label, the formatted value and the 'Outside the target' note for TimeTrend; value plus unit for PeriodBars; period word plus date, one column per series and '–' …
- 2026-11-24 05:19 acceptance A2: unverified — Screenshot criterion. The code renders a button with aria-expanded and aria-controls only when there is data. Whether the collapsed layout is unchanged depends on the screenshots (see suggestions).
- 2026-11-24 05:19 acceptance A3: unverified — Manual criterion. A native button, a caption from ariaLabel, col and row th, and values matching the tooltip formats are present. 375px fit relies on the existing .table-scroll.
- 2026-11-24 05:19 acceptance A4: unverified — Manual criterion. role=img and aria-label are kept, aria-describedby points to the useId summary, and .viz-data has .no-print. Print preview still needs checking.
- 2026-11-24 05:19 acceptance A5: unverified — Requires an axe run on the listed pages.
- 2026-11-24 05:19 judge review posted: https://github.com/BreathBand/breathband-console/pull/25#pullrequestreview-6034097527
