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
