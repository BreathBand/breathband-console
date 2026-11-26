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
