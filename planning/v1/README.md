# BreathCloud console v1: the pack

Compiled 2026-11-26 from:

- `breathband-docs/site/docs/` (all 28 pages: product, design, engineering, project, meetings, sources)
- `breathband-console` at `feat/product-redesign` (`8f88778`) and `main` (`7296b62`), with its `BACKLOG.md`, `docs/PLAN.md` and `docs/DEMO.md`
- the earlier discovery in `~/rivetari-scratch/breathband/` (inventories, parity map, run log)

> **Confidential.** These files repeat calibration and scoring details from the docs, which are covered by a pending patent application. Don't publish them or paste them anywhere public.

## What v1 is

**BreathCloud v1 is a standalone web product.** A person with a Breathband can sign up, set up and calibrate their band, record open and paced sessions in the browser, get scores they understand, see their progress, and share it with a professional. A professional (coach, clinician or educator) can sign up, invite the people they work with, set them practice, watch their progress and review their sessions. Everything is stored in a real backend, not the visitor's browser. It works without the phone app; when the app ships, both read and write the same account.

It is a wellness product, not a medical device. That line shapes the clinician experience more than any other decision (see `02-onboarding-and-tailoring.md` §4.3 and `03-launch-checklist.md` §N).

## Files

| File | What it holds |
| --- | --- |
| [01-product-spec.md](01-product-spec.md) | What v1 contains, area by area, with what the console already has (built, partial, missing) and the tier (Demo, Launch, Later) |
| [02-onboarding-and-tailoring.md](02-onboarding-and-tailoring.md) | Both onboarding families in full (Train / Focus / Calm, and Coach / Clinician / Educator), entry points, edge cases, and how each answer tailors the rest of the product |
| [03-launch-checklist.md](03-launch-checklist.md) | The full list of what has to be true for the first launch to succeed, including the things outside the code |
| [04-infrastructure.md](04-infrastructure.md) | Drizzle, Postgres, Docker, local first and Cloud Run later: the architecture, the decisions, and the infrastructure cards in order |
| [05-demo-plan.md](05-demo-plan.md) | The two weeks to the demo, day by day, with the demo script and its fallbacks |

The prompt for the console session is beside this folder: `../PROMPT-rachetari-console.md`.

## Decide this week

These block cards. Each has a recommendation; the ones marked **Harry** go to the Friday 27 Nov check-in.

| # | Decision | Recommendation | Who |
| --- | --- | --- | --- |
| D-A | Demo date and audience | Assumed: investors, around Thu 10 Dec. Confirm, since the plan in `05-demo-plan.md` counts back from it | You |
| D-B | `feat/product-redesign` holds 14 commits of the newest product work and isn't on `main` | Merge it into `main` before any card is cut, then cut `develop` from `main` as the integration branch | You |
| D-C | Backend shape | A small Node API (Hono + Drizzle + Postgres) in the same repo, behind the existing `http` adapter seam. The web stays a static export, so the "static export only" house rule stands. See `04-infrastructure.md` | You |
| D-D | Auth | Better Auth, self-hosted on the API with its Drizzle adapter. This supersedes the Firebase path in `docs/PLAN.md` (decisions 1 and 2 already moved off Firebase Hosting) | You |
| D-E | Cloud Run layout | One service: the API also serves the static export, so cookies are same-origin and there is one thing to deploy. The nginx security headers move into the API | You |
| D-F | Professional roles | Keep the stored `role` values (`athlete`, `coach`) so the app contract holds, and add a professional kind (`coach`, `clinician`, `educator`) plus a professional profile. Additive change to `lib/domain/types.ts` | You |
| D-G | Clinician posture | Wellness only: "clients", never "patients"; no diagnosis, condition or treatment fields; professionals accept terms that say so. Demo uses fictional people only. **No real clinician onboards real patients until counsel has looked at HIPAA (US) or GDPR special-category data (EU)** | You, counsel |
| D-H | Coach access | Invite codes and links (already built) instead of the deck's second BreathCloud password | **Harry** |
| D-I | Where the first users are | Decides the data region and whether HIPAA, GDPR or both apply. Don't guess | **Harry**, you |
| D-J | Calibration | The console's demo calibrates on five deep breaths; Harry's latest answer is full breaths for 20 s, once each time the band goes on. Which reference (median, mean of top and bottom three, single max/min)? Per-user baseline % (5–20%) or a fixed default? | **Harry** |
| D-K | Physiological limits | What breath rate counts as implausible, and is it flagged, capped or both? | **Harry** |
| D-L | Programs | Who writes the six launch programs (two per goal)? Recommendation: we draft from the docs' outlines, Harry approves | **Harry** |
| D-M | Duration presets | 2 / 5 / 10 min (11/04) or 3 / 5 / 10 / custom (spec). Recommendation: 2 / 5 / 10 / custom, plus "until I stop" for open | **Harry** |
| D-N | Under-16s | Out of v1; sign-up asks for age 16+ | **Harry** |
| D-O | Open-session timing reading (PLAN.md decision 8, provisional) | Reading (b), locate on the raw signal; make paced match once confirmed | **Harry** |

## Three things that surprised me

1. **The console is further along than the docs think.** The docs plan a "simple Breathcloud dashboard"; the console already has web recording over Web Bluetooth, calibration, method-C scoring with golden vectors, the full coach workspace, squads, alert rules, two-person and live group sessions. The gap to v1 is not features, it's that **everything lives in `localStorage`**, the professional side has one onboarding step, and the trust layer (accounts, email, privacy, deletion, legal) isn't there.
2. **The docs' user model stops at "Clinical users arrive through a coach and use the Casual preset."** There's no clinician persona, no clinician onboarding and no regulatory plan for one. Adding clinicians is the biggest scope change in this pack; it's mostly onboarding, wording, defaults and legal, not new screens.
3. **The `athlete` role is wrong for most users.** The docs' priority order is Casual, then Student, then Athlete, but the contract, the copy and the demo all say "athlete". The fix is wording and a goal field, not a contract rename (D-F).
