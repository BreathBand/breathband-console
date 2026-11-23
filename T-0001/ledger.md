# T-0001 · Normalise Rivetari state line endings and drop the old .factory leftover

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-23 18:20 intake: card drafted with 3 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-23 18:20 intake: intake confirmed; card sha256 296ea07c7725a39e0742b4557708f5a3b8987c5cd0dfea7f93a897262fd02872 (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-23 18:20 route: assembly proposed; sha256 2317472010973d8388244eaccadc8f5a846e3c548755345ac6c7d6f4a0342658; skills none; proof test-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-23 18:20 route: assembly proposed; sha256 2317472010973d8388244eaccadc8f5a846e3c548755345ac6c7d6f4a0342658; skills none; proof test-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-23 18:20 route: route approved; assembly sha256 2317472010973d8388244eaccadc8f5a846e3c548755345ac6c7d6f4a0342658 (arynbht@gmail.com (--yes))
- 2026-11-23 18:21 isolate: worktree .worktrees/T-0001 · branch chore/t-0001 from origin/main (73ce54c4384f) · port 5174 · db breathband_console_t0001 · env sha256 562842337386424d582a1b3ce9f44b548512d3eb119204cf82bc7e485829ffa7 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 18:21 build: build started · skills spine only · budget 12 steps / 60k ctx · 2 repo file(s) in context · 98625 tokens · $0.17 · 4 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 18:21 build: build done · commit 78c7bc6bceb0 · 2 file(s) this round · 245716 tokens · $0.23 · 13 turns · I've added the line-ending rule for `.rivetari/` and removed the `.factory` leftover. Both changes are left uncommitted for the runtime to commit. (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 18:21 prove: proof deferred · test-run: the judge's tier 1 run on the change is the proof (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 18:22 prove: proof passed · test-run (the judge's tier 1 run) (rivetari runtime (for arynbht@gmail.com))
- 2026-11-23 18:22 judge: judge passed · round 1 · head 78c7bc6bceb0 · record sha256 1ba2ab71e505578b0a10844be0f45dfae5c032f9abab38a056ec631002e2d384 (rivetari judge (for arynbht@gmail.com))
- 2026-11-23 18:22 ship: draft PR opened: #6 https://github.com/BreathBand/breathband-console/pull/6 · chore/t-0001 at 78c7bc6bceb0 → main (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-23 18:21 1. Confirm the starting state with `git ls-files .factory .gitattributes`. At planning time it listed only .factory/skills.state.json, and no .gitattributes exists at the repo root.
- 2026-11-23 18:21 2. Run `git ls-files --eol .rivetari` to check that the index already holds every .rivetari/** file as `i/lf`. Then the new attribute changes only how files check out and needs no renormalization. If any show `i/crlf`, do not renormalize; note it for the person, because .rivetari/** is protected and A3 forbids other changes.
- 2026-11-23 18:21 3. Create .gitattributes at the repo root containing exactly the line `.rivetari/** text eol=lf` and a trailing newline. Add no comments and nothing else.
- 2026-11-23 18:21 4. Run `git check-attr text eol -- .rivetari/tasks/T-0001/card.yaml` (or any tracked .rivetari file) to confirm the pattern applies: text: set, eol: lf.
- 2026-11-23 18:21 5. Remove the leftover with `git rm .factory/skills.state.json`. Do not touch .rivetari/** or any other path.
- 2026-11-23 18:21 6. Check that the .factory/ directory no longer exists on disk and that `git ls-files .factory` returns nothing (A2).
- 2026-11-23 18:21 7. Run `git status --porcelain` and check that the only changes are `A .gitattributes` and `D .factory/skills.state.json`. In particular, no .rivetari files may show as modified after the attribute is added (A3). Never use `git add --renormalize`.
- 2026-11-23 18:21 8. Skip the related tests: neither changed file is source code, so nothing in vitest's related set covers them. The judge's full test-run proof runs unaffected on the clean clone.
- 2026-11-23 18:21 9. Commit both changes on branch chore/t-0001 with a chore message that names F2 and Bug 17 and ends with the required Co-Authored-By line.

## Decisions

- 2026-11-23 18:20 routed to no sector: nothing in the card or its paths matched one; the agent works from the spine
- 2026-11-23 18:20 under the threshold, for the approver: infra
- 2026-11-23 18:20 routed to no sector: nothing in the card or its paths matched one; the agent works from the spine
- 2026-11-23 18:20 under the threshold, for the approver: infra

## Proof

- 2026-11-23 18:22 tests passed (npm test, exit 0, in the judge's tier 1 run on the change) · new tests: none
- 2026-11-23 18:22 output: …[2m17 tests[22m[2m)[22m[32m 19[2mms[22m[39m [32m✓[39m src/lib/backend/local/local.test.ts [2m([22m[2m27 tests[22m[2m)[22m[32m 73[2mms[22m[39m [2m Test Files [22m [1m[32m2 passed[39m[22m[90m (2)[39m [2m Tests [22m [1m[32m44 passed[39m[22m[90m (44)[39m [2m Start at [22m 13:22:21 [2m Duration [22m 215ms[2m (tests 60%, import 20%, transform 15%, worker 4%)[22m
- 2026-11-23 18:22 evidence: the judge's test run on the evidence branch: https://github.com/BreathBand/breathband-console/blob/evidence/T-0001/test-run.txt?raw=true

## Judge

- 2026-11-23 18:22 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-23 18:22 review round 1: approve; 0 blocking, 1 suggestion(s) (claude-opus-5-5) · 8940 tokens · $0.07
- 2026-11-23 18:22 acceptance A1: met — New root .gitattributes contains exactly the line '.rivetari/** text eol=lf'.
- 2026-11-23 18:22 acceptance A2: met — .factory/skills.state.json is deleted. The card says it was the only tracked file under .factory/ after PR #4 removed .factory/.gitignore, so .factory/ no longer exists.
- 2026-11-23 18:22 acceptance A3: met — The diff touches only .gitattributes (added) and .factory/skills.state.json (deleted). No protected path is touched.
- 2026-11-23 18:22 judge review posted: https://github.com/BreathBand/breathband-console/pull/6#pullrequestreview-6027144212
