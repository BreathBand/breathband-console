# Launch checklist: BreathCloud v1

Everything that has to be true for the first launch to succeed, including what isn't code. Built from the docs (requirements, acceptance criteria, build plan, risks, open questions, web and console plan Phase 6), the console's `BACKLOG.md` (32 checklist-derived lines), and the gaps found writing `01` and `02`.

**Tier:** **D** Demo (in two weeks) · **L** Launch (before the first real users) · **Later**.
**Owner:** **Card** (a Rachetari card in the console) · **You** · **Harry** · **Christian** (hardware/firmware) · **Counsel**.
**Status:** Built · Partial · Missing · Open (a decision).
`BL n` points to the console's `BACKLOG.md` Next up line n.

## A. Decisions and sign-offs

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| A1 | Demo date, audience and what "success" means for it | D | You | Open |
| A2 | D-B to D-O in `README.md` | D/L | You, Harry | Open |
| A3 | Harry signs off method C, the Total formula, skill bands (1 / 0.75 / 0.5 / 0.25 SD), open-session normal depth band (4.5–7.5%) | L | Harry | Open (metrics spec open list) |
| A4 | Harry confirms calibration duration and reference, per-user baseline rule, physiological limits | L | Harry | Open |
| A5 | Who signs off marketing and in-product claims (wellness wording, "patent pending") | L | Harry, counsel | Open (PLAN.md D8) |
| A6 | Clinician track allowed at launch, or demo-only until counsel answers | L | You, Harry, counsel | Open |
| A7 | Data region and retention period | L | Harry, you | Open (PLAN.md D6) |
| A8 | Pricing and who pays (individuals, professionals, bundled with the band) | L | Harry | Open: not in any doc |
| A9 | Launch scope: who gets accounts first (closed beta of 30, per the docs' plan) | L | You, Harry | Open |
| A10 | The domain and Google Cloud account Harry is buying | L | Harry | Open (11/16 action) |

## B. Platform and infrastructure

Detail and card order in `04-infrastructure.md`.

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| B1 | `feat/product-redesign` merged; `develop` cut as the integration branch | D | You | Open |
| B2 | Decision 10 recorded in `docs/PLAN.md`: API + Drizzle + Postgres; Firebase path superseded; house rules updated | D | Card (needs you: agent config) | Missing |
| B3 | Docker Compose: Postgres and Mailpit locally, healthchecks, one command up and down | D | Card | Missing |
| B4 | Drizzle schema and committed migrations for every entity in the contract, plus auth, professional profiles, consents, calibrations, devices, audit log | D | Card | Missing |
| B5 | API: health, validation, error format, logging, security headers, serves the static export | D | Card | Missing |
| B6 | `http` adapter implements `AuthService` and `DataService` in full | D | Card | Stub |
| B7 | The existing adapter behaviour tests pass against the `http` adapter and Postgres | D | Card | Missing |
| B8 | Seed: demo accounts and generated sessions in Postgres; `db:reset` | D | Card | Missing |
| B9 | Waveform storage behind an interface: local disk now, Cloud Storage later | D | Card | Missing |
| B10 | Production image (API + static) and a Compose profile that runs the whole product like production | D | Card | Partial (nginx image) |
| B11 | Local adapter kept as the demo fallback (`NEXT_PUBLIC_BACKEND=local`) | D | Card | Built |
| B12 | Cloud Run plan written down: Cloud SQL, Cloud Storage, Secret Manager, migrations as a job, environments | L | Card | Missing (BL 7) |
| B13 | Deployed to a staging Cloud Run service behind the real domain | L | You, Card | Missing |
| B14 | Background jobs: reminder and digest emails, deletion after 24 h, unclaimed in-person sessions after 14 days (Cloud Scheduler later; a cron in the API locally) | L | Card | Missing |
| B15 | Config table for thresholds, durations, program content (no release needed to change) | Later | Card | Missing |

## C. Accounts, authentication and security

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| C1 | Sign up, sign in, sign out against the backend; sessions in httpOnly, same-site cookies | D | Card | Local only |
| C2 | Email verification and banner | L | Card | Missing (BL 22) |
| C3 | Password reset by email | L | Card | Partial |
| C4 | Rate limiting on sign-in, sign-up, reset and invite redemption | L | Card | Missing |
| C5 | Authorization in the API mirrors `firebase/firestore.rules`: own data only; professionals within scope; curves hidden on scores-only | D | Card | Local only |
| C6 | Account deletion (everything, within 24 h, email confirmation) | L | Card | Missing (BL 21) |
| C7 | Download my data | L | Card | Missing (BL 21) |
| C8 | Age gate 16+ | L | Card | Missing |
| C9 | Consent records, versioned | L | Card | Missing |
| C10 | Access log readable by the person | L | Card | Missing |
| C11 | CSP and HSTS; the `/_next/static/` header bug fixed | L | Card | Missing (BL 6; parked nginx bug) |
| C12 | Secret scanning, dependency audit, SAST in CI | L | Card (needs you: CI) | Missing (BL 2, 4, 32) |
| C13 | CI hardened: permissions, pinned actions, timeouts, concurrency | L | Card (needs you: CI) | Missing (BL 3) |
| C14 | Branch protection on `main` and `develop` | L | You (billing on a private repo) | Missing (BL 1) |
| C15 | SECURITY.md with a disclosure contact | L | Card | Missing (BL 12) |
| C16 | Security review before launch: authz tests, no secrets in the client, dependencies audited | L | Card + you | Missing |
| C17 | Google sign-in; Apple sign-in with the app | Later | Card | Missing |

## D. Individual onboarding (`02` §3)

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| D1 | Account step with role, consents | D | Card | Partial |
| D2 | Age step and gate | D | Card | Missing |
| D3 | Goal step (Train, Focus, Calm) | D | Card | Built |
| D4 | Goal questions for Train | D | Card | Missing |
| D5 | Goal questions for Focus (including exam dates, mood check-in opt-in) | D | Card | Missing |
| D6 | Goal questions for Calm | D | Card | Missing |
| D7 | Experience step with plain consequences | D | Card | Built (verify copy) |
| D8 | Plan step: sessions a week, daily minutes, reminder time | D | Card | Partial |
| D9 | Band step with browser check and four routes (Bluetooth, app, no band, simulated) | D | Card | Partial |
| D10 | Fit → calibrate → first suggested session, back to back | D | Card | Partial |
| D11 | Sample data mode for people without a band | D | Card | Missing |
| D12 | Invited path: invite page, scope choice, pre-filled goal, assignment as first session | D | Card | Partial |
| D13 | Done summary and "Tell us more" card on Home | L | Card | Missing |
| D14 | Onboarding state in the backend; resume on any device | L | Card | Missing |
| D15 | Funnel events per step | L | Card | Missing |

## E. Professional onboarding (`02` §4)

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| E1 | Kind step: Coach, Clinician, Educator (`proKind`, additive contract change) | D | Card (needs you: contract) | Missing |
| E2 | Practice step per kind | D | Card | Missing |
| E3 | Use-case step per kind | D | Card | Missing |
| E4 | Terminology (athletes, clients, students) used across the professional UI and emails | D | Card | Missing |
| E5 | Professional terms; clinician wellness acknowledgement; educator 16+ acknowledgement | D (draft) / L (reviewed) | Card, counsel | Missing |
| E6 | Default targets, flags and scope requested per kind | D | Card | Missing |
| E7 | Practice templates per kind | D | Card | Partial (practice plans exist) |
| E8 | "Try it yourself" step | D | Card | Missing |
| E9 | Invite step: link, email, QR; CSV bulk for coaches; group code for educators | D (link, QR) / L (email, CSV) | Card | Partial |
| E10 | Dashboard checklist per kind, with a sample person to explore | D | Card | Missing |
| E11 | Professional guide (help page) | L | Card, you | Missing |
| E12 | In-person session for someone else, claimed by email | L | Card (needs you: decision) | Missing |
| E13 | Clinician progress report (no diagnosis fields) | L | Card | Partial |
| E14 | Private-notes hint for clinicians | D | Card | Missing |
| E15 | "My practice" for professionals | Later | Card | Missing |

## F. Device, fit and calibration

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| F1 | GATT profile confirmed (service and characteristic UUIDs, sample rate, battery, firmware version) | L | Christian | Open (UUIDs assumed) |
| F2 | Five to ten recorded sessions from the real band, added as fixtures | L | Christian, you | Open |
| F3 | Does the firmware filter the signal before sending? | L | Christian | Open |
| F4 | Web Bluetooth tested on the real band: Chrome and Edge on Windows and macOS, Chrome on Android | D (your machine) / L (matrix) | You | Open |
| F5 | Unsupported browser message and simulated fallback | D | Card | Verify |
| F6 | Three-card strap guide with the live gauge | D | Card | Partial |
| F7 | Calibration per D-J, rejects fewer than 3 clean breaths, asks once to repeat | L | Card | Partial |
| F8 | Calibrations stored per person and band with a date | L | Card | Missing |
| F9 | Fit check at session start; re-calibrate when the band went back on or after 30 days | L | Card | Partial |
| F10 | Band page: name, battery, firmware, last calibration, forget | L | Card | Partial |
| F11 | Pairing failure help (charge it, bring it closer, toggle Bluetooth, retry) | D | Card | Partial |
| F12 | Range re-test (25–75 yd varied) before people rely on it | L | Harry, Christian | Open (11/11) |
| F13 | Battery life and charging guidance for the help pages | L | Christian | Open |

## G. Recording

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| G1 | Setup, live paced, live open, markers, tones, auto-stop | D | Card | Built |
| G2 | Phase cue per goal | L | Card | Verify |
| G3 | Under 30 s discarded; ≤3 breaths "too short" | L | Card | Partial |
| G4 | Reconnecting state; resume within 15 s; else score what was captured | L | Card | Verify |
| G5 | Screen wake lock during a session | L | Card | Verify |
| G6 | Session tied to the calibration and device that recorded it | L | Card | Partial |
| G7 | Saving works when the network drops mid-session (queue and retry) | L | Card | Missing |
| G8 | Two-person session | D | Card | Built |
| G9 | Live group on a real realtime channel | Later | Card | Simulated |

## H. Scoring and science

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| H1 | Method C and open metrics with golden vectors | D | Card | Built |
| H2 | Open vs paced transition timing consistent (decision 8) | L | Harry, card | Open |
| H3 | Physiological limits | L | Harry, card | Open |
| H4 | Noisy-signal flag and copy | L | Card | Verify |
| H5 | Scoring validated on real recordings, not only synthetic signals | L | You, Christian | Missing |
| H6 | Server-side scoring (same library in the API) for app uploads and rescoring | Later | Card | Missing |

## I. Results, history and progress

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| I1 | Paced and open review | D | Card | Built |
| I2 | Persona emphasis on Home and Results (`02` §5.1) | D | Card | Missing |
| I3 | Coaching line in the persona's tone | D | Card | Verify |
| I4 | Metric explainers for every tile | L | Card | Partial |
| I5 | Tags on sessions | L | Card | Missing |
| I6 | Share as an image | L | Card | Missing |
| I7 | CSV of per-breath data for individuals | L | Card | Partial |
| I8 | Trend ranges 7 d / 30 d / 6 m; calendar with rings | L | Card | Verify |
| I9 | Personal baseline band after 7 sessions | L | Card | Verify |
| I10 | Print / PDF of a session and a period | D | Card | Built |

## J. Habit

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| J1 | Daily ring | L | Card | Verify |
| J2 | Streak with a rest day; paused copy | D | Card | Partial |
| J3 | Milestones | L | Card | Missing |
| J4 | Six programs: content written and approved | L | Harry, you | Open (D-L) |
| J5 | Programs: enrol, progress, finish, next preview | L (Demo: one) | Card | Missing |
| J6 | Mood check-in for Focus | L | Card | Missing |
| J7 | Gamification toggles in Settings | L | Card | Missing |

## K. Sharing and the professional workspace

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| K1 | Invites, scopes, revoke | D | Card | Built |
| K2 | First-share sheet wording | D | Card | Verify |
| K3 | Several professionals per person | L | Card | Verify |
| K4 | Dashboard, roster, squads, workspace, targets, alert rules, assignments, comments, kudos, compare | D | Card | Built |
| K5 | Terminology and defaults per professional kind | D | Card | Missing |
| K6 | Professional sees a browser-recorded session with exactly the person's numbers | D | Card | Built (local) |
| K7 | Revocation takes effect at once in the API | L | Card | Local only |

## L. Notifications and email

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| L1 | Email sending: Mailpit locally; a provider for staging and production (Resend, Postmark or SES) with SPF, DKIM, DMARC on the domain | L | Card, you | Missing |
| L2 | Templates: verify, reset, invite, invite accepted, assignment, account deleted, in-person session claim | L | Card | Missing |
| L3 | Reminders, at most one a day, priority order, quiet hours, per-type off switch, one-click unsubscribe | L | Card | Missing |
| L4 | Professional digest | L | Card | Missing |

## M. Help, support and content

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| M1 | Help pages: wearing the band, pairing, calibration, browsers, scores explained, sharing, privacy | L | Card, you | Missing |
| M2 | Professional guide | L | You, Harry | Missing |
| M3 | Contact support route to a monitored inbox | L | You | Missing |
| M4 | Illustrations for strap placement and the clip (real photos of the band preferred) | D | You, Harry | Open |
| M5 | Breathband logo files and final palette (Harry's deck corner logo, 11/16) | D | Harry | Open |
| M6 | Copy deck per tone, reviewed for wellness wording | L | You, counsel | Missing |
| M7 | Product photography for the site | L | Harry | Open |

## N. Privacy, legal and regulatory

Not legal advice; these are the questions to put to counsel.

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| N1 | Privacy policy: what is collected, why, where it's stored (region), processors (Google Cloud, email provider, analytics), retention, deletion, rights | L | Counsel, card (page) | Missing (BL 5) |
| N2 | Terms for individuals; terms for professionals | L | Counsel | Missing |
| N3 | Regulatory position: wellness, no intended medical use; review of every claim on the site, in emails and in the product | L | Counsel | Open |
| N4 | Clinician use: HIPAA (BAA needed?), GDPR special-category data (DPA, lawful basis, DPIA), and whether clinicians using it with patients changes the device classification | L | Counsel | Open |
| N5 | Cookie and analytics consent if required in the launch region | L | Card, counsel | Open (PLAN.md D7) |
| N6 | Age: 16+ in v1; COPPA and GDPR child rules if that changes | L | Counsel | Open |
| N7 | "Patent pending" use and keeping the method confidential in public surfaces | L | Harry, counsel | Open |
| N8 | Third-party license summary | L | Card | Missing (BL 30) |
| N9 | Accessibility statement | L | Card | Missing (BL 20) |

## O. Accessibility, design and copy

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| O1 | WCAG 2.2 AA stated and checked with axe on every route, both themes | D (main routes) / L | Card | Partial (BL 19, 20) |
| O2 | Keyboard path through onboarding, recording and review | L | Card | Verify |
| O3 | Live session announces phase changes to screen readers; reduce-motion pacer | L | Card | Verify |
| O4 | Every score has a word and a non-colour cue | D | Card | Partial |
| O5 | Phone-width layouts for professionals ("coaches will use phones") | L | Card | Partial |
| O6 | `DESIGN.md` applied to every new screen; slop check | D | Card | Partial |

## P. Quality

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| P1 | E2E: individual onboarding for each goal, professional onboarding for each kind, invite → accept → assignment → session → professional review | D | Card | Partial (demo path) |
| P2 | E2E and axe in CI | L | Card (needs you: CI) | Missing (BL 19) |
| P3 | API contract and authorization tests in CI with Postgres | D | Card | Missing |
| P4 | Coverage floor | L | Card | Missing (BL 18) |
| P5 | Performance budget and Lighthouse CI; LCP under 2.5 s on the site | L | Card | Missing (BL 24) |
| P6 | Lint limits, dead-code check, formatter, pre-commit | L | Card (needs you) | Missing (BL 13–15) |
| P7 | Usability test: 5 individuals (mix of goals) and 3 professionals (one of each kind) through onboarding without help | L | You | Missing |
| P8 | Closed beta of 30 with a two-week read (the docs' gate: 60% run a session in week 2) | L | You | Missing |

## Q. Operations

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| Q1 | Error tracking (Sentry or Cloud Error Reporting), browser and API | L | Card | Missing (BL 8) |
| Q2 | Uptime check on `/`, `/cloud/login/` and `/api/health`, alerts to a monitored inbox | L | Card, you | Missing (BL 8) |
| Q3 | Backups (Cloud SQL automated + point-in-time), RPO/RTO written, a restore drill done | L | Card, you | Missing (BL 10) |
| Q4 | Budget alerts on the GCP project; least-privilege service account | L | You | Missing (BL 11) |
| Q5 | Repeatable deploy (scripted or as code), staging and production | L | Card | Missing (BL 7) |
| Q6 | Runbooks for the alerts; a postmortem template | L | Card | Missing (BL 25) |
| Q7 | Structured logs without breathing data or personal data | L | Card | Missing |
| Q8 | CHANGELOG and versioning | L | Card | Missing (BL 27) |

## R. Analytics and success measures

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| R1 | Product events (onboarding funnel, band, calibration, sessions, invites); never breathing samples | L | Card | Missing |
| R2 | Internal view of the launch measures (`02` §9) by goal and professional kind | L | Card | Missing |
| R3 | Privacy-friendly site analytics | L | Card | Missing (PLAN.md D7) |

## S. Public site and going to market

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| S1 | Waitlist in the backend with a honeypot | L | Card | Missing (BL 23) |
| S2 | Pages for clinicians and educators | L | Card, counsel | Missing |
| S3 | FAQ: device, battery, browsers, phones, privacy, availability | L | Card, you | Missing |
| S4 | Open Graph images, sitemap, robots (`/cloud` noindex) | L | Card | Partial |
| S5 | How people get a band: price, pre-order or waitlist, shipping region | L | Harry | Open |
| S6 | Support email on the domain, not the generic Gmail | L | You, Harry | Open (11/11) |
| S7 | Pilot partners: one coach, one clinician, one educator lined up for the beta | L | Harry, you | Open |

## T. Hardware and the world outside the console

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| T1 | Enough bands for the beta (30 users) and a spare for every demo | L | Harry, Christian | Open |
| T2 | In-box card or QR code pointing at the onboarding URL | L | Harry | Open |
| T3 | Firmware changes routed to Christian for new devices | L | You | Ongoing |
| T4 | The phone app's sync target is this API (Phase 5 of the plan, re-pointed) | Later | You | Open |

## U. Demo

| ID | Item | Tier | Owner | Status |
| --- | --- | --- | --- | --- |
| U1 | Demo script v2 (`05-demo-plan.md`): two individuals side by side to show tailoring, a clinician onboarding, invite → session → review | D | Card, you | Missing |
| U2 | Seed data for the script's people (one per track) | D | Card | Partial |
| U3 | Demo runs from one command, offline, on the demo laptop | D | Card, you | Partial |
| U4 | Real band rehearsed on the demo laptop; simulated band as the fallback | D | You | Open |
| U5 | Code freeze two days before; a dress rehearsal the day before | D | You | Open |
| U6 | Nothing on screen that's unfinished, clinical or confidential | D | You | Open |

## V. Carry to the app

| ID | Item | Tier | Owner |
| --- | --- | --- | --- |
| V1 | Onboarding question set, tailoring defaults and copy as shared config | Later | Card |
| V2 | The same funnel events and names | Later | Card |
| V3 | Dart models match `lib/domain/types.ts`, including `proKind` and onboarding fields | Later | You |
| V4 | Golden vectors shared between the TS and Dart scoring, or server-side scoring | Later | You |
| V5 | App sync against this API: auth, sessions, waveforms, offline queue, last write wins | Later | You |
| V6 | Notifications move to push with the same one-a-day rule | Later | You |
