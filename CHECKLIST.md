# Checklist

Stage: Foundation — decided by `repo.branch-protection`, `dev.conventional-commits`, `dev.formatter.configured`, `dev.precommit-hooks`, `docs.diataxis-layout`, `repo.contributing.present`, `repo.editorconfig.present`, `repo.security-policy.present`, `sec.secret-scanning.pre-commit`, "Lint fails on unused code", "Complexity and file-length limits are set" and "A dead-code check runs", the twelve failing foundation lines.
Last `/setup`: 2026-11-26, on chore/rachetari-setup.

What must stay true for this repo, in fifteen sections. Every section stays, even one
that doesn't apply: it says `n/a` and why, so leaving it out is a recorded choice.
`/setup` writes the lines, runs each check and records the result. Edit, add or retag
lines as you like, and a re-run keeps your changes. A `[checklist]` line parked in
a card proposes a new line here.

Each line has a status, a stage and the check that was run. A line from the old catalog
leads with its id, so a re-run finds it instead of adding it again:

    - [x] `<id>` <what must stay true> · stage: <foundation|building|hardening|live> · check: <what was run>
    - [ ] <what must stay true> · stage: <stage> · check: <what was run> (<what it showed>)
    - [ ] unchecked: <what must stay true> · stage: <stage> · check: <what a person should look at>
    - n/a: <why nothing in this section applies to this repo>

`[x]` is passed and `[ ]` is failed. `new` at the end of a line marks one the last
`/setup` added. To drop a catalog line for good, change it to ``- n/a: `<id>` <why>``
rather than deleting it, so a re-run doesn't add it back.

Notes on this run: the owner asked that the app's tests and build not be run locally, so
those lines cite main's CI run 45433433861 (commit `565c054`, every step green). GitHub
reads were `gh api` GETs only; branch protection and rulesets answer 403 because the
repo is private on the organisation's free plan.

## accessibility

