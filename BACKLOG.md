# Backlog

Two lists. I order "Next up". Sessions park into their card's "Parked" and never edit this file; the merger appends those lines to "Parked" here on the integration branch.

The checklist is in [CHECKLIST.md](CHECKLIST.md).

## Next up

Ordered. The top line becomes the next `CARD.md`.

1. Protect main: require CI's `check` and a review before merge, no force-push (needs a GitHub plan that allows protection on a private repo: billing, needs you) · from checklist `repo.branch-protection`, `quality.required-checks.named`, `dev.code-review-required`, `ci.required-aggregator`
2. Secret scanning: gitleaks on every PR in CI, and before commit (CI and agent config, needs you) · from checklist `ci.secret-scan-on-pr`, `sec.secret-scanning.ci`, `sec.secret-scanning.pre-commit`, `sec.push-protection`
3. Harden the CI workflow: declare token `permissions`, pin actions by SHA, add `timeout-minutes` and PR-only `concurrency` (CI config, needs you) · from checklist `ci.workflow-permissions`, `ci.actions-pinned-sha`, `ci.job-timeouts`, `ci.concurrency`, `ci.concurrency-pr-only`
4. Dependency vulnerability scan in CI (`npm audit` or dependency review) (CI config, needs you) · from checklist `sec.dependency-scan.ci`
5. Privacy policy and terms pages covering health data · from checklist `legal.privacy.policy`, `legal.terms.published`; `docs/PLAN.md` Phase 2 and Phase 6
6. Send a Content-Security-Policy and HSTS from `nginx.conf` · from checklist "The served site sends a Content-Security-Policy and HSTS"
7. Write the production deploy down as a repeatable step: Cloud Run service as code or a scripted deploy, region (D6), environments · from checklist "The production deploy is written down and repeatable", `cloud.iac-present`
8. Error tracking and an uptime check on `/` and `/cloud/login/`, with alerts to a monitored inbox (a dependency, needs you) · from checklist `ops.telemetry-exported`; `docs/PLAN.md` 4b.7 and Phase 6
9. A real backend behind the `http` adapter, so accounts, sessions and the waitlist leave the visitor's browser · from checklist "The console stores data in a real backend"; `docs/PLAN.md` decision 2
10. Backups, RPO/RTO and a restore drill, once a datastore exists · from checklist `cloud.rpo-rto-documented`, `cloud.backups-restore-tested`, `data.backup-restore-drill`
11. GCP billing budget alert and a least-privilege review of the project and service account · from checklist `cloud.cost-budget-alert`, `cloud.least-privilege-iam`
12. SECURITY.md with a disclosure contact · from checklist `repo.security-policy.present`
13. Lint: unused vars at `error`, plus `complexity` and `max-lines` limits (lint config, needs you) · from checklist "Lint fails on unused code", "Complexity and file-length limits are set"
14. knip as a `package.json` script and in CI (a dependency and CI config, needs you) · from checklist "A dead-code check runs"
15. Formatter, `.editorconfig`, pre-commit hooks and commitlint (dependencies and agent config, needs you) · from checklist `dev.formatter.configured`, `repo.editorconfig.present`, `dev.precommit-hooks`, `dev.conventional-commits`
16. CONTRIBUTING.md and a `docs/` layout (tutorials, how-to, reference, explanation) · from checklist `repo.contributing.present`, `docs.diataxis-layout`
17. Enforce "screens never import an adapter" with a lint rule (lint config, needs you) · from checklist `quality.boundaries.clean`
18. Vitest coverage config and a floor · from checklist `test.coverage-config`, `quality.coverage.floor`
19. Run the Playwright e2e suite and axe checks in CI (CI config, needs you) · from checklist "End-to-end tests run in CI", `a11y.ci.automated-checks`
20. State the WCAG 2.2 AA target in `DESIGN.md` and publish an accessibility statement · from checklist `a11y.target.stated`, `a11y.statement.published`
21. Account deletion and "download my data" in account settings · from `docs/PLAN.md` 3.6
22. Email verification banner after sign-up · from `docs/PLAN.md` 3.1
23. Honeypot spam protection on the waitlist form · from `docs/PLAN.md` Phase 2 "Technical work"
24. Performance budgets, a bundle-size budget and Lighthouse CI (CI config, needs you) · from checklist `perf.budgets-defined`, `perf.bundle-size-budget`, `perf.lighthouse-ci`
25. SLOs, runbooks and a postmortem template · from checklist `ops.slos-defined`, `docs.runbooks-dir`, `ops.runbook-per-alert`, `ops.postmortem-template`
26. Write the caching strategy down · from checklist `perf.caching-strategy`
27. CHANGELOG.md, automated with releases · from checklist `docs.changelog-present`, `ci.changelog-automated`
28. Docs-only PRs skip build and test (CI config, needs you) · from checklist `ci.docs-skip-build`
29. Risk register, and a go/no-go on the Phase 6 launch checklist · from checklist `product.risk.register`, `product.launch.checklist`
30. Third-party license summary · from checklist `legal.license-summary`
31. C4 context and container diagrams · from checklist `docs.c4-diagrams`
32. SBOM and SAST (CodeQL or Semgrep) in CI (CI config, needs you) · from checklist `sec.sbom.ci`, `sec.sast.ci`

