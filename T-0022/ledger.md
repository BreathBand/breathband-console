# T-0022 · Give the trend charts their values as text and a data-table toggle

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 05:33 intake: card drafted with 5 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 05:33 intake: intake confirmed; card sha256 694b405ae13b35a6630179b4bcbd0709a3ca10cd2427de021f3e51ddfb2e0cf8 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:33 route: assembly proposed; sha256 21639eb31e7b4099d5bb9494175fd946f6b406db229746d9d1cb6936f7aca617; skills a11y-core, accessibility-lead, frontend-design; proof ui-screenshots; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 05:33 route: route approved; assembly sha256 21639eb31e7b4099d5bb9494175fd946f6b406db229746d9d1cb6936f7aca617 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:40 isolate: worktree .worktrees/T-0022 · branch feature/t-0022 from origin/main (3eb29862b1b7) · port 5174 · db breathband_console_t0022 · env sha256 03822134d4932f71c54de0c4fded1d849ed1d96c96b40c275c1540812cd8889c (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:40 build: build started · skills a11y-core, accessibility-lead, frontend-design · budget 8 steps / 15k ctx · ~30093 prompt tokens · 1 repo file(s) in context · 325921 tokens · $0.67 · 8 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:44 build: build done · commit e33005a4f348 · 4 file(s) this round · 3351737 tokens · $1.98 · 43 turns · The three trend charts now give screen readers a text summary of their values, and each chart with data has a "Show values as a table" button underneath. All the changes are inside the components, so (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:46 prove: proof passed · ui-screenshots (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:47 judge: judge passed · round 1 · head e33005a4f348 · record sha256 7f06da0610137e1d827e11a7c61557dced7b1ba38ab5047276753a16c3b24513 (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 05:47 ship: draft PR opened: #30 https://github.com/BreathBand/breathband-console/pull/30 · feature/t-0022 at e33005a4f348 → main (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:12 close: worktree removed · branch feature/t-0022 deleted (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:12 close: floorplan updated · 1 call(s) · 28075 tokens · $0.08 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:12 close: ledger sealed · merged (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 05:40 1. Create src/components/chartTable.ts with pure helpers and no comments. Move `shortDate` here and export it so trendCharts.tsx imports it. Export a `ChartTable` type: `{ caption, columns: string[], rows: { key: string; head: string; cells: string[] }[] }`. Add `timeTrendRows(points, format)`, which sorts by t and gives each point its tooltip label, `format(v)` and 'Outside the target' when out is set, else ''. Add `periodBarsRows(bars, unit)`, which gives one row per bar with its label and `${value} ${unit}`. Add `compareRows(series, starts, format, periodWord)`, which gives one row per bucket headed `${periodWord} ${shortDate}`.trim(), with one column per series name and '–' for null. Add `chartSummary({ count, noun, t0, t1, values, format })`, which returns a sentence like '5 points from 2 Nov to 23 Nov. Lowest 4, highest 8, latest 7.' and 'Nothing in this period.' when count is 0. Each helper takes an optional date formatter so tests don't depend on locale.
- 2026-11-24 05:40 2. Add src/components/chartTable.test.ts, a new vitest file and no existing test touched, covering A1. Check that TimeTrend rows come out sorted by time even when the input isn't, carry the tooltip label and the formatted value, and say 'Outside the target' only when out is set. Check PeriodBars gives one row per bar with label and value plus unit. Check CompareChart gives one row per bucket with the period word and date, one column per series, and '–' for null; also cover periodWord ''. Check the summary sentence gives the count, date range and lowest, highest and latest value in the given format, and the empty case.
- 2026-11-24 05:40 3. In trendCharts.tsx, add an internal `ChartData` component. It takes the caption (the chart's ariaLabel), a summary string, the column headers, the rows and a `hasData` flag. It renders `<p id={summaryId} className="sr-only">` with the summary, using ids from React `useId`. When `hasData` is true it also renders a wrapper `div.viz-data.no-print` holding a `<button type="button" className="link small" aria-expanded aria-controls={tableId}>`. The button reads 'Show values as a table' or 'Hide the table'. When open, the wrapper shows a `div.table-scroll` with `<table id={tableId} className="table">`, a `<caption>` from the ariaLabel, `<th scope="col">` headers and a `<th scope="row">` first cell per row. Add no comments.
- 2026-11-24 05:40 4. Wire ChartData into TimeTrend, PeriodBars and CompareChart without changing their props. Wrap each return in a fragment so the existing `.viz` div keeps its fixed width and height and stays unchanged. Add `aria-describedby={summaryId}` to each svg, keeping role=img and aria-label; the summary id comes from a `useId` in the chart and is passed down. Build rows and summary with the chartTable.ts helpers in the same format as the tooltips: TimeTrend uses `format`, PeriodBars uses value plus unit, CompareChart uses `format` and `periodWord`. Pass `hasData` as: sorted.length > 0 for TimeTrend, bars.length > 0 for PeriodBars, and for CompareChart starts.length > 0 with at least one non-null value. That way empty charts get no button but still have a summary.
- 2026-11-24 05:40 5. Add a small block to src/app/cloud/console.css next to the trend-chart section, using tokens only. Style `.viz-data` with a top margin of `var(--s-2)` and `min-width: 0; max-width: 100%`, and `.viz-data .table-scroll` with `margin-top: var(--s-2)`, `max-width: 100%` and `overflow-x: auto` so the table fits its pane at 375px. Style `.viz-data caption` with text-align left, the `.label` font and `var(--c-ink-2)`. Add `.viz-data td.num`-style right alignment if needed. Rely on the existing `@media print .no-print { display: none !important }` so the toggle and table never print. The report's aria-hidden `.rp-print` copy stays display:none on screen, so its button is never focusable.
- 2026-11-24 05:40 6. Run `npm run lint`, `npm run typecheck` and `npm run test -- related --run src/components/chartTable.ts src/components/trendCharts.tsx`. Fix anything red, and grep the diff to confirm no new comments, suppressions or eval/innerHTML.
- 2026-11-24 05:40 7. Start the dev server on port 5174 and open /cloud/sessions/?athlete=demo-athlete&tab=trends, /cloud/trends/ and /cloud/report/?athlete=demo-athlete at 375, 768 and 1280px. Confirm the collapsed charts look as before apart from the button, and that empty charts have no button. Tab to the toggle and open it with Enter or Space, then compare the table values with the tooltips. Check there is no sideways page scroll at 375px. In print emulation on the report, check there is no toggle or table and the printed charts are unchanged. Run axe for 0 serious or critical violations so the ui-screenshots proof tool can capture the same pages.

## Decisions

- 2026-11-24 05:33 risk low: no high or medium signal in the touches
- 2026-11-24 05:33 routed to ui, a11y, testing, data, legal: ui (touches **/*.css (src/app/cloud/console.css); "page" in the description; "screen" in the description; "component" in the description; skill frontend-design triggers on src/components/** (src/components/trendCharts.tsx)), a11y ("aria" in the description; "screen reader" in the description; "keyboard" in the description; skill accessibility-lead triggers on **/*.tsx (src/components/trendCharts.tsx)), testing (touches **/*.test.* (src/components/chartTable.test.ts); "test" in the description), data ("table" in the title), legal (the profile handles PII and the task touches data)
- 2026-11-24 05:33 under the threshold, for the approver: docs
- 2026-11-24 05:33 decided not in: docs (scored only on description keywords)
- 2026-11-24 05:33 impeccable matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 05:33 taste-skill matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 05:33 data: no vendored skill covers it; the agent works from the spine
- 2026-11-24 05:33 legal: no vendored skill covers it; the agent works from the spine

## Proof

- 2026-11-24 05:46 screenshots: /cloud/sessions/?athlete=demo-athlete&tab=trends, /cloud/trends/, /cloud/report/?athlete=demo-athlete at sm/md/lg, before and after (18 images) on the evidence branch: T-0022/
- 2026-11-24 05:46 axe: 0 serious or critical violations
- 2026-11-24 05:46 visual diff: not automated yet; the before/after images are the comparison
- 2026-11-24 05:46 signed in: .rivetari/proof-auth.mjs ran on each side before its shots

## Judge

- 2026-11-24 05:46 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 05:47 review round 1: approve; 0 blocking, 4 suggestion(s) (claude-opus-5-5) · 20160 tokens · $0.20
- 2026-11-24 05:47 acceptance A1: met — chartTable.test.ts covers sorting, tooltip label, format, 'Outside the target', per-bar label and unit, compare rows with period word, date and '–', and the summary count, range and lowest/highest/lat…
- 2026-11-24 05:47 acceptance A2: unverified — The button has aria-expanded and aria-controls and is not rendered when there is no data. No screenshot proof was provided, and the fragment's effect on caller layout is unchecked.
- 2026-11-24 05:47 acceptance A3: unverified — It is a native button with a caption from ariaLabel, th headers with scope, and an overflow-x scroll wrapper. The keyboard and 375px behaviour needs manual proof.
- 2026-11-24 05:47 acceptance A4: unverified — role=img and aria-label are kept, aria-describedby points to the sr-only summary, ids come from useId, and the toggle is .no-print. Print preview has not been checked.
- 2026-11-24 05:47 acceptance A5: unverified — No axe run was provided.
- 2026-11-24 05:47 judge review posted: https://github.com/BreathBand/breathband-console/pull/30#pullrequestreview-6034304690

## Outcome

- 2026-11-24 06:12 PR #30 merged by arynbht 2026-11-24 06:08 · 39m · 3698k tokens · $2.85
