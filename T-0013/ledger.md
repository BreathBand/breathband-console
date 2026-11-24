# T-0013 · Clear the axe violations reported on /cloud pages

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 04:58 intake: card drafted with 5 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 04:58 intake: intake confirmed; card sha256 c263d9ce1ba41db5559e8d8028b8e04857bb28bdc0b0e7651a27ca266126b96c (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 04:58 route: assembly proposed; sha256 bd32c27614a2432fdf19cbb76f8654095c66e90fa948993502524544ab31e7a1; skills none; proof ui-screenshots; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 04:58 route: route approved; assembly sha256 bd32c27614a2432fdf19cbb76f8654095c66e90fa948993502524544ab31e7a1 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 05:01 isolate: worktree .worktrees/T-0013 · branch fix/t-0013 from origin/main (c7f8fd24c171) · port 5176 · db breathband_console_t0013 · env sha256 d350c513603222558be3401ac0038f60931ee00d674be2404d67fd004599e06a (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:01 build: build started · skills spine only · budget 8 steps / 15k ctx · ~28228 prompt tokens · 8 repo file(s) in context · 290608 tokens · $0.56 · 5 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:24 build: build started · skills spine only · budget 8 steps / 15k ctx · ~28258 prompt tokens · 8 repo file(s) in context · 210707 tokens · $0.51 · 8 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:27 build: build done · commit eff1f317bbc0 · 11 file(s) this round · 1720196 tokens · $1.15 · 39 turns · I've made fixes for all four axe rules. Lint, typecheck, the new tests and `npm run build` (the static export) all pass. I couldn't do step 8: there's no Playwright or Puppeteer in the repo and I coul (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:28 prove: proof passed · ui-screenshots (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:46 judge: judge failed · round 1 · head eff1f317bbc0 · 1 blocking · record sha256 2063d875fce4f143539330104d8df72d2e7045c191aa1564d9f89ca146a5a00e (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 05:47 build: build done · commit ee22d0a89ff2 · 1 file(s) this round · 201016 tokens · $0.34 · 4 turns · retry · I fixed the one problem the judge sent back. On the Plan tab, the "Earlier" section and the scrolling table inside it were both regions named "Earlier", which axe reports as a duplicate (`landmark-uni (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:48 prove: proof passed · ui-screenshots (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 05:49 judge: judge passed · round 2 · head ee22d0a89ff2 · record sha256 401a0a4644379f3fa9ee0a97800ce9a7f88583ed65bfe02fa9e9b41fb1525d8b (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 05:49 ship: draft PR opened: #31 https://github.com/BreathBand/breathband-console/pull/31 · fix/t-0013 at ee22d0a89ff2 → main (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 05:24 1. In src/components/States.tsx, add an optional `level?: 1 | 2` prop to EmptyState (default 2) that renders the title as an h1 when it is 1 and as an h2 otherwise, so every existing use is unchanged. Keep the same .empty markup and add no comments.
- 2026-11-24 05:24 2. Pass `level={1}` only to the three page-level empty states axe reported: src/app/cloud/sharing/page.tsx:25 (coach view), src/app/cloud/group/live/page.tsx:48 (no id) and src/app/cloud/session/page.tsx:27 ('This link is missing a session'). Leave session/page.tsx:40 and the other out-of-scope empty states alone.
- 2026-11-24 05:24 3. Fix aria-prohibited-attr in src/app/cloud/SessionsTab.tsx:110 and src/app/cloud/CoachDashboard.tsx:315: remove aria-label from the `<i className="new-dot">` and put `<span className="sr-only">Not opened yet</span>` inside it, keeping `title` in SessionsTab. Check that the .new-dot rule at console.css:1260 still sizes the dot the same with the absolutely positioned sr-only child, so it looks identical.
- 2026-11-24 05:24 4. Fix scrollable-region-focusable. Wrap the Earlier table at src/app/cloud/PlanTab.tsx:93 in `<div className="table-scroll" tabIndex={0} role="region" aria-labelledby="past-h">`. Give the .bt-scroll at src/app/cloud/session/Waveform.tsx:299 `tabIndex={0} role="region" aria-label="Breaths in this window"`. Both pick up the global :focus-visible outline at globals.css:192, scroll with the arrow keys natively, and need no new token or CSS. Leave the other .table-scroll wrappers alone.
- 2026-11-24 05:24 5. Fix empty-table-header in src/app/cloud/report/page.tsx:638 and :644: add `<span className="sr-only">Timing, exhale</span>` and `<span className="sr-only">Depth, exhale</span>` next to the aria-hidden `<Arrow dir="out" />`, so the visible table is unchanged. Check that report.css print rules don't un-hide .sr-only.
- 2026-11-24 05:24 6. Add a new test file, src/components/States.test.tsx (first confirm that the vitest include pattern and environment accept .tsx; if not, use src/lib/domain/a11y-markup.test.ts with React.createElement). Using react-dom/server renderToStaticMarkup, which adds no new dependency, it checks that EmptyState renders an h2 by default and an h1 with level=1, and that ErrorState is unchanged. Do not change any existing test.
- 2026-11-24 05:24 7. Run `npm run lint`, `npm run typecheck` and `npm run test -- related --run` on the touched files. Grep the diff to confirm there are no new comments, suppressions or aria-label left on .new-dot, and that globals.css is untouched (no token is needed).
- 2026-11-24 05:24 8. Make sure the ui-screenshots proof can be produced: start the dev server on port 5176, open the listed /cloud pages as the demo coach and athlete at 1440px and 375px, and run axe-core from node_modules/axe-core to confirm there are 0 serious or critical violations and none of the four reported rules. Then Tab to each of the two scrollers to confirm the focus outline shows and the arrow keys scroll them.

## Decisions

- 2026-11-24 04:58 risk low: no high or medium signal in the touches
- 2026-11-24 04:58 routed to ui, a11y: ui (touches **/*.css (src/app/globals.css); "page" in the title; "component" in the description; "css" in the description; skill frontend-design triggers on src/components/** (src/components/States.tsx)), a11y ("aria" in the description; "keyboard" in the description; skill accessibility-lead triggers on **/*.tsx (src/app/cloud/SessionsTab.tsx))
- 2026-11-24 04:58 under the threshold, for the approver: data, infra
- 2026-11-24 04:58 decided not in: data (scored only on description keywords)
- 2026-11-24 04:58 decided not in: infra (scored only on description keywords)
- 2026-11-24 04:58 accessibility-lead left out: it requires a11y-core, which isn't available
- 2026-11-24 04:58 impeccable matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 04:58 taste-skill matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 04:58 frontend-design matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 04:58 a11y: no vendored skill covers it; the agent works from the spine

## Stop-and-ask

- 2026-11-24 05:01 asked: budget_exhausted: the plan call reached its 4-turn limit before it replied with a plan; allow to plan again with 8 turns, or deny to plan again within 4
- 2026-11-24 05:15 answered: allowed

## Proof

- 2026-11-24 05:28 screenshots: /cloud/, /cloud/sessions/?athlete=demo-athlete&tab=sessions, /cloud/sessions/?athlete=demo-athlete&tab=plan, /cloud/session/?athlete=demo-athlete&id=s001, /cloud/session/?id=s001, /cloud/sharing/, /cloud/group/live/, /cloud/report/?athlete=demo-athlete at sm/md/lg, before and after (48 images) in .rivetari/tasks/T-0013/proof/ (not pushed: upload failed: …nUZR42PKQFksBr9QKVXCPusD3OiA/RkQ5kP8qV/Jl1WywAp/6+dcmPM2zL1UrUahe4JqfnWWKXIul3uUbfP8njAFLW1OFr3gdFtZ72cNH+PtQT7/brW+NXqJAHh0y9V8/U/A1U7AfwIMAD7mS3pCbuWJAAAAAElFTkSuQmCC" /> </a> </div> </body> </html>)
- 2026-11-24 05:28 axe: 0 serious or critical violations
- 2026-11-24 05:28 visual diff: not automated yet; the before/after images are the comparison
- 2026-11-24 05:28 signed in: .rivetari/proof-auth.mjs ran on each side before its shots
- 2026-11-24 05:48 screenshots: /cloud/, /cloud/sessions/?athlete=demo-athlete&tab=sessions, /cloud/sessions/?athlete=demo-athlete&tab=plan, /cloud/session/?athlete=demo-athlete&id=s001, /cloud/session/?id=s001, /cloud/sharing/, /cloud/group/live/, /cloud/report/?athlete=demo-athlete at sm/md/lg, before and after (48 images) in .rivetari/tasks/T-0013/proof/ (not pushed: upload failed: …nUZR42PKQFksBr9QKVXCPusD3OiA/RkQ5kP8qV/Jl1WywAp/6+dcmPM2zL1UrUahe4JqfnWWKXIul3uUbfP8njAFLW1OFr3gdFtZ72cNH+PtQT7/brW+NXqJAHh0y9V8/U/A1U7AfwIMAD7mS3pCbuWJAAAAAElFTkSuQmCC" /> </a> </div> </body> </html>)
- 2026-11-24 05:48 axe: 0 serious or critical violations
- 2026-11-24 05:48 visual diff: not automated yet; the before/after images are the comparison
- 2026-11-24 05:48 signed in: .rivetari/proof-auth.mjs ran on each side before its shots

## Judge

- 2026-11-24 05:28 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 05:44 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 05:46 review round 1: request-changes; 1 blocking, 2 suggestion(s) (claude-opus-5-5) · 24039 tokens · $0.21
- 2026-11-24 05:46 blocking defect src/app/cloud/PlanTab.tsx:93 — New scroller region has the same name as the section it sits in, which adds a landmark-unique violation · repro: Load /cloud/sessions/?athlete=demo-athlete&tab=plan with an athlete whose plan has past items, so `past.length > 0` and the Earlier section renders. The <section aria-labelledby="past-h"> is a region landmark named "Earlier". The new <div className="table-scroll" role="region" aria-labelledby="past-… · fix: Give the scroller its own name, e.g. replace aria-labelledby="past-h" with aria-label="Earlier practices" (or aria-labelledby pointing to a distinct caption).
- 2026-11-24 05:46 acceptance A1: unverified — Needs the tool-produced axe screenshots. The code changes look like they address both serious rules.
- 2026-11-24 05:46 acceptance A2: unverified — Both scrollers now have tabIndex=0, role=region and a name, and the global :focus-visible should draw the outline. A manual axe, Tab and arrow-key check at 375px is still needed.
- 2026-11-24 05:46 acceptance A3: met — Both .new-dot elements dropped aria-label for an sr-only span. The span is clipped, so the dot should look the same; the screenshots confirm this.
- 2026-11-24 05:46 acceptance A4: met — The three reported pages pass level={1}. EmptyState still defaults to h2, and new tests cover both levels.
- 2026-11-24 05:46 acceptance A5: met — The 6th and 8th th now have sr-only 'Timing, exhale' and 'Depth, exhale'. The text is clipped, so the table looks the same.
- 2026-11-24 05:48 tier 1 round 2: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 05:49 review round 2: approve; 0 blocking, 3 suggestion(s) (claude-opus-5-5) · 14482 tokens · $0.14
- 2026-11-24 05:49 acceptance A1: unverified — The fixes for both serious rules are in the markup, but the proof is the axe screenshot run, which this diff doesn't include.
- 2026-11-24 05:49 acceptance A2: unverified — Both scrollers now have tabIndex=0, role=region and an aria-label. The focus outline, arrow-key scrolling and the axe result at 375px need the manual check.
- 2026-11-24 05:49 acceptance A3: met — aria-label is removed from both .new-dot elements, and 'Not opened yet' is now sr-only text inside the dot. Visual parity relies on .sr-only and still needs to be confirmed in the screenshots.
- 2026-11-24 05:49 acceptance A4: met — The three reported pages pass level={1}. EmptyState defaults to h2, and a test covers both levels.
- 2026-11-24 05:49 acceptance A5: met — The 6th and 8th th now carry sr-only 'Timing, exhale' and 'Depth, exhale'. sr-only text should leave the table's appearance unchanged.
- 2026-11-24 05:49 judge review posted: https://github.com/BreathBand/breathband-console/pull/31#pullrequestreview-6034322850
