# T-0003 · Use the coach's targets on the athlete Overview

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-23 20:20 intake: card drafted with 3 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-23 20:20 intake: intake confirmed; card sha256 6fd15d2ccdc2f220b18cf6a8a76f9f4dab07c4936fa81987dbf529235625b673 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-23 20:20 route: assembly proposed; sha256 f5561e632a99b14c855011a905c9bc69e95caaca61975fb5e84254ce88e3f7d5; skills none; proof ui-screenshots; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-23 20:20 route: route approved; assembly sha256 f5561e632a99b14c855011a905c9bc69e95caaca61975fb5e84254ce88e3f7d5 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-23 20:20 isolate: worktree .worktrees/T-0003 · branch fix/t-0003 from origin/main (4106bb1ac524) · port 5175 · db breathband_console_t0003 · env sha256 790c9945aeba100d15f5f136127a03e8f523b2f11f7dce971f999ea7ea001dcf (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 20:21 build: build started · skills spine only · budget 8 steps / 15k ctx · ~16719 prompt tokens · 8 repo file(s) in context · 158357 tokens · $0.51 · 5 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 20:23 build: build done · commit 5d4e2f3b91f9 · 6 file(s) this round · 1150380 tokens · $0.99 · 31 turns · I've made the athlete Overview use the coach's targets. Lint, typecheck and the domain tests pass. I couldn't check the static export build: `npm run build` fails in this worktree, and my changes don' (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 21:06 prove: proof passed · ui-screenshots (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 21:08 judge: judge passed · round 1 · head 5d4e2f3b91f9 · record sha256 ceb72dbf33a2034a25926beb41797964d9c225912f2d60c698fd1813b8f2e2d5 (rivetari judge (for arynbht@gmail.com))
- 2026-11-23 21:08 ship: draft PR opened: #7 https://github.com/BreathBand/breathband-console/pull/7 · fix/t-0003 at 5d4e2f3b91f9 → main (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 21:26 close: worktree removed · branch fix/t-0003 deleted (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 21:26 close: ledger sealed · merged (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-23 20:21 1. Add src/lib/domain/targets.ts with a pure helper `targetsFor(link: Pick<CoachLink, "targets"> | null | undefined): AthleteTargets` that returns the link's targets when they are present and DEFAULT_TARGETS otherwise. Import the types from ./types. Add no code comments anywhere in the diff.
- 2026-11-23 20:21 2. Add src/lib/domain/targets.test.ts (vitest, in the style of domain.test.ts). Cover four cases: a link with targets returns them, null targets returns DEFAULT_TARGETS, undefined targets returns DEFAULT_TARGETS, and a null link returns DEFAULT_TARGETS. Run it with `npm run test -- related --run src/lib/domain/targets.test.ts`.
- 2026-11-23 20:21 3. In src/app/cloud/AthleteWorkspace.tsx, add `targets: AthleteTargets` and `coachName?: string` to the Workspace interface. In the useLoad, when the athlete views their own data (self), call `backend.data.listCoaches(athleteId)`, take the first coach and call `getCoachLink(coach.uid, athleteId)`, keeping the coach's displayName. When a coach views, keep the existing getCoachLink(viewerId, athleteId). Keep `ws.link` null for the athlete so NotesTab and Header behave as now. Set `ws.targets = targetsFor(<coach link or the athlete's first-coach link>)` and `ws.coachName` for the athlete.
- 2026-11-23 20:21 4. In AthleteWorkspace's Header, replace `link?.targets ?? DEFAULT_TARGETS` with `ws.targets`. Drop the DEFAULT_TARGETS import if nothing else uses it.
- 2026-11-23 20:21 5. In src/components/charts.tsx, give RateBars `lo` and `hi` number props. Use them for the band rect, both band-edge lines and the two axis labels instead of the hard-coded 12 and 16. Rename the internal scale max (`hi`) to something like `top` so it doesn't clash, and make it `Math.max(20, hi + 4, …)` so a high band still fits. Change the hard-coded '12–16' in RateBars' doc comment to describe the given range.
- 2026-11-23 20:21 6. In src/app/cloud/AthleteOverview.tsx, call `activity(sessions, now, ws.rules, ws.targets)`. Change the caption to `br/min, shaded {ws.targets.rateLow}–{ws.targets.rateHigh}` and pass `lo={ws.targets.rateLow} hi={ws.targets.rateHigh}` to RateBars.
- 2026-11-23 20:21 7. In src/app/cloud/TrendsTab.tsx, remove the `coachTargets` useLoad and its comment. Use `const targets = ws.targets`, pass `coachName={ws.coachName}` to Targets, and remove the imports that become unused (DEFAULT_TARGETS stays because TargetsForm uses it; check useLoad and AthleteTargets).
- 2026-11-23 20:21 8. Run `npm run lint` and `npm run typecheck`, plus the related tests for targets.ts and activity.ts (`npm run test -- related --run src/lib/domain/targets.ts src/lib/domain/activity.ts`). Confirm there are no new comments or suppressions in the diff and the app still builds as a static export for the ui-screenshots proof.

## Decisions

- 2026-11-23 20:20 risk low: no high or medium signal in the touches
- 2026-11-23 20:20 routed to ui, testing, a11y: ui (touches **/*.tsx (src/app/cloud/AthleteWorkspace.tsx); "component" in the description; skill frontend-design triggers on src/components/** (src/components/charts.tsx)), testing (touches **/*.test.* (src/lib/domain/targets.test.ts); "test" in the description), a11y (skill accessibility-lead triggers on **/*.tsx (src/app/cloud/AthleteWorkspace.tsx); the profile is public-facing and the task has UI)
- 2026-11-23 20:20 under the threshold, for the approver: data, infra
- 2026-11-23 20:20 decided not in: data (scored only on description keywords)
- 2026-11-23 20:20 decided not in: infra (scored only on description keywords)
- 2026-11-23 20:20 impeccable matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-23 20:20 taste-skill matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-23 20:20 accessibility-lead left out: it requires a11y-core, which isn't available
- 2026-11-23 20:20 frontend-design matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-23 20:20 a11y: no vendored skill covers it; the agent works from the spine

## Proof

- 2026-11-23 21:06 screenshots: / at sm/md/lg, before and after (6 images) in .rivetari/tasks/T-0003/proof/ (not pushed: upload failed: is at a9d20de0161fd9d0f9d7f82e680d2f9a8b1eaabc but expected b61b2bce67d93dbf6368175f4f97d8b4b60de246 - https://docs.github.com/rest/repos/contents#create-or-update-file-contents)
- 2026-11-23 21:06 axe: 0 serious or critical violations
- 2026-11-23 21:06 visual diff: not automated yet; the before/after images are the comparison
- 2026-11-23 21:06 signed in: .rivetari/proof-auth.mjs ran on each side before its shots

## Judge

- 2026-11-23 21:07 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-23 21:08 review round 1: approve; 0 blocking, 4 suggestion(s) (claude-opus-5-5) · 15164 tokens · $0.14
- 2026-11-23 21:08 acceptance A1: unverified — The code now gives Overview's activity() the coach link's targets for the athlete (targetsFor(coach?.link)), the same value TrendsTab uses. No manual proof is attached.
- 2026-11-23 21:08 acceptance A2: unverified — The caption and RateBars band read targets.rateLow and targets.rateHigh in both views. There are no screenshots showing 10–14.
- 2026-11-23 21:08 acceptance A3: met — targets.test.ts covers link targets present, targets null/undefined/missing, and link null/undefined.
- 2026-11-23 21:08 judge review posted: https://github.com/BreathBand/breathband-console/pull/7#pullrequestreview-6029549327

## Outcome

- 2026-11-23 21:26 PR #7 merged by arynbht 2026-11-23 21:25 · 1h06m · 1324k tokens · $1.64
