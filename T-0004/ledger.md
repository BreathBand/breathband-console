# T-0004 · Download the Compare table as CSV

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-23 20:20 intake: card drafted with 3 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-23 20:20 intake: intake confirmed; card sha256 fcb8aab260806e4f27cb59d5959d6fd5f01a2c68119bf7760342e083d2d183e9 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-23 20:20 route: assembly proposed; sha256 efbb0a81adbc551754e83dfa9d6d313a562c96fc8d6623c35f55259673736cfe; skills none; proof ui-screenshots; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-23 20:20 route: route approved; assembly sha256 efbb0a81adbc551754e83dfa9d6d313a562c96fc8d6623c35f55259673736cfe (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-23 20:21 isolate: worktree .worktrees/T-0004 · branch feature/t-0004 from origin/main (4106bb1ac524) · port 5176 · db breathband_console_t0004 · env sha256 4f0fd8b1bfcbe20edc29b9efe2ef367b49d87afe9fc9f8cb516594d381210df8 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 20:21 build: build started · skills spine only · budget 8 steps / 15k ctx · ~10647 prompt tokens · 7 repo file(s) in context · 164482 tokens · $0.28 · 8 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 20:23 build: build done · commit 5fde1a26554a · 3 file(s) this round · 1117022 tokens · $0.75 · 33 turns · The Compare page's "Side by side" header now has a "CSV of this table" button, and the new unit tests pass. I didn't check it in a browser, though, so A1 and A2 are still unconfirmed. The dev server s (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-23 20:21 1. In src/lib/domain/csv.ts, export a CompareCsvRow type { name: string; stats: PeriodStats; change: number | null } (import type PeriodStats from ./trends) and add compareCsv(rows: CompareCsvRow[]): string. It writes the header Athlete, Sessions, A week, Average score, Change, On target, Scored, Breathing rate (br/min), Weakest part, Weakest part score, followed by one row per athlete: name, count, perWeek, average ?? null, change, onTarget, scoredCount, rateAverage ?? null, weakest?.label ?? null, weakest?.value ?? null. Join the rows with the existing field() helper, using \r\n and a trailing \r\n, the same way sessionsCsv does. Add no code comments.
- 2026-11-23 20:21 2. In src/app/cloud/trends/page.tsx, add a compareRows(members, chosen, now, days) helper that returns, for each picked member and in table order, { m, cur, change }. cur is periodStats(inPeriod(...)) and change is computed from prev exactly as CompareRow computes it now. Call it once in Compare after `chosen` is known.
- 2026-11-23 20:21 3. Change CompareRow to take the precomputed { m, cur, change } instead of computing periodStats itself, and render the tbody from the shared rows array so the table and the CSV use the same values. Keep the rendered markup and formatting the same.
- 2026-11-23 20:21 4. Import Icon from @/components/Icon, compareCsv from @/lib/domain/csv, and downloadText and slug from @/lib/download into page.tsx. In the Side by side pane-h, after the meta span, add a <button type="button" className="button" data-variant="ghost" data-size="small" disabled={rows.length === 0}> with <Icon name="download" size={16} /> and the label 'CSV of this table'. Its onClick calls downloadText(`breathband-compare-${slug(periodLabel)}.csv`, compareCsv(rows.map(r => ({ name: r.m.profile.displayName, stats: r.cur, change: r.change })))), where periodLabel is the PERIODS label already used in the meta span (for example breathband-compare-13-weeks.csv). Check the .pane-h styles in globals.css to see whether the button lines up, and add a token-based rule only if it's needed.
- 2026-11-23 20:21 5. Create src/lib/domain/compare-csv.test.ts (vitest, in the style of domain.test.ts) with tests that: (a) the first line is the exact header; (b) a row whose stats have average null, rateAverage null and weakest null, and change null, comes out as blank cells in the right positions; (c) a name with a comma and a quote, e.g. 'Morgan, "Alex"', is quoted as "Morgan, ""Alex"""; (d) the output has one line per row plus the header, ends with \r\n, and keeps the input order. Build the PeriodStats fixtures directly, with no new dependencies.
- 2026-11-23 20:21 6. Run the related tests through the package manager: `npm run test -- related --run src/lib/domain/csv.ts src/lib/domain/compare-csv.test.ts src/app/cloud/trends/page.tsx`. Then run `npm run lint` and `npm run typecheck` and fix anything they report, without adding suppressions or comments.
- 2026-11-23 20:21 7. Start the dev server on port 5176 and open /cloud/trends/ as the demo coach. Check that the button sits in the Side by side header and is enabled when athletes are picked, and that it's disabled after every athlete is unticked (A2). Check that the downloaded file name and contents match the table's order and values (A1). The page must render cleanly so the ui-screenshots proof can be taken.

## Decisions

- 2026-11-23 20:20 risk low: no high or medium signal in the touches
- 2026-11-23 20:20 routed to ui, data, testing, a11y, legal: ui (touches **/*.tsx (src/app/cloud/trends/page.tsx); "page" in the description; "button" in the description), data ("table" in the title), testing (touches **/*.test.* (src/lib/domain/compare-csv.test.ts)), a11y (skill accessibility-lead triggers on **/*.tsx (src/app/cloud/trends/page.tsx); the profile is public-facing and the task has UI), legal (the profile handles PII and the task touches data)
- 2026-11-23 20:20 accessibility-lead left out: it requires a11y-core, which isn't available
- 2026-11-23 20:20 data: no vendored skill covers it; the agent works from the spine
- 2026-11-23 20:20 a11y: no vendored skill covers it; the agent works from the spine
- 2026-11-23 20:20 legal: no vendored skill covers it; the agent works from the spine
