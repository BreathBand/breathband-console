# T-0023 · Move the console.css hard-coded values in DESIGN.md Observations onto tokens

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 05:33 intake: card drafted with 5 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 05:33 intake: intake confirmed; card sha256 0bc24ce8bd3553e87212f884f7b0dc940cfede8cfda01796f236a80a842019b4 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:33 route: assembly proposed; sha256 6f8e393a269127ac5c0d186227ca428caa5bf927c2749d3a295dca53070710ed; skills a11y-core, accessibility-lead, frontend-design, native-writing; proof ui-screenshots; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 05:33 route: route approved; assembly sha256 6f8e393a269127ac5c0d186227ca428caa5bf927c2749d3a295dca53070710ed (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:47 isolate: worktree .worktrees/T-0023 · branch chore/t-0023 from origin/main (3eb29862b1b7) · port 5179 · db breathband_console_t0023 · env sha256 250bba31a44b0dfc3632eb8116e8a8965d8126f046fa3c88e515f69fbc0cbdba (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:47 build: build started · skills a11y-core, accessibility-lead, frontend-design, native-writing · budget 8 steps / 15k ctx · ~34543 prompt tokens · 2 repo file(s) in context · 167025 tokens · $0.61 · 3 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:50 build: build done · commit 873d735ec2ce · 3 file(s) this round · 1942123 tokens · $1.45 · 49 turns · I replaced all 20 listed `console.css` literals with tokens, and the values are unchanged, so nothing should look different. Lint, typecheck and `npm run build` (static export) pass. I didn't take scr (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:52 prove: proof passed · ui-screenshots (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:53 judge: judge passed · round 1 · head 873d735ec2ce · record sha256 9cc6466d2f4d04232c0b0b654093b35c8ae4204812aac839eabe31f87698ea8f (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 05:53 ship: draft PR opened: #32 https://github.com/BreathBand/breathband-console/pull/32 · chore/t-0023 at 873d735ec2ce → main (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:16 close: worktree removed · branch chore/t-0023 deleted (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:16 close: floorplan updated · 1 call(s) · 28007 tokens · $0.08 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 06:16 close: ledger sealed · merged (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 05:47 1. Add the new tokens to the existing groups in the light `:root` block of src/app/globals.css. Use the exact literal values, add no comments, and add nothing to the `prefers-color-scheme: dark` block. Chrome group: `--c-chrome-3: #3a434d` and `--c-tip-warn: #f3c27a`. Surfaces group: `--c-paper: #ffffff`. Type group, keeping scale order: `--t-10: 10px` before `--t-12` and `--t-36: 36px` between `--t-28` and `--t-40`. Shape + space group: `--r-hair: 2px`, `--r-bar: 3px`, `--r-badge: 10px` and `--r-chip: 18px` next to `--r-1`/`--r-2`/`--r-sheet`, plus `--s-rail-y: 9px` and `--s-chrome: 10px` after `--s-9`. A grep showed none of these names exist in src/, site.css included.
- 2026-11-24 05:47 2. In src/app/cloud/console.css, replace only the 20 listed literals and leave every other declaration alone. `.brand` gap 10px → `var(--s-chrome)`. `.picker` gap 10px → `var(--s-chrome)`. `.picker` padding `0 12px` → `0 var(--s-4)`. `.picker .avatar` background `#3a434d` → `var(--c-chrome-3)`. `.rail-list a` padding `9px 10px` → `var(--s-rail-y) var(--s-chrome)`. `.hero .n, .stat .n` font `600 36px / 1 var(--f-sans)` → `600 var(--t-36) / 1 var(--f-sans)`. `.scale i`, `.sw-pacer` and `.skeleton span` border-radius 2px → `var(--r-hair)`. `.chart text` font-size 12px → `var(--t-12)`.
- 2026-11-24 05:47 3. Continue in console.css with the remaining replacements. `.avatar.sm` font-size 10px → `var(--t-10)`. `.count` and `.tab-count` border-radius 10px → `var(--r-badge)`. `.progress-bar` and `.cell` border-radius 3px → `var(--r-bar)`. `.cell b` font `600 10px / 1 var(--f-cond)` → `600 var(--t-10) / 1 var(--f-cond)`. The `@media print` `body, .console-body` background `#fff` → `var(--c-paper)`. `.viz-tip-out` color `#f3c27a` → `var(--c-tip-warn)`. `.chip-pick` border-radius 18px → `var(--r-chip)`. Leave out-of-scope literals as they are, such as `.rail-h h2` margin 10px, `.rail-empty` 10px, the `.skeleton` gap and the 36px/52px heights. Then grep the git diff to confirm exactly 20 value changes and no added comment lines.
- 2026-11-24 05:47 4. Update the DESIGN.md token tables so they match the code. Chrome colour table: add rows for `--c-chrome-3` (`#3a434d`, dark `–`, athlete-picker avatar background) and `--c-tip-warn` (`#f3c27a`, dark `–`, out-of-target text in the `.viz-tip` chart tooltip). Surfaces table: add `--c-paper` (`#ffffff`, dark `–`, page background when printing from console.css). Size-scale table: add `--t-10` and `--t-36` in scale order. Rewrite the 'Console-specific sizes outside the scale' sentence so the headline numbers use `var(--t-36)`.
- 2026-11-24 05:47 5. Continue in DESIGN.md's 'Spacing and radius' section. Add `--s-rail-y` (9px, vertical padding of `.rail-list a`) and `--s-chrome` (10px, the gap in `.brand`/`.picker` and the horizontal padding of `.rail-list a`) to the spacing listing. Add `--r-hair` (2px: `.scale i`, `.sw-pacer`, `.skeleton span`), `--r-bar` (3px: `.progress-bar`, `.cell`), `--r-badge` (10px: `.count`, `.tab-count`) and `--r-chip` (18px: `.chip-pick`) to the radius table. Check any other DESIGN.md text that quotes the replaced literals and correct it.
- 2026-11-24 05:47 6. In DESIGN.md's Observations section 'Hard-coded values in the console', delete the eleven `src/app/cloud/console.css` rows (lines 434-444) and keep the auth.css, group.css and report.css rows and the table header. Check the nearby sentences still read correctly. The 'Control heights' note stays as it is, since control heights are out of scope. The `group.css` rows say `12px` matches `--r-sheet` and `4px` matches `--r-1`, so make sure no row now points at a removed console row.
- 2026-11-24 05:47 7. Run `npm run lint` and `npm run typecheck`. No TS or test files changed, so no vitest run is needed. Then build the static export with `npm run build` to confirm the CSS compiles and the proof tool can render the pages. Use port 5179 only if a dev or preview server is started.
- 2026-11-24 05:47 8. Last review of `git diff`. Only src/app/cloud/console.css, src/app/globals.css and DESIGN.md have changed. Every new token appears once in `:root` and never in the dark block, and each value matches its literal exactly (`#ffffff` for `#fff`). The diff adds no comments or suppressions, and console.css has exactly 20 replaced literals and no other edits.

## Decisions

- 2026-11-24 05:33 risk low: no high or medium signal in the touches
- 2026-11-24 05:33 routed to ui, docs, a11y: ui (touches **/*.css (src/app/cloud/console.css); "design" in the title; "css" in the title; "dark mode" in the description; skill frontend-design triggers on **/*.css (src/app/cloud/console.css)), docs (touches **/*.md (DESIGN.md); skill native-writing triggers on **/*.md (DESIGN.md)), a11y (skill accessibility-lead triggers on **/*.css (src/app/cloud/console.css); the profile is public-facing and the task has UI)
- 2026-11-24 05:33 under the threshold, for the approver: data
- 2026-11-24 05:33 decided not in: data (scored only on description keywords)
- 2026-11-24 05:33 impeccable matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 05:33 taste-skill matched but isn't available (not locked, not synced, or blocked at sync)

## Proof

- 2026-11-24 05:52 screenshots: /cloud/, /cloud/athletes/, /cloud/trends/, /cloud/sessions/?athlete=demo-athlete&tab=trends, /cloud/session/?athlete=demo-athlete&id=s024 at sm/md/lg, before and after (30 images) on the evidence branch: T-0023/
- 2026-11-24 05:52 axe: 0 serious or critical violations
- 2026-11-24 05:52 visual diff: not automated yet; the before/after images are the comparison
- 2026-11-24 05:52 signed in: .rivetari/proof-auth.mjs ran on each side before its shots

## Judge

- 2026-11-24 05:52 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 05:53 review round 1: approve; 0 blocking, 2 suggestion(s) (claude-opus-5-5) · 20941 tokens · $0.20
- 2026-11-24 05:53 acceptance A1: met — All 20 literals at console.css:42, 90, 92, 132, 255 (both values), 378, 431, 568, 580, 982, 1228, 1276, 1322, 1581, 1607, 1756, 2225, 2277 and 2470 are replaced with var() tokens. No other console.css…
- 2026-11-24 05:53 acceptance A2: met — The 11 new tokens are each defined once in :root with matching values: #3a434d, #f3c27a, #ffffff, 10px, 36px, 2px, 3px, 10px, 18px, 9px, 10px. The diff adds nothing to the dark block.
- 2026-11-24 05:53 acceptance A3: unverified — Screenshot proof is produced by the prove step and is not part of the diff. The swaps are value-identical, so no visual change is expected.
- 2026-11-24 05:53 acceptance A4: met — Colour tokens are in the chrome and surfaces tables, --t-10 and --t-36 are in the size scale, the spacing tokens are in a spacing sub-table, and the radii are in the radius table. All console.css Obse…
- 2026-11-24 05:53 acceptance A5: unverified — The axe run is part of the prove step and is not visible in the diff.
- 2026-11-24 05:53 judge review posted: https://github.com/BreathBand/breathband-console/pull/32#pullrequestreview-6034355586

## Outcome

- 2026-11-24 06:16 PR #32 merged by arynbht 2026-11-24 06:15 · 43m · 2130k tokens · $2.26
