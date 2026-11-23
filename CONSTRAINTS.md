# CONSTRAINTS.md

<!-- Seeded by `factory init`. The judge's review blocks a change that breaks a rule
here, so keep every rule concrete enough to check against a diff. Add this codebase's
rules below; delete any of these that don't fit. -->

## Always

- `npm run lint`, `npm run typecheck`, `npm run test` pass, with no new warnings.
- No new dependency without asking first.
- Nothing silences a check: no new `eslint-disable`, `@ts-ignore`, `# noqa` or skipped tests.
- New behaviour comes with new tests; existing tests aren't changed to make a change pass.
- No secrets, keys or tokens in code, tests, fixtures or logs.
- Errors are handled or passed on with context, never swallowed.

## This codebase

<!-- e.g. "All database access goes through src/db/; nothing else imports the driver." -->
