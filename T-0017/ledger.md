# T-0017 · Move the console.css hard-coded values in DESIGN.md Observations onto tokens

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 04:59 intake: card drafted with 5 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 05:00 intake: intake confirmed; card sha256 ad39273c3c199591a8d30d323d9643244bfe20b10ddb31cdde79e6dba3522034 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:00 route: assembly proposed; sha256 0ae19ceff5a5872f25b29d957e1cfad64beca5647649ac5ed01f5878dc4a3ba6; skills none; proof ui-screenshots; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 05:00 route: route approved; assembly sha256 0ae19ceff5a5872f25b29d957e1cfad64beca5647649ac5ed01f5878dc4a3ba6 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:19 isolate: worktree .worktrees/T-0017 · branch chore/t-0017 from origin/main (44e6ffb292b5) · port 5181 · db breathband_console_t0017 · env sha256 84dcecbe2b8e6aab6c9ce336f4b0721449562152dae261f3cbc509261f3364d5 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:19 build: build started · skills spine only · budget 8 steps / 15k ctx · ~27620 prompt tokens · 2 repo file(s) in context · 148639 tokens · $0.52 · 3 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:22 close: worktree C:\Users\arynb\Documents\Projects\breathband-console\.worktrees\T-0017 kept: it has uncommitted edits; remove it by hand · branch chore/t-0017 kept (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:22 close: ledger sealed · abandoned (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 05:19 1. In src/app/globals.css, add the new tokens to the existing :root groups only, with no comments and no entries in the prefers-color-scheme dark block. Under chrome: --c-chrome-3: #3a434d. After --c-bar: --c-tip-warn: #f3c27a and --c-paper: #ffffff. In the type scale: --t-10: 10px before --t-12, and --t-36: 36px between --t-28 and --t-40. Under shape + space: --r-hair: 2px, --r-bar: 3px, --r-badge: 10px and --r-chip: 18px next to --r-1/--r-2/--r-sheet, plus --s-rail-y: 9px and --s-chrome: 10px after --s-9. A grep has already confirmed that none of these names exist in globals.css or site.css.
- 2026-11-24 05:19 2. In src/app/cloud/console.css, swap only the colour and type literals: .picker .avatar background #3a434d -> var(--c-chrome-3); .viz-tip-out color #f3c27a -> var(--c-tip-warn); @media print body, .console-body background #fff -> var(--c-paper); .hero .n, .stat .n font becomes 600 var(--t-36) / 1 var(--f-sans); .chart text font-size 12px -> var(--t-12); .avatar.sm font-size 10px -> var(--t-10); .cell b font becomes 600 var(--t-10) / 1 var(--f-cond). Leave padding, margin and letter-spacing in those rules untouched.
- 2026-11-24 05:19 3. In src/app/cloud/console.css, swap the radius and spacing literals: border-radius 2px -> var(--r-hair) on .scale i, .sw-pacer and .skeleton span; 3px -> var(--r-bar) on .progress-bar and .cell; 10px -> var(--r-badge) on .count and .tab-count; 18px -> var(--r-chip) on .chip-pick; .brand gap and .picker gap 10px -> var(--s-chrome); .picker padding 0 12px -> 0 var(--s-4); .rail-list a padding 9px 10px -> var(--s-rail-y) var(--s-chrome). Leave every other 10px alone (.rail-h h2 margin, .rail-empty, .skeleton gap, .stat .n.sm), because they are out of scope.
- 2026-11-24 05:19 4. Run git diff on console.css and check that exactly the 20 listed literals changed and nothing else. Then grep console.css for '#3a434d|#f3c27a|#fff;|36px|border-radius: (2|3|10|18)px' to confirm that none of the listed occurrences remain.
- 2026-11-24 05:19 5. In DESIGN.md token tables, add rows (value, dark '–', role): --c-chrome-3 to the Chrome table (athlete picker avatar fill), and --c-tip-warn (out-of-target text in .viz-tip) and --c-paper (print background for body/.console-body) to a fitting colour table; --t-10 and --t-36 to the Console size scale table in order; --s-chrome and --s-rail-y to the spacing table; --r-hair, --r-bar, --r-badge and --r-chip to the radius table with their uses.
- 2026-11-24 05:19 6. In DESIGN.md Observations, delete the 11 console.css rows (lines 434-444) under 'Hard-coded values in the console' and keep the auth.css, group.css and report.css rows. Change the 'Console-specific sizes outside the scale' sentence in Typography to name var(--t-36) instead of 36px. In 'Print values that differ', add the new colour tokens to the list of tokens the print block does not override, and check that no other DESIGN.md text still describes these values as literals.
- 2026-11-24 05:19 7. Run npm run lint and npm run typecheck. Then run the related tests via npm run test -- related --run src/app/globals.css src/app/cloud/console.css, if any apply. Confirm the diff touches only console.css, globals.css and DESIGN.md, and adds no comments.
- 2026-11-24 05:19 8. Start the dev server on port 5181 and load /cloud/ and /cloud/session/?athlete=demo-athlete&id=s024 in light and dark mode. Check that the picker avatar, tooltip, score numbers, chips and cells look unchanged, so the screenshot proof tool can capture all five listed pages at 375, 768 and 1280px.

## Decisions

- 2026-11-24 04:59 risk low: no high or medium signal in the touches
- 2026-11-24 05:00 routed to ui, docs, a11y: ui (touches **/*.css (src/app/cloud/console.css); "design" in the title; "css" in the title; "dark mode" in the description; skill frontend-design triggers on **/*.css (src/app/cloud/console.css)), docs (touches **/*.md (DESIGN.md); skill native-writing triggers on **/*.md (DESIGN.md)), a11y (skill accessibility-lead triggers on **/*.css (src/app/cloud/console.css); the profile is public-facing and the task has UI)
- 2026-11-24 05:00 under the threshold, for the approver: data
- 2026-11-24 05:00 decided not in: data (scored only on description keywords)
- 2026-11-24 05:00 impeccable matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 05:00 taste-skill matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 05:00 accessibility-lead left out: it requires a11y-core, which isn't available
- 2026-11-24 05:00 frontend-design matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 05:00 native-writing matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 05:00 a11y: no vendored skill covers it; the agent works from the spine

## Outcome

- 2026-11-24 05:22 abandoned: redraft to route with the a11y/frontend skills (R-17) · 22m · 149k tokens · $0.52
