# T-0002 · Document the current design system in DESIGN.md

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-23 18:25 intake: card drafted with 4 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-23 18:25 intake: intake confirmed; card sha256 60cbd6dd6f0377b9519615e0e4d499e1dacdaeb346d99941bf6cc3115fb3f352 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-23 18:25 route: assembly proposed; sha256 1ba6af6cbcba1fb51810831071727bd0cef8241abdb81ff43023731919e42b31; skills none; proof ui-screenshots; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-23 18:25 route: assembly proposed; sha256 1ba6af6cbcba1fb51810831071727bd0cef8241abdb81ff43023731919e42b31; skills none; proof ui-screenshots; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-23 18:26 route: route approved; assembly sha256 1ba6af6cbcba1fb51810831071727bd0cef8241abdb81ff43023731919e42b31 (arynbht@gmail.com (--yes))
- 2026-11-23 18:26 isolate: worktree .worktrees/T-0002 · branch chore/t-0002 from origin/main (4106bb1ac524) · port 5174 · db breathband_console_t0002 · env sha256 2ecd7925611deb4b79bf1d162cfd95dda27829dbcbecc0c1b6531123c504390f (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 18:26 build: build started · skills spine only · budget 12 steps / 60k ctx · 1 repo file(s) in context · 166410 tokens · $0.21 · 6 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 18:34 build: build done · commit 2d4ffb45ee7b · 1 file(s) this round · 5383260 tokens · $3.34 · 84 turns · I wrote `DESIGN.md` at the repo root, and it's the only file changed. Lint and typecheck pass, and running them left nothing else in the tree. It touches no code, so there were no related tests to run (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 21:06 prove: proof passed · ui-screenshots (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 21:21 judge: judge passed · round 1 · head 2d4ffb45ee7b · record sha256 bbf55b805aaed6b3c811f8faa2e980eaf4c2aab469849bfd955a1ca845dbdf36 (rivetari judge (for arynbht@gmail.com))
- 2026-11-23 21:21 ship: draft PR opened: #8 https://github.com/BreathBand/breathband-console/pull/8 · chore/t-0002 at 2d4ffb45ee7b → main (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-23 18:26 1. Read src/app/globals.css completely: list every custom property in :root and the @media (prefers-color-scheme: dark) override at line 108, sorted into colour, typography, spacing, radius, shadow and motion tokens, plus the prefers-reduced-motion block at line 486. Copy each name and value exactly as written.
- 2026-11-23 18:26 2. Read src/app/layout.tsx and src/app/(site)/layout.tsx to record the font families and weights loaded through next/font: IBM Plex Sans and Plex Sans Condensed for the console (--font-plex, --font-plex-condensed), and Funnel Display, Funnel Sans and Geist Mono for the site (--font-display, --font-ui, --font-mono).
- 2026-11-23 18:26 3. Read src/app/(site)/site.css: its 52 custom properties (the Carbon & Breath palette, the inhale/exhale colours, type scale, spacing, radii, shadows) and its breakpoints (359/440/600/640/720/760/959/960/1023/1024px, plus the hover, reduced-transparency and reduced-motion queries). Note any value that is hard-coded instead of using a var().
- 2026-11-23 18:26 4. Read src/app/cloud/console.css: its 12 local custom properties, the shell layout (top bar, panes, tables, tabs, buttons, badges, cards) and its breakpoints (1280/1100/960/640px and print). Search it for hex, rgb(a) and px literals that skip the globals.css tokens.
- 2026-11-23 18:26 5. Skim the other console stylesheets (src/app/cloud/auth.css, report/report.css, join/join.css, group/group.css) for their custom properties and breakpoints (auth.css uses min-width 720/900/1024/1100px and max-width 719/479/439/379px; join.css uses 760px). Record them as surface-specific values and note where they don't match console.css.
- 2026-11-23 18:26 6. Read src/components/ (charts.tsx, trendCharts.tsx, Icon.tsx, Measured.tsx, Progress.tsx, Score.tsx, States.tsx) and record what each component is for, its props and variants, and which CSS classes, tokens or inline colours it uses (e.g. the athlete chart palette that leaves out red and blue).
- 2026-11-23 18:26 7. Read src/app/(site)/_components/ (ui.tsx, SiteHeader.tsx, SiteFooter.tsx, WaitlistForm.tsx, home/HeroInstrument.tsx, useTones.ts) and the main console building blocks in src/app/cloud/ (CloudShell.tsx, auth/AuthFrame.tsx, auth/Brand.tsx, auth/fields.tsx, AthletePicker.tsx, SquadFilter.tsx). Record each shared component's purpose, variants and class names, and any inline style values.
- 2026-11-23 18:26 8. Write DESIGN.md at the repo root: a short intro covering the two surfaces (the public site '/' and the BreathCloud console '/cloud/') and how the token layers fit together, then one section each for colour tokens (with light/dark and role), typography, spacing and radius, elevation/shadows, breakpoints, and shared components. Use tables of token / value / role / source file, and name the source file in every section.
- 2026-11-23 18:26 9. Add an 'Observations' section to DESIGN.md that only states facts: where the site and console differ (fonts, palettes, breakpoint sets, radii), values hard-coded instead of using a token (with file and selector), and breakpoints that don't line up between stylesheets. Propose no changes.
- 2026-11-23 18:26 10. Check DESIGN.md against the code: grep every token name and value it cites in its named source file and fix any that don't match exactly. Also confirm that no code comments, suppressions or other Markdown were added.
- 2026-11-23 18:26 11. Run git status and git diff --stat to confirm DESIGN.md is the only changed file. It touches no code, so no tests are related, but confirm that npm run lint and npm run typecheck still pass so the judge's checks and the ui-screenshots proof run on an unchanged app.

## Decisions

- 2026-11-23 18:25 routed to ui, docs, a11y: ui ("ui" in the description; "component" in the description; "layout" in the description; "design" in the title; "redesign" in the description; "css" in the description; skill frontend-design triggers on design), docs (touches **/*.md (DESIGN.md); skill native-writing triggers on **/*.md (DESIGN.md)), a11y (the profile is public-facing and the task has UI)
- 2026-11-23 18:25 under the threshold, for the approver: data, infra
- 2026-11-23 18:25 impeccable matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-23 18:25 frontend-design matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-23 18:25 native-writing matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-23 18:25 a11y: no vendored skill covers it; the agent works from the spine
- 2026-11-23 18:25 routed to ui, docs, a11y: ui ("ui" in the description; "component" in the description; "layout" in the description; "design" in the title; "redesign" in the description; "css" in the description; skill frontend-design triggers on design), docs (touches **/*.md (DESIGN.md); skill native-writing triggers on **/*.md (DESIGN.md)), a11y (the profile is public-facing and the task has UI)
- 2026-11-23 18:25 under the threshold, for the approver: data, infra
- 2026-11-23 18:25 impeccable matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-23 18:25 frontend-design matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-23 18:25 native-writing matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-23 18:25 a11y: no vendored skill covers it; the agent works from the spine

## Proof

- 2026-11-23 21:06 screenshots: / at sm/md/lg, before and after (6 images) in .rivetari/tasks/T-0002/proof/ (not pushed: upload failed: Something went wrong on our side and we cannot service your request. Sorry about that. Please try resubmitting your request and contact us if the problem persists.)
- 2026-11-23 21:06 axe: 0 serious or critical violations
- 2026-11-23 21:06 visual diff: not automated yet; the before/after images are the comparison
- 2026-11-23 21:06 signed in: .rivetari/proof-auth.mjs ran on each side before its shots

## Judge

- 2026-11-23 21:08 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-23 21:21 review round 1: approve; 0 blocking, 3 suggestion(s) (claude-opus-5-5) · 293217 tokens · $3.68
- 2026-11-23 21:21 acceptance A1: met — DESIGN.md is new at the repo root. It has sections for colour tokens, typography, spacing and radius, elevation, breakpoints and shared components, and each section names its source files.
- 2026-11-23 21:21 acceptance A2: unverified — No source files were available, so cited names and values could not be checked against the named files. The doc is internally consistent.
- 2026-11-23 21:21 acceptance A3: met — Differences and hard-coded values are under Observations, which says "Nothing here is a request to change it". No recommendations or redesigns appear anywhere.
- 2026-11-23 21:21 acceptance A4: met — The diff adds only DESIGN.md.
- 2026-11-23 21:21 judge review posted: https://github.com/BreathBand/breathband-console/pull/8#pullrequestreview-6029728212
