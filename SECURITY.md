# Security policy

Breathband and BreathCloud hold people's accounts and breathing data, so we take reports of security problems seriously and thank everyone who makes one responsibly.

> **Draft: to confirm before launch.** The product domain isn't bought yet, so the address below is a placeholder. Confirm it (and that someone watches it) before launch, and update the help and legal pages' contacts in `src/app/cloud/docs/doc-links.ts` at the same time.

## Reporting a vulnerability

Email **security@** the Breathband product domain (placeholder: **address to be confirmed**).

Please don't open a public GitHub issue, pull request or discussion for a security problem.

Include, as far as you can:

- what the problem is and what someone could do with it;
- the steps, requests or code to reproduce it;
- the page, API route or version affected;
- whether you think anyone's data has been reached.

Use test accounts you made yourself. Don't read, change or keep other people's data, don't run tests that degrade the service (load, spam, denial of service), and stop and tell us as soon as you reach data that isn't yours.

## Scope

In scope:

- BreathCloud, the web console under `/cloud/` (this repository);
- its API under `/api/` (`server/`): sign-in and accounts, sessions and breathing signals, sharing, invites, account export and deletion;
- the access rules between people, professionals and the data they share (`server/authz.ts`, `firebase/firestore.rules`).

Out of scope:

- the public site (breathband-site) and the Breathband phone app, which have their own repositories (report to the same address and we'll pass it on);
- the band's hardware and firmware;
- third-party services we use (report those to the provider);
- findings that need a compromised device or browser, social engineering, or physical access;
- missing best-practice headers or settings without a way to exploit them.

## What happens next

| Step | Target |
| --- | --- |
| We confirm we've received your report | within 2 working days |
| We tell you our first assessment and severity | within 5 working days |
| Fix for a critical or high-severity issue | within 30 days |
| Fix for a medium or low-severity issue | within 90 days |

We'll keep you updated until it's fixed, tell you when it is, and credit you if you'd like. Please give us the time above before you talk about the problem publicly.

These targets are a draft, to confirm before launch.

## Supported versions

Only the version currently deployed is supported. Fixes are made on the main branch and deployed from there.
