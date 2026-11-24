# T-0006 · Record the Cloud Run, local-backend and console-scoring decisions in PLAN.md and README

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 00:13 intake: card drafted with 4 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 00:13 intake: intake confirmed; card sha256 e17dbe9fe1d13413a22379f135042f47e5bc87d37849f18387177df92552399b (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 00:13 route: assembly proposed; sha256 f2a46d636842561b6bab15177ef9cec8670e860feb9a227a18e0a2547c3b4d9c; skills none; proof ui-screenshots; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 00:13 route: route approved; assembly sha256 f2a46d636842561b6bab15177ef9cec8670e860feb9a227a18e0a2547c3b4d9c (rivetari runtime (autonomy review-at-pr, for arynbht@gmail.com))
- 2026-11-24 00:17 isolate: worktree .worktrees/T-0006 · branch chore/t-0006 from origin/main (7fa76ea1e1d8) · port 5175 · db breathband_console_t0006 · env sha256 040c9d714f68ec8565826148737702fcf88bf68b9d1ac3d9d9a1a97b3c483645 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:17 build: build started · fast path (low risk, 2 source file(s)): planned from the card's criteria, no plan call · budget 8 steps / 15k ctx (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:18 build: build done · commit 137fec2f6572 · 2 file(s) this round · 422343 tokens · $0.65 · 15 turns · I updated `docs/PLAN.md` and `README.md` to record the seven 2026-11-23 decisions. No other file changed, and `git status` shows only those two. I didn't run lint or tests because no code changed. (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:20 prove: proof passed · ui-screenshots (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:21 judge: judge passed · round 1 · head 137fec2f6572 · record sha256 2b3bfd64da6ebe80bb78fd6d8eafc01b9c8745d6faa343df4211115d70ef9982 (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 00:21 ship: draft PR opened: #12 https://github.com/BreathBand/breathband-console/pull/12 · chore/t-0006 at 137fec2f6572 → main (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 04:34 close: worktree removed · branch chore/t-0006 deleted (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 04:34 close: floorplan updated · 1 call(s) · 27877 tokens · $0.08 (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 04:34 close: ledger sealed · merged (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 00:17 1. A1: docs/PLAN.md has a 'Decisions' section listing decisions 1-7 as stated in the description, each dated 2026-11-23, and the rows they replace (PLAN.md:48 Firebase as target backend, :49 scores computed in the app) are marked superseded with a pointer to the new decision
- 2026-11-24 00:17 2. A2: docs/PLAN.md has a 'Cloud Run' section that replaces 'Alternative: Cloud Run instead of Firebase Hosting': local docker build and docker run -p 8080:8080, the NEXT_PUBLIC_BACKEND build arg, and the future gcloud run deploy command, marked as a step a person runs, not something CI or agents run
- 2026-11-24 00:17 3. A3: README.md documents running locally (npm run dev) and in a container (docker build -t breathband-console . then docker run -p 8080:8080 breathband-console, open http://localhost:8080/), names Cloud Run as the deploy target, and no longer presents Firebase Hosting as an active target
- 2026-11-24 00:17 4. A4: firebase/, firebase.json and every file outside docs/PLAN.md and README.md are unchanged

## Decisions

- 2026-11-24 00:13 risk low: no high or medium signal in the touches
- 2026-11-24 00:13 routed to docs, infra, ui, a11y: docs (touches **/*.md (docs/PLAN.md); "docs" in the description; "readme" in the title; skill native-writing triggers on **/*.md (docs/PLAN.md)), infra ("deploy" in the description; "docker" in the description; "dockerfile" in the description; skill terraform-skill triggers on backend), ui ("ui" in the description; "design" in the description), a11y (the profile is public-facing and the task has UI)
- 2026-11-24 00:13 under the threshold, for the approver: api, observability
- 2026-11-24 00:13 decided not in: api (scored only on description keywords)
- 2026-11-24 00:13 decided not in: observability (scored only on description keywords)
- 2026-11-24 00:13 native-writing matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 00:13 impeccable matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 00:13 frontend-design matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 00:13 terraform-skill matched but isn't available (not locked, not synced, or blocked at sync)
- 2026-11-24 00:13 infra: no vendored skill covers it; the agent works from the spine
- 2026-11-24 00:13 a11y: no vendored skill covers it; the agent works from the spine

## Proof

- 2026-11-24 00:20 screenshots: / at sm/md/lg, before and after (6 images) on the evidence branch: T-0006/
- 2026-11-24 00:20 axe: 0 serious or critical violations
- 2026-11-24 00:20 visual diff: not automated yet; the before/after images are the comparison
- 2026-11-24 00:20 signed in: .rivetari/proof-auth.mjs ran on each side before its shots

## Judge

- 2026-11-24 00:20 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 00:21 review round 1: approve; 0 blocking, 3 suggestion(s) (claude-sonnet-5-5) · 13513 tokens · $0.06
- 2026-11-24 00:21 acceptance A1: met — Decisions section lists 1-7 with the date 2026-11-23, and the two old rows are struck through with pointers to the new decisions.
- 2026-11-24 00:21 acceptance A2: met — The Cloud Run section replaces the alternative, with local docker build and run, the build arg, the gcloud command and a person-only note. Whether the Dockerfile actually has the build arg is not show…
- 2026-11-24 00:21 acceptance A3: met — README covers npm run dev, the docker build and run steps, the localhost:8080 URL and Cloud Run as the target, and says Firebase Hosting is no longer a target.
- 2026-11-24 00:21 acceptance A4: met — The diff touches only README.md and docs/PLAN.md.
- 2026-11-24 00:21 judge review posted: https://github.com/BreathBand/breathband-console/pull/12#pullrequestreview-6031687236

## Outcome

- 2026-11-24 04:34 PR #12 merged by arynbht 2026-11-24 04:34 · 4h21m · 436k tokens · $0.71