- [ ] `a11y.ci.automated-checks` Automated accessibility checks in CI (axe/Lighthouse) · stage: building · check: look for axe or Lighthouse in `.github/workflows/ci.yml`, `e2e/` and `package.json` (none; `axe-core` is in `package-lock.json` only as a lint plugin's dependency)
- [ ] unchecked: `a11y.contrast.enforced` Color contrast enforced in design tokens · stage: building · check: a person compares the token pairs in `src/app/globals.css` and `src/app/(site)/site.css` against WCAG AA ratios
- [ ] unchecked: `a11y.keyboard.manual-pass` Keyboard-only manual pass recorded · stage: building · check: a recorded keyboard-only pass over sign-in, the coach dashboard, the athlete workspace and session review
- [ ] unchecked: `a11y.screen-reader.pass` Screen-reader pass on key flows recorded · stage: building · check: a recorded screen-reader pass (NVDA or VoiceOver) over the same flows
- [ ] `a11y.target.stated` Accessibility target stated (WCAG 2.2 AA) · stage: building · check: search for "WCAG" in `DESIGN.md`, `CONSTRAINTS.md`, `README.md` and `docs/` (only `docs/PLAN.md:144`, an unticked Phase 2 item for the public site's waitlist form; nothing states a target for the console)
- [ ] `a11y.statement.published` Accessibility statement page published · stage: hardening · check: look for an accessibility route under `src/app/` (none)

## cicd

- [x] `ci.workflow.present` CI workflow present · stage: foundation · check: `.github/workflows/ci.yml` exists
- [x] `ci.runs-on-pr` CI runs lint, typecheck, tests and build on PRs · stage: foundation · check: `on.pull_request` in `.github/workflows/ci.yml`, with `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` steps
- [x] `ci.runs-on-push` CI runs on push · stage: foundation · check: `on.push.branches: [main]` in `.github/workflows/ci.yml`
- [ ] `ci.changelog-automated` Versioning and changelog automated · stage: building · check: look for release-please, changesets or semantic-release config (none)
- [ ] `ci.concurrency` CI cancels superseded runs · stage: building · check: look for `concurrency` in `.github/workflows/ci.yml` (none)
- [ ] `ci.concurrency-pr-only` CI cancels superseded PR runs, and only those · stage: building · check: same file (no `concurrency` at all)
- [x] `ci.dependency-caching` CI caches dependencies · stage: building · check: `actions/setup-node` with `cache: npm` in `.github/workflows/ci.yml`
- [ ] `ci.docs-skip-build` Docs-only PRs skip build and test · stage: building · check: `on.pull_request` in `.github/workflows/ci.yml` (no paths filter; a docs-only PR runs the full job)
- [ ] `ci.job-timeouts` Every CI job has a timeout · stage: building · check: `timeout-minutes` in `.github/workflows/ci.yml` (the `check` job has none)
- [x] `ci.pr-linux-only` Windows and macOS stay off PRs on private repos · stage: building · check: `runs-on` in `.github/workflows/ci.yml` (`ubuntu-latest` only; `gh repo view` says the repo is private)
- [ ] `ci.required-aggregator` One required `ci` check aggregates the PR jobs · stage: building · check: `gh api repos/BreathBand/breathband-console/branches/main/protection` (403, "Upgrade to GitHub Pro or make this repository public"; the single `check` job is not required by anything)
- [ ] `ci.actions-pinned-sha` GitHub Actions pinned by commit SHA · stage: hardening · check: every `uses:` in `.github/workflows/ci.yml` (`actions/checkout@v5` and `actions/setup-node@v5`, pinned by tag)
- [ ] `ci.secret-scan-on-pr` CI scans each PR's commits for secrets · stage: hardening · check: look for a gitleaks or secret-scan step in `.github/workflows/ci.yml` (none)
- [ ] `ci.workflow-permissions` Workflow token permissions declared · stage: hardening · check: look for `permissions:` in `.github/workflows/ci.yml` (none, so the token gets the repo's default)

## cloud

- [ ] `cloud.iac-present` Infrastructure as code present · stage: building · check: look for Terraform, Pulumi or a Cloud Run `service.yaml` (none; the service is to be created by a hand-run `gcloud run deploy`)
- [ ] `cloud.rpo-rto-documented` RPO and RTO written down · stage: building · check: search for "RPO" and "RTO" in `README.md` and `docs/` (none)
- [ ] The production deploy is written down and repeatable · stage: hardening · check: `README.md` "Deploy target" and `docs/PLAN.md#cloud-run` (a person runs `gcloud run deploy breathband-web --source .` by hand; it has never been run, the region waits on D6, no workflow deploys, and `gh api repos/BreathBand/breathband-console/environments` lists no environments)
- [ ] `cloud.iac-plan-in-ci` IaC plan runs in CI · stage: hardening · check: look for a plan step in `.github/workflows/ci.yml` (none, and no IaC to plan)
- [ ] unchecked: `cloud.backups-restore-tested` Backups configured and restore tested · stage: hardening · check: nothing holds production data yet (the console runs on the browser-only local adapter); once a datastore exists, a recorded restore into the dev project
- [ ] unchecked: `cloud.least-privilege-iam` Least-privilege IAM reviewed · stage: hardening · check: a person reviews the roles on the GCP project and the Cloud Run service account before the first deploy
- [ ] unchecked: `cloud.cost-budget-alert` Cost budget alert configured · stage: live · check: a billing budget with alerts on the GCP project (`docs/PLAN.md` 4a suggests $10 and $50)
- n/a: `cloud.policy-as-code` there is no IaC to scan yet; revisit with `cloud.iac-present`

## data

- [ ] The console stores data in a real backend, not the visitor's browser · stage: building · check: `backendKind()` in `src/lib/backend/index.ts` and `src/lib/backend/http/` (only `local`, localStorage with seeded demo data, works; `http` and `firebase` are stubs, so the waitlist and every account live in one browser)
- [ ] unchecked: `data.pii-classified` PII columns classified · stage: building · check: AGENTS.md flags the repo `handles-pii`; a person marks which fields in `src/lib/domain/types.ts` are personal or health data
- [ ] unchecked: `data.encryption-verified` Encryption at rest and in transit verified · stage: hardening · check: TLS on the Cloud Run URL and custom domain, and at-rest encryption of the future backend store
- [ ] unchecked: `data.retention-jobs` Retention and deletion jobs implemented · stage: hardening · check: the retention period waits on D6, and nothing deletes an account's data yet (`deleteAccount` is a Phase 4 plan item)
- [ ] unchecked: `data.backup-restore-drill` Data backup restore drill performed · stage: live · check: a recorded restore drill once a production datastore exists
- n/a: `data.migrations-versioned` no database in this repo; the data shapes are the contract in `src/lib/domain/types.ts`
- n/a: `data.analytics-taxonomy` no analytics yet; D7 in `docs/PLAN.md` decides whether there will be any

## development

- [x] It builds · stage: foundation · check: the `npm run build` step of CI run 45433433861 on main `565c054` (success; not run locally, per the owner)
- [ ] `dev.conventional-commits` Conventional commits enforced · stage: foundation · check: look for commitlint or a commit-msg hook (none; the history follows the style but nothing enforces it)
- [x] `dev.env-example` .env.example present · stage: foundation · check: `.env.example` is tracked, and `.gitignore` ignores `.env*` except it
- [ ] `dev.formatter.configured` Formatter configured · stage: foundation · check: look for a Prettier or Biome config or a format script in `package.json` (none)
- [x] `dev.linter.configured` Linter configured · stage: foundation · check: `eslint.config.mjs` (Next core-web-vitals and TypeScript configs)
- [ ] `dev.precommit-hooks` Pre-commit hooks installed · stage: foundation · check: look for `.husky/`, `lefthook.yml` or `.pre-commit-config.yaml` (none)
- [x] `dev.typecheck.strict` TypeScript strict mode enabled · stage: foundation · check: `"strict": true` in `tsconfig.json`
- [x] `dev.linter.in-ci` Linter runs in CI · stage: building · check: `npm run lint` step in `.github/workflows/ci.yml`
- [ ] `dev.code-review-required` Code review required before merge · stage: building · check: `gh api repos/BreathBand/breathband-console/branches/main/protection` (403 on the free plan; nothing requires a review, and `gh pr list --state merged` shows #39 to #41 merged with no review decision)

## documentation

- [x] `docs.onboarding-guide` The README says how to run it · stage: foundation · check: `README.md` "Quick start" (Node 22, `npm install`, `.env.local`, `npm run dev`, and the container)
- [ ] `docs.diataxis-layout` docs/ follows the Diátaxis layout · stage: foundation · check: `ls docs/` (only `PLAN.md`)
- [ ] unchecked: `docs.adr-log` ADR log started and current · stage: building · check: the "Decisions" table in `docs/PLAN.md` (eight dated decisions); a person decides whether it serves as the log
- [ ] `docs.c4-diagrams` C4 context and container diagrams present · stage: building · check: `README.md` "How it's put together" (a folder tree, no context or container diagram)
- [ ] `docs.changelog-present` Changelog present · stage: building · check: look for `CHANGELOG.md` (none)
- [ ] `docs.runbooks-dir` Runbooks directory exists · stage: hardening · check: look for `docs/runbooks/` or `runbooks/` (none)

## hygiene

- [ ] `repo.branch-protection` Default branch is protected · stage: foundation · check: `gh api repos/BreathBand/breathband-console/branches/main/protection` and `.../rulesets` (both 403, "Upgrade to GitHub Pro or make this repository public"; `gh api orgs/BreathBand` says plan `free`, so main has no protection or ruleset)
- [x] `repo.codeowners.present` CODEOWNERS present · stage: foundation · check: `.github/CODEOWNERS` (`* @arynbht`)
- [ ] `repo.contributing.present` CONTRIBUTING guide present · stage: foundation · check: look for `CONTRIBUTING.md` (none)
- [x] `repo.dependency-update-bot` Dependency update bot configured · stage: foundation · check: `.github/dependabot.yml` (npm, GitHub Actions and Docker; seven Dependabot PRs open, #14 to #20)
- [ ] `repo.editorconfig.present` .editorconfig present · stage: foundation · check: look for `.editorconfig` (none)
- [ ] unchecked: `repo.license.present` LICENSE present · stage: foundation · check: no `LICENSE`, and `package.json` is `"private": true` with no license field; a person decides on a proprietary notice or marks this n/a
- [x] `repo.lockfile.present` Dependencies are locked · stage: foundation · check: `package-lock.json` is tracked and CI's `npm ci` succeeds (run 45433433861)
- [x] `repo.readme.present` README present · stage: foundation · check: `README.md` exists
- [ ] `repo.security-policy.present` SECURITY policy with a disclosure contact · stage: foundation · check: look for `SECURITY.md` or `.github/SECURITY.md` (none; `gh repo view` shows no security policy URL)
- [x] `repo.toolchain-pinned` Toolchain version pinned · stage: foundation · check: `.nvmrc` (`22`, major only) read by CI's `setup-node`, and `node:22-alpine` in `Dockerfile`

## legal

- [ ] unchecked: `legal.data.inventory` Data inventory and map maintained · stage: building · check: a person lists the personal and health data the console and app hold and where it flows (the `legal/data-inventory-mapping` kit skill covers this)
- [ ] unchecked: `legal.data.retention` Retention schedule and deletion job defined · stage: building · check: waits on D6 in `docs/PLAN.md`
- [ ] unchecked: `legal.dsar.process` DSAR (data subject request) process documented · stage: building · check: a person writes down how an access or deletion request is handled
- [ ] `legal.privacy.policy` Privacy policy published · stage: hardening · check: look for a privacy route under `src/app/` (none; `docs/PLAN.md` Phase 2 and Phase 6 require one covering health data)
- [ ] `legal.terms.published` Terms of service published · stage: hardening · check: look for a terms route under `src/app/` (none)
- [ ] `legal.license-summary` Third-party license summary · stage: hardening · check: look for a third-party notices file (none)
- [ ] unchecked: `legal.cookie.consent` Cookie consent for EU users with tracking · stage: hardening · check: no tracking or analytics code today (search `src/` for analytics and `document.cookie`); re-check when D7 brings analytics

## observability

- [ ] `ops.slos-defined` SLOs defined with error budgets · stage: hardening · check: search `README.md` and `docs/` for SLOs (none)
- [ ] `ops.telemetry-exported` Logs, metrics, and traces exported to a backend · stage: hardening · check: look for an error-tracking or telemetry SDK in `package.json` and an uptime check (none; `docs/PLAN.md` 4b.7 plans Sentry and an uptime check on `/` and `/cloud/login/`)
- [ ] unchecked: `ops.dashboards-golden-signals` Dashboards for the golden signals · stage: live · check: a Cloud Monitoring dashboard for the service once it is deployed
- [ ] unchecked: `ops.oncall-rotation` On-call rotation or schedule documented · stage: live · check: who is paged, and where budget and error alerts go (`docs/PLAN.md` Phase 6 asks for a monitored inbox)
- [ ] `ops.postmortem-template` Blameless postmortem template and log · stage: live · check: look for a postmortem template (none)
- [ ] `ops.runbook-per-alert` Runbook per alert · stage: live · check: look for alerts and runbooks (neither exists)

## performance

- [ ] `perf.budgets-defined` Performance budgets defined · stage: building · check: look for a budget file (none; `docs/PLAN.md` Phase 2 states LCP under 2.5 s and Lighthouse 90+ as goals only)
- [ ] `perf.bundle-size-budget` Bundle size budget enforced · stage: building · check: look for size-limit or a bundle budget in CI (none)
- [ ] `perf.caching-strategy` Caching strategy documented · stage: hardening · check: search `README.md` and `docs/` (none; `nginx.conf` sets an immutable year-long `Cache-Control` on `/_next/static/`, but nothing writes the strategy down)
- [ ] `perf.lighthouse-ci` Lighthouse CI in the pipeline · stage: hardening · check: look for Lighthouse CI in `.github/workflows/ci.yml` (none)
- [ ] unchecked: `perf.load-test-before-launch` Load test at expected peak before launch · stage: hardening · check: a person sets the expected peak and load-tests the Cloud Run service before launch
- n/a: `perf.n-plus-one-detection` no server and no database queries; the static export talks to the local adapter in the browser

## product

- [ ] unchecked: `product.discovery.brief` Discovery brief with success metrics and kill criteria · stage: building · check: `docs/PLAN.md` states goals per phase but no success metrics or kill criteria; a person decides what counts
- [ ] `product.risk.register` Risk register started · stage: building · check: look for a risk register (none)
- [ ] unchecked: `product.requirements.nfrs` Non-functional requirements captured as numbers · stage: building · check: `docs/PLAN.md` (LCP under 2.5 s, Lighthouse 90+, 44 px tap targets); a person checks they cover the console, not only the public site
- [ ] unchecked: `product.scope.out-of-scope` Out-of-scope list recorded · stage: building · check: `README.md` names what was left out of the coach tools (billing, prescribing, EMR, telehealth)
- [ ] unchecked: `product.stories.acceptance` User stories with acceptance criteria · stage: building · check: the phase checklists and "Done when" lines in `docs/PLAN.md`
- [ ] unchecked: `product.survey.build-vs-buy` Build-vs-buy survey recorded · stage: building · check: a person records it
- [ ] `product.launch.checklist` Launch checklist and go/no-go recorded · stage: hardening · check: `docs/PLAN.md` "Phase 6: Launch checklist" (all seven items unticked, no go/no-go recorded)

## quality

- [x] `quality.lint.clean` Lint is clean · stage: foundation · check: the `npm run lint` step of CI run 45433433861 (success); a local `npm run lint` in the main checkout reports 151 problems, all under the untracked `.claude/worktrees/` (parked)
- [x] `quality.typecheck.clean` Typecheck is clean · stage: foundation · check: the `npm run typecheck` step of CI run 45433433861 (success)
- [x] `quality.tests.pass` Tests exist and pass · stage: foundation · check: the `npm test` step of CI run 45433433861 (success; 35 test files tracked; not run locally, per the owner)
- [ ] Lint fails on unused code · stage: foundation · check: `npx --no-install eslint --print-config "src/app/(site)/_components/usePrefersReducedMotion.ts"` (`@typescript-eslint/no-unused-vars` at 1, a warning)
- [ ] Complexity and file-length limits are set · stage: foundation · check: the same resolved config (`complexity`, `max-lines` and `max-lines-per-function` are not set)
- [ ] A dead-code check runs · stage: foundation · check: knip in a `package.json` script and in `.github/workflows/ci.yml` (neither; knip is not installed)
- [x] `/done` runs the comment report · stage: foundation · check: `.claude/skills/done/SKILL.md` calls `comment-report.mjs`, and `.claude/skills/done/comment-report.mjs` is beside it
- [ ] `quality.boundaries.clean` Module boundaries hold · stage: building · check: look for a command that enforces "screens never import an adapter" from `AGENTS.md` (no `no-restricted-imports` or boundaries rule in `eslint.config.mjs`)
- [ ] `quality.required-checks.named` Merges require passing status checks · stage: building · check: `gh api repos/BreathBand/breathband-console/branches/main/protection` (403 on the free plan; CI's `check` is not required)
- [ ] `quality.coverage.floor` Coverage at or above the floor · stage: hardening · check: `vitest.config.mts` (no coverage settings, no floor)

## security

- [x] No secrets in the repo · stage: foundation · check: `gitleaks git --redact .` (461 commits, no leaks) and `gitleaks dir --redact .` (no leaks); `git ls-files` tracks no `.env` file but `.env.example`
- [ ] `sec.secret-scanning.pre-commit` Secret scanning runs before commit · stage: foundation · check: look for a pre-commit hook running gitleaks (none)
- [x] `sec.dependabot-security-updates` Dependabot security updates enabled · stage: hardening · check: `gh api repos/BreathBand/breathband-console/automated-security-fixes` (`enabled: true`)
- [x] `sec.vulnerability-alerts` Dependency vulnerability alerts enabled · stage: hardening · check: `gh api -i repos/BreathBand/breathband-console/vulnerability-alerts` (204)
- [ ] `sec.dependency-scan.ci` Dependency vulnerability scan in CI · stage: hardening · check: look for `npm audit` or dependency review in `.github/workflows/ci.yml` (none)
- [ ] `sec.push-protection` Secret scanning push protection enabled · stage: hardening · check: `gh api repos/BreathBand/breathband-console --jq .security_and_analysis` (empty: secret scanning and push protection aren't available on this private free-plan repo)
- [ ] `sec.sast.ci` SAST runs in CI · stage: hardening · check: look for CodeQL or Semgrep in `.github/workflows/` (none)
- [ ] `sec.sbom.ci` SBOM generated in CI · stage: hardening · check: look for an SBOM step (none)
- [ ] `sec.secret-scanning.ci` Secret scanning runs in CI · stage: hardening · check: look for gitleaks or similar in `.github/workflows/ci.yml` (none)
- [ ] The served site sends a Content-Security-Policy and HSTS · stage: hardening · check: `add_header` lines in `nginx.conf` (nosniff, Referrer-Policy and X-Frame-Options only; no `Content-Security-Policy`, no `Strict-Transport-Security`)
- [ ] unchecked: `sec.threat-model` Threat model documented and current · stage: hardening · check: none written; a person reviews the access rules the local adapter enforces and the draft `firebase/*.rules`
- n/a: `sec.scorecard.score` the repo is private, and Scorecard's "Maintained" check is read for public repos

## testing

- [x] `test.e2e.present` End-to-end tests present · stage: building · check: `playwright.config.ts` and `e2e/smoke.spec.ts`
- [ ] End-to-end tests run in CI · stage: building · check: look for `npm run e2e` or `playwright test` in `.github/workflows/ci.yml` (none)
- [ ] `test.coverage-config` Test coverage configured · stage: building · check: `vitest.config.mts` (no `coverage` block)
- [ ] unchecked: `test.data.factories` Test data factories and a seed script exist · stage: building · check: `src/lib/backend/local/seed.ts` (demo data) and `src/lib/analysis/synth.ts` (signal generator); a person decides whether they serve as factories
- [x] `test.runner.configured` Test runner configured · stage: building · check: `vitest.config.mts` (`src/**/*.test.ts`)
- [x] `test.runner.in-ci` Tests run in CI · stage: building · check: `npm test` step in `.github/workflows/ci.yml`
- n/a: `test.integration.db` no database; the local adapter's behaviour is tested in Vitest

## ux

- [ ] unchecked: `ux.copy.guidelines` Copy and tone guidelines recorded · stage: building · check: `docs/PLAN.md` "Guardrails for the copy" covers the public site's claims; `DESIGN.md` has no copy or tone section for the console
- [x] `ux.design-system.adopted` Design tokens or component library adopted · stage: building · check: tokens in `src/app/globals.css`, documented in `DESIGN.md` "Colour tokens"
- [ ] unchecked: `ux.flows.wireframes` Wireframes for key flows linked · stage: building · check: a person links them
- [x] `ux.responsive.breakpoints` Responsive breakpoints defined · stage: building · check: `DESIGN.md` "Breakpoints" and `@media` rules in seven CSS files (`DESIGN.md` notes breakpoints that don't line up)
- [ ] unchecked: `ux.states.designed` Empty, loading, error, and offline states designed · stage: building · check: `docs/PLAN.md` 3.7 asks every screen for loading, empty, error and permission-denied states; a person checks each console screen
- [ ] unchecked: `ux.feedback.channel` User feedback channel exists · stage: live · check: a person names the channel
