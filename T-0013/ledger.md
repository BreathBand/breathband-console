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

## Judge

- 2026-11-24 05:28 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
