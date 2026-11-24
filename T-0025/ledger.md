# T-0025 · Stop the axe fixes from widening the report at 375px and duplicating a landmark name

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 05:58 intake: card drafted with 4 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 05:59 intake: intake confirmed; card sha256 5e6c4cdfd089f1d1f45d329df97043fc0715bcb5d5c26b19b341bf7ad2aa9e63 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:59 route: assembly proposed; sha256 89acf722424071cbfd73dfa45cab7687909c1837e03934b8c6e608309da0bc10; skills a11y-core, accessibility-lead, frontend-design; proof ui-screenshots; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 05:59 route: route approved; assembly sha256 89acf722424071cbfd73dfa45cab7687909c1837e03934b8c6e608309da0bc10 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:59 isolate: worktree .worktrees/T-0025 · branch fix/t-0025 from origin/fix/t-0013 (ee22d0a89ff2) · port 5180 · db breathband_console_t0025 · env sha256 7a9ea553775e096263aa3700eccdea059cd5b6a25403c3ac10d822793c616a19 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:00 build: build started · skills a11y-core, accessibility-lead, frontend-design · budget 8 steps / 15k ctx · ~32743 prompt tokens · 5 repo file(s) in context · 318691 tokens · $0.62 · 5 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:01 build: build done · commit a5c664c1ef47 · 4 file(s) this round · 827172 tokens · $0.82 · 16 turns · I made both fixes. Lint, typecheck and the new tests pass, but I couldn't check them in a browser: this worktree has no Playwright, Puppeteer or axe, and adding one would be a new dependency. So A1–A3 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:02 prove: proof passed · ui-screenshots (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:03 judge: judge passed · round 1 · head a5c664c1ef47 · record sha256 57998ea356f796b813a891df2927bfd3965f94a7ee16e3cd2865caf3b3abe5f6 (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 06:03 ship: draft PR opened: #34 https://github.com/BreathBand/breathband-console/pull/34 · fix/t-0025 at a5c664c1ef47 → fix/t-0013 (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 06:00 1. Read src/app/cloud/session/SessionReview.tsx around lines 160-175. Confirm that the section.pane around BreathTable is named 'Breaths in view' and has an h2 with that text. Then list every other landmark name on /cloud/session/ (Breadcrumb, Waveform, Markers, Scores, Total Breath Score, How scores work, Session note, the CloudShell nav) so the new name doesn't clash with any of them.
- 2026-11-24 06:00 2. In src/app/globals.css, add `position: relative;` to the existing `.table-scroll { overflow-x: auto; }` rule. This makes the wrapper the containing block for the absolutely positioned .sr-only spans, so they stay inside the scroll box. Leave .sr-only alone and add no comments. The print rule `.rp-sessions .table-scroll { overflow: visible }` in report.css still applies unchanged.
- 2026-11-24 06:00 3. In src/app/cloud/session/Waveform.tsx:299, keep `className="bt-scroll" tabIndex={0} role="region"` and change only the aria-label to a unique, descriptive name such as "Timing and depth of each breath". Change no other markup and add no comments.
- 2026-11-24 06:00 4. Leave src/app/cloud/report/page.tsx unchanged: the 'Timing, exhale' and 'Depth, exhale' sr-only spans stay in the th elements. Check that `.rp-table th` and `.table th` don't set a position that would make the spans escape again.
- 2026-11-24 06:00 5. Add a new test file, src/app/cloud/session/Waveform.test.ts (vitest, node, renderToStaticMarkup like States.test.ts). Render BreathTable with two breaths in the window. Assert role="region" and tabindex="0", that aria-label is present and is not 'Breaths in view', and that the empty case still renders the muted paragraph with no region.
- 2026-11-24 06:00 6. Add a new test file, src/app/globals.test.ts. Read src/app/globals.css with node:fs and assert that the `.table-scroll` rule includes `position: relative` and `overflow-x: auto`, and that `.sr-only` is still `position: absolute`. This guards A1 at the unit level. Edit no existing tests.
- 2026-11-24 06:00 7. Run `npm run lint`, `npm run typecheck` and `npm run test -- related --run src/app/cloud/session/Waveform.tsx src/app/globals.css src/app/cloud/session/Waveform.test.ts src/app/globals.test.ts`, and fix anything that's red.
- 2026-11-24 06:00 8. Start the dev server on port 5180 to support the screenshot proof. Check that at 375px document.documentElement.scrollWidth is 375 on /cloud/report/?athlete=demo-athlete and that the report table still scrolls inside .table-scroll. Check that /cloud/session/?athlete=demo-athlete&id=s001 has no duplicate landmark names at 375px and at 1280px, and that the .bt-scroll region still takes Tab focus and scrolls with the arrow keys.

## Decisions

- 2026-11-24 05:58 risk low: no high or medium signal in the touches
- 2026-11-24 05:59 routed to ui, a11y: ui (touches **/*.css (src/app/globals.css); "page" in the description; "css" in the description; skill frontend-design triggers on **/*.css (src/app/globals.css)), a11y (skill accessibility-lead triggers on **/*.tsx (src/app/cloud/session/Waveform.tsx); the profile is public-facing and the task has UI)
- 2026-11-24 05:59 under the threshold, for the approver: data, testing
- 2026-11-24 05:59 decided not in: data (scored only on description keywords)
- 2026-11-24 05:59 decided not in: testing (scored only on description keywords)
- 2026-11-24 05:59 impeccable matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 05:59 taste-skill matched but isn't available (not locked, not synced, or blocked at sync)

## Proof

- 2026-11-24 06:02 screenshots: /cloud/report/?athlete=demo-athlete, /cloud/session/?athlete=demo-athlete&id=s001 at sm/md/lg, before and after (12 images) on the evidence branch: T-0025/
- 2026-11-24 06:02 axe: 0 serious or critical violations
- 2026-11-24 06:02 visual diff: not automated yet; the before/after images are the comparison
- 2026-11-24 06:02 signed in: .rivetari/proof-auth.mjs ran on each side before its shots

## Judge

- 2026-11-24 06:02 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 06:03 review round 1: approve; 0 blocking, 3 suggestion(s) (claude-opus-5-5) · 10851 tokens · $0.10
- 2026-11-24 06:03 acceptance A1: unverified — Making .table-scroll a positioned ancestor addresses the stated root cause and leaves the sr-only th spans in place. The 375px scrollWidth must be confirmed by the screenshot run.
- 2026-11-24 06:03 acceptance A2: unverified — The region keeps role=region and tabindex=0 and is renamed 'Timing and depth of each breath', which differs from the pane's 'Breaths in view'. The axe result at 375px and 1280px comes from the proof r…
- 2026-11-24 06:03 acceptance A3: unverified — The diff only adds a CSS position and changes a label, so no new violation is expected. The axe comparison against main must come from the proof run.
- 2026-11-24 06:03 acceptance A4: unverified — No existing test is modified and two new test files are added. Lint, typecheck and test results are not shown in the diff.
- 2026-11-24 06:03 judge review posted: https://github.com/BreathBand/breathband-console/pull/34#pullrequestreview-6034446197