## Parked

Anything noticed while working on something else. One line, no fixing.
Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`
A `[checklist]` line proposes a line for `CHECKLIST.md`.

- 2026-11-26 [tool] `AGENTS.md`, still included by `CLAUDE.md` through `@AGENTS.md`, tells every agent to run `rivetari doctor` and start each task with `/rivetari`, which the kit's "How work is done here" replaces · seen on /setup · `AGENTS.md`
- 2026-11-26 [tool] Open PR #43 "chore: remove Rivetari" removes what the owner chose to keep as an archive (`.rivetari/`, AGENTS.md, the skills lock) · seen on /setup · `gh pr view 43`
- 2026-11-26 [tool] `CONSTRAINTS.md` has no `## Slop` section; the kit's is in `CONSTRAINTS.kit.md` for the owner to merge, and until then `deslop` uses its own defaults · seen on /setup · `CONSTRAINTS.md`
- 2026-11-26 [tool] A local `npm run lint` fails with 151 problems from generated `.next/types` in `.claude/worktrees/`, because `eslint.config.mjs` doesn't ignore `.claude/**` · seen on /setup · `eslint.config.mjs`
- 2026-11-26 [product] The `add_header` lines inside `location /_next/static/` replace the server-level ones, so those responses drop Referrer-Policy and X-Frame-Options · seen on /setup · `nginx.conf`
- 2026-11-26 [product] "full breath" is any peak >= 35 % of the biggest swing in the window, so ordinary resting breaths count too; whether calibration should insist on depth waits on Harry's reference choice · seen on T-0101 · src/lib/analysis/calibrationProgress.ts
- 2026-11-26 [product] "the band comes off" is only known from a disconnect or the athlete's button; no off-body detection from the signal · seen on T-0101 · src/app/cloud/record/live/page.tsx
- 2026-11-26 [tool] the sqld image `libsql-server:v0.24.32` has no curl or wget, so any health probe needs bash `/dev/tcp` · seen on T-0102 · docker-compose.yml
- 2026-11-26 [product] No terms-of-use or privacy pages exist to link from the sign-up checkboxes · seen on T-0103 · src/app/(site)
- 2026-11-26 [product] Seeded demo accounts have no `consents`/`birthYear`; existing accounts need a re-consent path when versions change · seen on T-0103 · src/lib/backend/local/seed.ts
- 2026-11-26 [product] Spec D1's role choice ("For myself" / "I work with people", proKind) not done; sign-up still offers Athlete / Coach · seen on T-0103 · src/app/cloud/signup/page.tsx
- 2026-11-26 [tool] `npm audit` reports 4 moderate advisories (esbuild <=0.24.2 via drizzle-kit's @esbuild-kit loaders, dev-only); fix needs a drizzle-kit major · seen on T-0104 · `npm audit`
- 2026-11-26 [tool] on Windows libSQL keeps a file DB open until the process exits, so the schema test leaves its temp DB in %TEMP% (cleanup is best effort) · seen on T-0104 · server/db/schema.test.ts
- 2026-11-26 [product] DESIGN.md's Home row ("four stats; the 8-week score trend") no longer describes the per-goal Home; update it to mention Train / Focus / Calm and the professional's card · seen on T-0105 · DESIGN.md
- 2026-11-26 [tool] e2e/auth.ts only exports Alex and Lena sign-ins; the new spec signs in as Maya by clicking her demo card directly · seen on T-0105 · e2e/home-per-goal.spec.ts
- 2026-11-26 [product] Settings can't edit the goal answers, minutes a day or reminders, yet the welcome sidebar says "Everything here can be changed later in Settings." · seen on T-0106 · src/app/cloud/account/Preferences.tsx
- 2026-11-26 [product] Nothing reads `goalDetails`, `dailyMinutes` or `reminders` yet (Home ring, exam countdown, programs, reminder sending, mood check-in) · seen on T-0106 · planning/v1/02-onboarding-and-tailoring.md §5.1
- 2026-11-26 [product] The HTTP backend/server (lane 1) must accept and validate the new preference fields the same way (`goalPlanProblem`) · seen on T-0106 · src/lib/backend/http
- 2026-11-26 [product] The Flutter app must keep `goalDetails`, `dailyMinutes`, `reminders` when it writes preferences, or it will drop them · seen on T-0106 · ../breathband
- 2026-11-26 [product] Exam dates are personal (spec §7) and linked coaches can read the whole profile, preferences included · seen on T-0106 · src/lib/backend/local/index.ts getProfile
- 2026-11-26 [product] `verification` rows are keyed by email, not user id, so deleting an account leaves them to expire; the account-deletion route should delete them by identifier · seen on T-0107 · server/db/schema/auth.ts
- 2026-11-26 [product] Focus's mood change on the results (§5.1) needs the mood before/after data (J6); the results have no seam for it yet · seen on T-0108 · src/app/cloud/results/tone.ts
- 2026-11-26 [product] Train's results row asks for a CSV; there is no per-session CSV of the per-turn table yet (01 §3.6 CSV row) · seen on T-0108 · src/app/cloud/session/SessionReview.tsx
- 2026-11-26 [product] The clinician line ("Lena will see this before your next visit") is built and tested but not wired to the screens: `professionalOf` reads every link as a coach until `proKind` exists, so no caller passes a clinician yet · seen on T-0108 · src/app/cloud/home/tailor.ts
- 2026-11-26 [product] The copy in results/tone.ts wants the M6 wellness-wording review · seen on T-0108 · src/app/cloud/results/tone.ts
- 2026-11-26 [product] Home should show the sample person (or link to /cloud/welcome/sample/) and a "Set up your band" card when `preferences.onboarding` is "none"/"app" · seen on T-0109 · src/app/cloud/AthleteHome.tsx
- 2026-11-26 [product] /cloud/device/ has its own Bluetooth wording; switch it to `supportAdvice()` from src/lib/device/support.ts so both screens say the same · seen on T-0109 · src/app/cloud/device/page.tsx
- 2026-11-26 [product] The http backend/server should validate `preferences.onboarding` with `onboardingProblem` as the local adapter does · seen on T-0109 · server/**
- 2026-11-26 [product] `api:start` runs through `tsx` (a devDependency); the production image (I-13) needs either tsx in dependencies or a compiled build, and Cloud Run sets `PORT`, not `API_PORT` · seen on T-0110 · package.json
- 2026-11-26 [product] `npm audit`: 4 moderate (esbuild <=0.24.2 under drizzle-kit, dev only), present before this card · seen on T-0110 · `npm audit`
- 2026-11-26 [product] behind Cloud Run's front end `X-Forwarded-For` has two hops, which Better Auth won't trust without `advanced.ipAddress.trustedProxies`/`ipAddressHeaders`; until set, all clients share one sign-in bucket (5/min for everyone) · seen on T-0111 · server/auth.ts (I-16)
- 2026-11-26 [product] rate limits are in memory per instance; more than one Cloud Run instance multiplies them (Better Auth's `database` storage needs a `rateLimit` table) · seen on T-0111 · server/auth.ts
- 2026-11-26 [product] A "how the link was made" field on `CoachLink` (`via: invite | code`), wanted by T-0105's "invited by a professional" card, is not approved · seen on T-0112 · src/lib/domain/types.ts
- 2026-11-26 [product] Server `pro_profiles` has no `level`, `country` or `sport_other`; the HTTP backend must validate `proKind` / `proProfile` with `proProblem` and refuse them for athletes · seen on T-0112 · server/db/schema/people.ts
- 2026-11-26 [product] Coach UI pages and emails still say "athletes"; K5 should use `peopleNouns()` / `countPeople()` from src/lib/domain/terminology.ts · seen on T-0112 · src/app/cloud/athletes
- 2026-11-26 [product] Sign-up still offers Athlete / Coach, not "For myself / I work with people", and the site's "For coaches / clinicians / educators" pages can't preselect the kind (spec §2) · seen on T-0112 · src/app/cloud/signup/page.tsx
- 2026-11-26 [product] Professional answers are saved only at Finish, not after each step (spec §1.7 resumable), and Settings can't edit them · seen on T-0112 · src/app/cloud/welcome/page.tsx
- 2026-11-26 [product] The demo coach (Lena Vos) has no `proKind` / `proProfile` in the seed · seen on T-0112 · src/lib/backend/local/seed.ts
- 2026-11-26 [product] T-0105's `professionalOf()` reads any linked coach as kind "coach"; it could read the professional's `proKind` now, if an athlete may read it · seen on T-0112 · src/app/cloud/home/tailor.ts
- 2026-11-26 [product] The Flutter app must keep `proKind` / `proProfile` when it writes the user document · seen on T-0112 · ../breathband
- 2026-11-26 [product] Calm's greeting line could carry the paused copy (today it says "Your next session takes three minutes." while the week card says paused) · seen on T-0113 · src/app/cloud/home/tailor.ts calmLine
- 2026-11-26 [product] Milestones are "collected in Programs" (breathband-docs gamification.md): no place lists past milestones yet · seen on T-0113 · src/app/cloud/home/Milestones.tsx
- 2026-11-26 [product] on http, sign-up resolves without a session (email must be confirmed), but `/cloud/signup` stays busy waiting for CloudShell's redirect; it needs a "check your email" state · seen on T-0114 · src/app/cloud/signup/page.tsx
- 2026-11-26 [product] on http, an unconfirmed sign-in shows "Couldn't sign in. Check your connection" (login only special-cases `invalid-credentials`/`invalid-email`) · seen on T-0114 · src/app/cloud/login/page.tsx
- 2026-11-26 [product] the reset link lands on `/cloud/reset/?token=…`, but the page only requests a link; it needs the "choose a new password" step (POST /api/auth/reset-password), and `AuthService` has no method for it · seen on T-0114 · src/app/cloud/reset/page.tsx, src/lib/backend/types.ts
- 2026-11-26 [product] `AuthService` has no "resend confirmation email" method (Better Auth: POST /api/auth/send-verification-email); today an unconfirmed sign-in attempt resends · seen on T-0114 · src/lib/backend/types.ts
- 2026-11-26 [product] Default flags per kind (E6/§4.1 step 7) are built but unwired: `src/lib/domain/default-flags.ts` waits on `getAlertRules` saying "nothing saved" (see Questions; `pro_profiles.default_flags` exists server-side) · seen on T-0116 · src/lib/backend/local/index.ts getAlertRules
- 2026-11-26 [product] Compare CSV header still says "Athlete" for every professional · seen on T-0116 · src/lib/domain/csv.ts compareCsv
- 2026-11-26 [product] Two-person recording (`record/duo`) and the open-session note in SessionReview ("the athlete tapped") still say athlete to a professional · seen on T-0116 · src/app/cloud/record/duo, src/app/cloud/session/SessionReview.tsx
- 2026-11-26 [product] The role label under the name (sidebar) and "Account type" in Settings say "Coach" for a clinician or educator · seen on T-0116 · src/app/cloud/CloudShell.tsx, src/app/cloud/account/page.tsx
- 2026-11-26 [product] Athlete-facing copy names the coach's page "Athletes" ("They enter it on their Athletes page") whatever the professional calls it · seen on T-0116 · src/app/cloud/settings/SharingPanel.tsx
- 2026-11-26 [product] Emails (E4 "and emails") still use fixed wording; server digests should read `pro_profiles.terminology` · seen on T-0116 · server/**
- 2026-11-26 [tool] `npm run lint` lints `playwright-report/` after an e2e run (133 errors) because eslint.config.mjs doesn't ignore it; delete the folder before `npm run check` · seen on T-0116 · eslint.config.mjs
- 2026-11-26 [product] `preferencesProblem` doesn't refuse unknown top-level keys, so a client can store arbitrary extra JSON in `profiles.preferences` (local and API alike) · seen on T-0117 · src/lib/domain/preferences.ts
- 2026-11-26 [product] the local adapter's `getWaveform` falls back to a generated signal for any session, so a deleted session's waveform still "exists" on local; the API answers not-found · seen on T-0117 · src/lib/backend/local/index.ts
- 2026-11-26 [product] seeded/demo sessions on http have no stored blobs until I-12's seed writes them through `StorageService` · seen on T-0117 · server/db/seed.ts (I-12)
- 2026-11-26 [product] Invites and "set practice" don't read `proProfile.scopeRequested`, `defaultTargets` or the templates yet (coach UI) · seen on T-0118 · src/lib/domain/pro-defaults.ts, pro-templates.ts
- 2026-11-26 [product] The consent and proProfile checks in `firebase/firestore.rules` have never run against the emulator · seen on T-0118 · firebase/firestore.rules
- 2026-11-26 [product] The saved session review (`/cloud/session/`) doesn't show the mood change yet; the live results do · seen on T-0119 · src/app/cloud/session/SessionReview.tsx
- 2026-11-26 [product] No Settings switch for the mood check-in after onboarding (J7 territory) · seen on T-0119 · src/app/cloud/account/**
- 2026-11-26 [product] Demo plan says Sam is Focus with an exam on 15 Dec; the seed has Sam on Train and Maya on Focus with no exam date · seen on T-0119 · src/lib/backend/local/seed.ts, planning/v1/05-demo-plan.md
- 2026-11-26 [product] Focus Home's study-day strip is still a seam · seen on T-0119 · src/app/cloud/home/FocusSlots.tsx
- 2026-11-26 [product] A professional's own recorded session (try it yourself) can't be found again after its session page; "My practice" (E15) would list them · seen on T-0120 · src/app/cloud/CloudShell.tsx coach nav
- 2026-11-26 [product] The dashboard's "No clients yet" card still says people create a code under Sharing; with link and QR invites it could lead with the invite · seen on T-0120 · src/app/cloud/CoachDashboard.tsx
- 2026-11-26 [product] `DataService.saveSession` is documented "Athletes only", but professionals now record their own sessions (the local adapter and firestore rules already allow anyone on their own data) · seen on T-0120 · src/lib/backend/types.ts
- 2026-11-26 [product] the local adapter's `markSessionSeen` accepts any key (no link, no session check) while the API refuses both · seen on T-0121 · src/lib/backend/local/index.ts
- 2026-11-26 [product] an athlete can't list or withdraw invites they've made (no DataService method; `invites.status` has "revoked" unused) · seen on T-0121 · src/lib/backend/types.ts
- 2026-11-26 [product] an athlete stays in a coach's squads after revoking the link (local and API alike) · seen on T-0122 · server/routes/squads.ts
- 2026-11-26 [product] athletes can't point a saved session at a group session yet (`saveSession` stores `groupSessionId: null`), so group results and average stay empty on http until the realtime card · seen on T-0122 · server/routes/sessions.ts
- 2026-11-26 [product] the waitlist route has no rate limit · seen on T-0122 · server/routes/waitlist.ts
- 2026-11-26 [product] Home should lead with "From Aoife" until the first assignment is done (§3.5) · seen on T-0123 · src/app/cloud/AthleteHome.tsx
- 2026-11-26 [product] Clinician invites should turn streak-at-risk reminders off by default (§3.5) · seen on T-0123 · src/app/cloud/welcome/page.tsx
- 2026-11-26 [product] The server's coach invites (when they land) need `practice` stored, kind/profession/scope in the lookup, and the assignment created on accept · seen on T-0123 · server/routes/coaching.ts
- 2026-11-26 [product] Reloading /cloud/join/ after accepting but before finishing onboarding shows "You already share" with "Go to your sessions", which lands on onboarding without the invite prefill · seen on T-0123 · src/app/cloud/join/page.tsx
- 2026-11-26 [product] §4.4 says the invite page repeats the 16+ age gate for educators; sign-up gates it, the join page doesn't repeat it · seen on T-0123 · src/app/cloud/join/page.tsx
- 2026-11-26 [checklist] `src/lib/backend/http/README.md` still describes coach invites without practice and the lookup's new fields · seen on T-0123 · src/lib/backend/http/README.md
- 2026-11-26 [product] The demo seed (server/db/seed/rows.ts) maps local coach invites without `practice`; harmless today (the seed has none) but would drop one if added · seen on T-0123 · server/db/seed/rows.ts
- 2026-11-26 [product] Accepting a coach invite on the server claims the invite, writes the link, then the assignment, with no transaction: a failure between leaves the invite accepted without the assignment (the link write had the same gap before) · seen on T-0123 · server/routes/coach-invites.ts
- 2026-11-26 [product] The instrument ignores `program`/`day` in its query string: name "Foundations · Day 1" in its bar and on the results · seen on T-0124 · src/app/cloud/record/live/page.tsx
- 2026-11-26 [product] With the http adapter `useAuth().profile` is never refreshed after `updateProfile` (the local adapter's listeners refresh it), so other screens that save from it can still write stale data · seen on T-0124 · src/lib/backend/BackendProvider.tsx, src/lib/backend/http/auth.ts
- 2026-11-26 [product] The server types `gamification` as `Record<string, boolean>`; it holds `awarded` and `program` objects · seen on T-0124 · server/db/schema/people.ts
- 2026-11-26 [product] No way to leave or restart a program · seen on T-0124 · src/app/cloud/home/ProgramCard.tsx
- 2026-11-26 [product] Seeded "today" sessions can start later than now (hours 6-20), so they're in the future early in the morning · seen on T-0124 · src/lib/backend/local/seed.ts
- 2026-11-26 [product] Demo-plan people Ana Ruiz, Jordan Lee, Chris Park (and Sam's exam / Maya's Calm track from 05-demo-plan) aren't in the local seed yet, so not in the DB seed either · seen on T-0125 · planning/v1/05-demo-plan.md
- 2026-11-26 [product] On Turso, waveforms are written to the seeding machine's STORAGE_DIR; another machine reading the same DB won't find them until it runs db:seed (which restores missing demo blobs) · seen on T-0125 · server/db/seed/write.ts
- 2026-11-26 [product] the "account deleted" email and the spec's "confirm by email" are not sent: needs a mailer template (L2) and the mailer in DataDeps · seen on T-0126 · server/mailer.ts
- 2026-11-26 [product] "Download my data" CSV of sessions (01 §3.1) not built; the JSON export is built in memory (up to 5 MB per waveform), stream it for large accounts · seen on T-0126 · server/routes/account-export.ts
- 2026-11-26 [product] while an account waits for deletion, routes that don't name the person still show their id: a group session's `athleteIds`, a coach's squad members; a pending coach's group session stays readable by its athletes · seen on T-0126 · server/routes/group.ts, squads.ts
- 2026-11-26 [product] `/coach-invites/{code}` (read, respond) still works for an invite from a coach whose account waits for deletion: the coach is found by looking the code up, not in the path · seen on T-0126 · server/routes/coach-invites.ts
- 2026-11-26 [product] `POST /account/delete` checks the password with no rate limit of its own (Better Auth's limits cover /api/auth only) · seen on T-0126 · server/routes/account.ts
- 2026-11-26 [product] a coach invite sent to a deleted person by contact (email) stays with the coach (`coach_invites.contact`), as the coach's record · seen on T-0126 · server/db/schema/coaching.ts
- 2026-11-26 [product] Home's Milestones card marks a milestone shown the first time it renders, so Maya's waiting "Seven days in a row" is spent on the first sign-in in a browser (a rehearsal uses it up); the demo laptop needs a fresh local DB (clear site data) before the real run, or a "reset demo" action (U3). · seen on T-0127 · cards/done/T-0127.md
- 2026-11-26 [product] Seed-time dates go stale in a long-lived browser: Sam's check-ins fall out of the 14-day mood window, the exam date passes, Maya's streak breaks, Jordan's plan runs out. The seed is placed relative to the day it was made; a reseed (or a "reset demo") refreshes them. · seen on T-0127 · cards/done/T-0127.md
- 2026-11-26 [product] Better Auth warns it can't find the client IP, so rate limiting shares one bucket; behind Cloud Run set `advanced.ipAddress.ipAddressHeaders` (x-forwarded-for) · seen on T-0128 · server/auth.ts
- 2026-11-26 [product] docs/PLAN.md decision 1 and its "Cloud Run" section, and the next.config.ts comment, still describe the nginx image · seen on T-0128 · docs/PLAN.md, next.config.ts
- 2026-11-26 [product] .env.example doesn't mention PORT (the production fallback for Cloud Run) · seen on T-0128 · .env.example
- 2026-11-26 [product] `--profile full` has no demo seed: db:seed runs through tsx and isn't in the image; a compiled seed entry in build:server would let the demo use the full profile · seen on T-0128 · server/db/seed.ts
- 2026-11-26 [product] the image is 292 MB, most of it the node:22-alpine base (node binary 124 MB, npm 18 MB); this card's layers are ~38 MB, and libsql ships both its musl and gnu binaries · seen on T-0128 · docker image ls
- 2026-11-26 [product] the invite lookup limits are in memory per instance (more Cloud Run instances multiply them) and `clientIp` trusts 1 X-Forwarded-For hop; behind a load balancer too it must be 2, or every client shares one bucket; make it an env setting with the deploy (I-16, as T-0111's) · seen on T-0129 · server/rate-limit.ts
- 2026-11-26 [product] per-IP limits treat each IPv6 address separately; a client with a /64 can rotate addresses (key IPv6 by /64) · seen on T-0129 · server/rate-limit.ts
- 2026-11-26 [product] the signed-in `getCoachInvite` still returns kind, profession, scope, practice and status for revoked, declined and expired invites (T-0123 review); the public lookup doesn't · seen on T-0129 · server/routes/coach-invites.ts, src/lib/backend/local/index.ts
- 2026-11-26 [product] the waitlist route could use `server/rate-limit.ts` now (T-0122 question) · seen on T-0129 · server/routes/waitlist.ts
- 2026-11-26 [product] signed out, the "isn't available" message can't say "Ask Lena for a new link" (§6) without naming the professional for a used code; signed in it still does · seen on T-0129 · src/app/cloud/join/PublicJoin.tsx
- 2026-11-26 [product] A clinician's comment shows "· coach" after her name to her client (E4) · seen on T-0131 · src/app/cloud/session/SessionReview.tsx
- 2026-11-26 [product] A clinician's client sees "From your coach" above the practice on New session (E4) · seen on T-0131 · src/app/cloud/record/page.tsx
- 2026-11-26 [product] Jordan's Home band card offers "Start Open · 3 min" while Ana's practice is Paced 5-5 · 5 min · seen on T-0131 · src/app/cloud/AthleteHome.tsx
- 2026-11-26 [product] Results round an open session's rate to a whole breath (14 br/min) while the review shows 13.9 · seen on T-0131 · src/app/cloud/record/live/Results.tsx
- 2026-11-26 [product] After a 0:37 Calm session, results and Home say "Done for today. Nice." while Today shows "0 of 3 min" · seen on T-0131 · src/app/cloud/results/tone.ts
- 2026-11-26 [product] A Calm individual with no professional (Maya, a new Calm user) sees an empty "From your coach" panel on Home · seen on T-0131 · src/app/cloud/AthleteHome.tsx
- 2026-11-26 [product] Lena's squads are Juniors and Sprint squad, not the plan's "Rowing 1st VIII" (U2) · seen on T-0131 · src/lib/backend/local/seed.ts
- 2026-11-26 [checklist] 03's statuses are stale: D3-D6, E1-E10, J3, J5, J6 say Missing or Partial but are built · seen on T-0131 · planning/v1/03-launch-checklist.md
- 2026-11-26 [tool] `npm run preview` fetches serve@14.2.4 through npx, so the first run needs the network (U3) · seen on T-0131 · package.json
- 2026-11-26 [tool] Stopping a background `npm run dev` left next's start-server child listening on the port; killed it by PID · seen on T-0131 · npm run dev -- --port 3203
- 2026-11-26 [tool] Mailpit in CI as a `services:` container plus `MAILPIT_E2E=1` for `server/auth.mailpit.test.ts`: about +1 min (image pull, one test file) · seen on T-0132 · .github/workflows/ci.yml
- 2026-11-26 [tool] Playwright e2e in CI (`npx playwright install --with-deps chromium`, 18 specs on the static build): estimate +4 to 7 min; `docker:smoke` on the production image another +3 to 5 min · seen on T-0132 · .github/workflows/ci.yml
- 2026-11-26 [tool] CI triggers on pushes to `main` and on PRs only: pushes to `night/*` or `develop` run nothing until a PR is opened · seen on T-0132 · .github/workflows/ci.yml
- 2026-11-26 [tool] `npm ci` reports audit findings (`npm audit`); not looked at · seen on T-0132 · npm ci
- 2026-11-26 [product] Better Auth's own limiter still reads the leftmost X-Forwarded-For (client-forgeable without a proxy) and ignores TRUSTED_PROXY_HOPS; set `advanced.ipAddress` (ipAddressHeaders/trustedProxies) to match (auth config, needs approval; I-16) · seen on T-0133 · server/auth.ts
- 2026-11-26 [product] the request log also writes Better Auth's `?token=` values (email verification, password reset links) in plaintext; redact them like invite codes · seen on T-0133 · server/index.ts
- 2026-11-26 [product] `POST /coaches/:id/invites/redeem` (an athlete's invite code, in the body) has no API limit of its own; give it the per-person budget too · seen on T-0133 · server/routes/coaching.ts
- 2026-11-26 [product] docker-compose.yml's `full` profile and docs/PLAN.md#cloud-run don't mention TRUSTED_PROXY_HOPS (0 is right for compose; the Cloud Run deploy must set it) · seen on T-0133 · docker-compose.yml, docs/PLAN.md
- 2026-11-26 [product] sync .env.example with docs/deploy.md: add PORT, state the TRUSTED_PROXY_HOPS counts as expected-not-confirmed, settle NEXT_PUBLIC_API_URL vs NEXT_PUBLIC_API_BASE_URL · seen on T-0134 · .env.example
- 2026-11-26 [product] `src/app/cloud/CloudShell.tsx` imports `@/lib/backend/local/db` (the sidebar Reset), a second exception to "screens never import an adapter" that the house rules don't name · seen on T-0134 · src/app/cloud/CloudShell.tsx
- 2026-11-26 [product] `server/storage/index.ts` comment says the Cloud Storage driver "comes later (I-16)"; it is now a stub in gcs.ts · seen on T-0134 · server/storage/index.ts
- 2026-11-26 [product] two fail-closed buckets remain: `clientIp` keys a missing socket as "unknown", `addressKey` keys garbage as "invalid"; harmless, but could be one · seen on T-0135 · server/rate-limit.ts
- 2026-11-26 [product] the reset token also reaches the browser as `/cloud/reset/?token=` (history, any third-party script on that page); consider moving it to the fragment or stripping it with history.replaceState once read · seen on T-0135 · the reset page (I-07)
- 2026-11-26 [tool] the bash heredoc → python path halved backslashes when writing tests (wrote a raw ESC and newline); fixed by hand · seen on T-0135 · shell
- 2026-11-26 [product] Login page shows "Couldn't sign in. Check your connection" for a 429 on http instead of "Too many attempts" · seen on T-0136 · src/app/cloud/login/page.tsx
- 2026-11-26 [product] docs/deploy.md still lists `NEXT_PUBLIC_API_URL` as an open naming question; `.env.example` now has only `NEXT_PUBLIC_API_BASE_URL` · seen on T-0136 · docs/deploy.md
- 2026-11-26 [product] `e2e/demo-script.spec.ts` doesn't walk DEMO.md's new step 13 (Aoife's invite opened signed out in the same window) · seen on T-0136 · e2e/demo-script.spec.ts
- 2026-11-26 [tool] Stopping a background `npx serve` task left its node process listening on 3201; killed it by PID · seen on T-0136 · npx --yes serve@14.2.4 out -l 3201
- 2026-11-26 [product] The results screen still says "Done for today. Nice." after a session shorter than the ring's minutes (DEMO part 3 step 13) · seen on T-0137 · src/app/cloud/results/tone.ts
- 2026-11-26 [product] A clinician's comment still shows "· coach" to her client: comments carry `authorRole` only, so the tag needs the author's kind (E4) · seen on T-0137 · src/app/cloud/session/SessionReview.tsx
- 2026-11-26 [product] A clinician's or teacher's client still sees "From your coach" as the Sessions tab label and the overview's practice heading (E4) · seen on T-0137 · src/app/cloud/AthleteWorkspace.tsx, src/app/cloud/AthleteOverview.tsx
- 2026-11-26 [tool] home-per-goal's 375 px "never scrolls sideways" check failed 3 times in about 16 runs while other specs ran in parallel; 10 of 10 alone, before and after this card · seen on T-0137 · e2e/home-per-goal.spec.ts
- 2026-11-26 [tool] One e2e run on 3203 hit net::ERR_NETWORK_IO_SUSPENDED mid-run (the machine, not the app); the rerun passed · seen on T-0137 · npx playwright test
- 2026-11-26 [product] DEMO.md "Don't open" still warns about the **From your coach** tab under Sessions; after T-0138 Jordan's tab reads "From your clinician" (only the "· coach" comment tag remains) · seen on T-0138 · docs/DEMO.md
- 2026-11-26 [product] A clinician's client still reads "your coach" on the Plan tab ("What your coach asked for", "When your coach sets practice…", "your coach" as the setter) and in the review's comments ("Reply to your coach…", "Between you and your coaches", "Visible to your coaches") · seen on T-0138 · src/app/cloud/PlanTab.tsx, src/app/cloud/session/SessionReview.tsx
- 2026-11-26 [product] A Focus person with no professional sees "From your teacher" on Home's side pane but "From your coach" on the Sessions tab (the tab follows the linked professional only) · seen on T-0138 · src/app/cloud/AthleteWorkspace.tsx
- 2026-11-26 [product] The results' ring takes the session's start as "today": a session across midnight counts toward the day it started there, toward the new day on Home · seen on T-0138 · src/app/cloud/record/live/page.tsx
