# BreathCloud v1: product spec

What the standalone console needs to be the first version of the product, area by area.

**Status** is what the console has today on `feat/product-redesign` (`8f88778`), from a code survey, not a test run. "Built" means built **on the local adapter**: it works in one browser and nowhere else until the backend lands. "Verify" means the survey couldn't tell; the first card that touches the area confirms it.

**Tier:** **Demo** is needed for the demo in two weeks · **Launch** blocks the first real users · **Later** is designed for now, built after launch.

## 1. Who it's for

Two families, six personas. Full onboarding for each is in `02-onboarding-and-tailoring.md`.

| Family | Persona | Goal key | What they come for | First win |
| --- | --- | --- | --- | --- |
| Individuals | **Calm** (casual) | `calm` | A daily habit, less stress, curiosity about their breathing | A calm 3-minute session and a word that tells them how it went |
| Individuals | **Focus** (student, 16+) | `focus` | Calm before exams, focus while studying, sleep | Seeing their rate drop during one session ("17 → 12") |
| Individuals | **Train** (athlete, performer) | `train` | Breath control under load, recovery, pre-competition calm | A Total Breath Score with timing and depth they can work on |
| Professionals | **Coach** (trainer, S&C, team coach) | `coach` | Breath training for athletes and squads; warm-ups; recovery | A roster that shows who practised and who needs a look |
| Professionals | **Clinician** (physio, respiratory therapist, physician, psychologist) | `clinician` | Breathing retraining between visits; stress and anxiety work; rehab | Seeing a client's home practice and progress before the next visit |
| Professionals | **Educator** (teacher, counsellor) | `educator` | Calm and focus for students; class breathing | A class session on one pacer, and who's practising |

Individuals who arrive through a professional's invite get the professional's setup first and their own goal second (`02` §3.5).

A professional can also be an individual: a coach who breathes. They get a "My practice" area with the individual experience (Later for the full thing; Demo shows the pro recording one session of their own).

## 2. Rules that apply to every screen

From the docs' design principles, the gamification rules and the copy guardrails. These are review criteria for every card.

1. **One number a day.** Home shows one headline score; everything else is one click deeper.
2. **Nothing to read while breathing.** The live session shows the breath, the pacer, the time and Stop. No scores, no rewards.
3. **A word with every number.** Every score carries a label (Shallow / Normal / Deep; Slow / Normal / Fast; Learning / Getting there / Strong / Excellent) and a colour that is never pure red.
4. **The person's own baseline is the benchmark.** Progress is against their own calibrated normal, never against other people. Breath scores are never ranked between users.
5. **Calm by default.** Rewards appear after the session, never during it. Streak loss is shown without red or shame.
6. **Wellness language only.** Train, practise, track. No diagnosis, treatment or condition words anywhere, including professional views and emails.
7. **Never show the method.** The calibration percentage and scoring internals stay out of the UI, the site and exports.
8. **Every list has an empty state, every load a skeleton, every failure a retry, and "permission denied" is handled.**

## 3. Areas

### 3.1 Accounts and authentication

| Capability | Status | Tier | Notes |
| --- | --- | --- | --- |
| Sign up with email and password, choosing "for myself" or "I work with people" | Built (local) | Demo | Signup has a role picker today |
| Sign in, sign out, stay signed in across reloads | Built (local) | Demo | |
| Accounts stored in a real backend | Missing | Launch (Demo if ready) | The core gap: `04-infrastructure.md` |
| Email verification with a banner until verified | Missing | Launch | Mailpit locally |
| Forgot password with a real email | Partial: page exists, no email | Launch | |
| `?next=` return after sign-in (same-origin paths only) | Verify | Launch | |
| Google sign-in, then Apple sign-in in step with the app | Missing | Later | App Store needs Apple if Google is offered in the app |
| Change name, email (re-verify) and password | Partial | Launch | |
| Delete account: profile, sessions, waveforms, links; confirm by email | Missing | Launch | Apple requires in-app deletion; offer it on the web too |
| Download my data (JSON, plus CSV of sessions) | Missing | Launch | |
| Age gate: 16 or older | Missing | Launch | D-N |
| Versioned consent records (terms, privacy, health-data processing) | Missing | Launch | Stored with time and version |

### 3.2 Onboarding

The whole of `02-onboarding-and-tailoring.md`. Today: individuals get name → goal → level → sessions → band → done; professionals get name → done.

| Capability | Status | Tier |
| --- | --- | --- |
| Individual onboarding with goal-specific questions for Train, Focus and Calm | Partial | Demo |
| Professional onboarding with Coach, Clinician and Educator tracks | Missing | Demo |
| Invite-first onboarding (arrived from a professional's link) | Partial (join page exists) | Demo |
| Onboarding state saved in the backend, resumable on any device | Missing | Launch |
| "No band yet" path into sample data | Missing | Demo |
| Browser check before the band step (Web Bluetooth needs Chrome or Edge on desktop or Android) | Verify | Demo |
| Drop-off measured per step | Missing | Launch |

### 3.3 Device, fit and calibration

| Capability | Status | Tier | Notes |
| --- | --- | --- | --- |
| Connect over Web Bluetooth, with a simulated band behind the same interface | Built | Demo | UUIDs are an assumption in `src/lib/device/config.ts` until Christian confirms the GATT profile |
| Battery and connection shown wherever a session can start | Built | Demo | |
| Strap fit guide: where to wear it, thread the clip, tighten until the gauge turns teal | Built (gauge); verify the three-card guide | Demo | Copy from the user manual |
| Calibration ("balloon"): maximal breaths, A100, midline, normal reference | Built (five breaths) | Demo | D-J: Harry says 20 s of full breaths |
| Calibration rejects a run with fewer than three clean breaths and asks once to repeat | Verify | Launch | |
| Calibration stored per person and per band, with its date | Partial (in the waveform) | Launch | Needs a `calibrations` table |
| Re-calibrate when the band goes back on, or after 30 days | Missing | Launch | Harry: each time the sensor is put on |
| Fit check at session start: tension in range and amplitude within 20% | Partial (strap check) | Launch | |
| Forget band; band name, firmware, last calibration on a Band page | Partial | Launch | |
| Unsupported browser: clear message, recommend Chrome or Edge, offer the simulated band | Verify | Demo | Safari and Firefox have no Web Bluetooth |
| Firmware update | Missing | Later | |

### 3.4 Recording

| Capability | Status | Tier |
| --- | --- | --- |
| Session setup: Open or Paced (2-2, 5-5), duration, circle or line pacer, sound | Built | Demo |
| Defaults from the person's preferences, or locked to a professional's assignment | Built | Demo |
| Live paced: pacer circle or line, the person's breath, low tone at the trough and high at the peak | Built | Demo |
| Live open: breath around the midline with ±3% guides, up to two event markers | Built | Demo |
| Phase cue ("Breathe in" / "Breathe out"), on for Focus and Calm, off for Train | Verify | Launch |
| Auto-stop at the chosen duration; "until I stop" for open | Built | Demo |
| Under 30 s discarded with a toast; 3 or fewer breaths: "too short", no scores | Partial | Launch |
| Band drops: "Reconnecting…", resume within 15 s, else score what was captured | Verify | Launch |
| Keep the screen awake during a session (Screen Wake Lock API) | Verify | Launch |
| Two-person session (User 1 / User 2, one pacer) | Built | Demo (patent figure) |
| Live group session on one pacer | Built (local simulation) | Later for real; Demo on simulation |
| Spoken cues ("breathe in" / "breathe out") | Missing | Later (timing still to be tested with Harry) |
| Custom pacer ratios, 3-3 / 4-4, box breathing | Missing | Later (Harry: 2-2 and 5-5 only for now) |

### 3.5 Scoring and science

| Capability | Status | Tier | Notes |
| --- | --- | --- | --- |
| Method C paced scoring (Total, Timing In/Out, Depth In/Out, On target %, direction, histogram) | Built, golden vectors | Demo | Decision 4: Total is the mean of the four, rounded once |
| Appendix open metrics (rate, I:E, inhale/exhale durations, depth, depth index, % normal rate and depth, per-segment split at markers) | Built, golden vectors | Demo | Decision 8 provisional (D-O) |
| Skill level sets the tolerance band | Built | Demo | Four levels; who moves a person up is open |
| `scoringVersion` on every session; old sessions displayed by their version | Built | Demo | |
| Physiological limits on rate | Missing | Launch | D-K |
| Noisy-signal flag: "Some breaths were hard to read. Scores are an estimate." | Verify | Launch | |
| Thresholds and program content changeable without a release | Missing | Later | A config table in the backend, read at start |
| Rescoring old sessions when the formula changes | Missing | Later | A server job, once sessions live in Postgres |
| Scoring on the server as well as the browser | Missing | Later | The same TS library can run in the API; needed when the app uploads raw signals |

### 3.6 Results and review

| Capability | Status | Tier |
| --- | --- | --- |
| Paced review: headline with label and change since last, sub-scores, on-target share, deviation histogram, breath vs pacer with zoom 5 s to full, per-turn table | Built | Demo |
| Open review: rate, rhythm, depth, before/between/after table | Built | Demo |
| One coaching line from the weakest sub-score, in the persona's tone | Verify | Demo |
| Every tile opens a plain-language explainer with the normal band | Partial ("How scores work") | Launch |
| Note on save, editable later; tags (Morning, Evening, After exercise, Stressed, custom) | Note built; tags missing | Launch |
| Print or PDF of one session, and a period report | Built | Demo |
| Share as an image (a results card) | Missing | Launch |
| CSV export of per-breath data (Train default, anyone on request) | Partial (coach CSV) | Launch |
| Persona-specific emphasis (see `02` §5) | Missing | Demo for Home and Results |
| Professional comments and kudos visible on the session | Built | Demo |

### 3.7 History and progress

| Capability | Status | Tier |
| --- | --- | --- |
| Session list with filters (type, tag, assignment) and paging | Built (verify filters) | Demo |
| Trend of the headline score: 7 d / 30 d / 6 m | Built (8-week trend; verify ranges) | Demo |
| Calendar of completed days with rings | Verify | Launch |
| Personal baseline band on charts after 7 sessions ("depth up 12% on your baseline") | Verify, likely missing | Launch (the mechanic unique to Breathband) |
| Compare two sessions side by side | Missing for individuals (coach Compare exists) | Later |
| Weekly summary (screen and email) | Missing | Later |

### 3.8 Habit: programs, ring, streak, milestones

| Capability | Status | Tier |
| --- | --- | --- |
| Daily ring: planned minutes per day (default 5, 3–30) | Verify | Launch |
| Streak with one rest day per rolling 7 days; paused, never "lost" | Partial (streak on Home) | Demo |
| Milestones: first calibration, first paced session, 7 and 30 days, 100 sessions, first 9+, first program | Missing | Launch |
| Six self-serve programs, two per goal, with progress | Missing (coach practice plans exist) | Launch (D-L); Demo shows one |
| Every mechanic switchable in Settings; goal sets the defaults | Missing | Launch |
| Mood check-in before and after (Focus) | Missing | Launch |
| Levels | Missing | Later |
| Challenges on days completed, never on score | Missing | Later |

### 3.9 Sharing and professional access

| Capability | Status | Tier |
| --- | --- | --- |
| Private by default; sharing is an explicit choice | Built | Demo |
| Invite a professional with a code or link; professional invites a person by link | Built | Demo |
| Scope per professional: scores only, or scores and curves; change or revoke at any time | Built | Demo |
| First-share sheet that says exactly what is shared | Verify | Demo |
| More than one professional per person (a coach and a physio), each with their own scope | Verify | Launch |
| Access log the person can read ("Lena viewed your session on 3 Dec") | Missing | Launch for clinicians |
| Professional export of a person's scores with consent | Partial (CSV, report) | Launch |

### 3.10 Professional workspace

| Capability | Status | Tier |
| --- | --- | --- |
| Dashboard: who needs a look and why, unopened sessions, 14-day grid, practice due | Built | Demo |
| Roster with search and flags; squads | Built | Demo |
| Person workspace: overview, sessions, practice plans, private notes | Built | Demo |
| Targets per person (score, rate range, sessions a week) and alert rules | Built | Demo |
| Assign practice (mode, pacer, length, times, due) with a note | Built | Demo |
| Comments and kudos on sessions | Built | Demo |
| Compare people week by week | Built | Demo |
| Terminology by professional kind: athletes, clients, students | Missing | Demo |
| Defaults by professional kind: targets, flags, templates, scope requested | Missing | Demo |
| Clinician progress report for their own records (print/PDF, period, no diagnosis fields) | Partial (period report) | Launch |
| In-person session: record a client on the professional's band, saved to the client's account | Missing | Launch for clinicians and coaches (decision needed, `02` §6) |
| Program authoring (multi-week sequences) | Missing | Later |
| Organisations: clinics and clubs with several professionals | Missing | Later |
| Verified-professional badge | Missing | Later |

### 3.11 Notifications and email

| Capability | Status | Tier |
| --- | --- | --- |
| Transactional email: verify, reset, invite, invite accepted, account deleted | Missing | Launch |
| Reminders by email, at most one a day, in priority order: professional assignment > program step > daily reminder > streak at risk (evening, streak ≥ 3) | Missing | Launch |
| Professional digest: who practised, who needs a look (daily or weekly, their choice) | Missing | Launch |
| Quiet hours; every type switchable; one-click unsubscribe | Missing | Launch |
| Web push | Missing | Later |

### 3.12 Help and support

| Capability | Status | Tier |
| --- | --- | --- |
| Help for strap fit, pairing, calibration, browser support, scores explained | Missing | Launch |
| Troubleshoot from the failure itself (pairing failed: charge it, bring it closer, toggle Bluetooth, retry) | Partial | Demo for pairing |
| Contact support (a form or a monitored address) | Missing | Launch |
| Professional guide: getting clients started, what to look for, wellness boundaries | Missing | Launch |

### 3.13 Settings, privacy and data rights

| Capability | Status | Tier |
| --- | --- | --- |
| Settings: goal, skill level, session defaults, sessions a week, sound, phase cue, reminders, gamification toggles, units | Partial | Launch |
| Sharing panel: professionals, scopes, revoke | Built | Demo |
| Privacy policy and terms (individual terms; professional terms) | Missing | Launch |
| Cookie and analytics consent where required | Missing | Launch (D7 in PLAN.md) |

### 3.14 Public site

| Capability | Status | Tier |
| --- | --- | --- |
| Home with the band, the score card, waitlist | Built (waitlist saves to the browser) | Demo |
| For coaches page | Built | Demo |
| For clinicians page, for educators page (wellness wording, reviewed) | Missing | Launch |
| Waitlist stored in the backend with spam protection | Missing | Launch |
| Privacy, terms, contact pages; FAQ (device, battery, browsers, privacy, availability) | Missing | Launch |

### 3.15 Internal

| Capability | Status | Tier |
| --- | --- | --- |
| Admin view: sign-ups, onboarding drop-off, calibration failures, band drops, sessions, D7 and D30 retention by goal and professional kind | Missing | Launch (a SQL view is enough at first) |
| Support tooling: find an account, resend verification, never read sessions without a ticket | Missing | Launch |

## 4. Where the sources disagree (settle before building the area)

| Topic | The disagreement | Working rule |
| --- | --- | --- |
| Calibration frequency | Every session (deck) vs once plus a fit check (spec) vs each time the band goes on (Harry, latest) | Harry's latest; the fit check detects a moved band |
| Calibration length | Five breaths (console) vs three to five (spec) vs 20 s of full breaths (Harry, latest) | D-J |
| Baseline % | Fixed 6% vs per user 5–20% (Harry, latest; confidential) | Keep it a stored per-user value with a default; never shown |
| Duration presets | 2/5/10 vs 3/5/10/custom | D-M |
| Minimum breaths | More than 3 (11/16) vs fewer than 5 flags noisy (spec) | Both: ≤3 no scores; 4 is scored and flagged noisy |
| Colours | Green gauge (11/04) vs teal, never red (spec) vs red in / blue out (demo) | Teal gauge; single-colour line by default with in/out colouring as an option (Harry's preference) |
| Coach access | Second password (deck) vs invite codes (console) | D-H |
| Clinical users | "Through a coach, Casual preset" (docs) vs a clinician track (this pack) | D-G |

## 5. Translating to the app

The same rules hold on the phone; what changes is the medium.

- **Onboarding questions and their consumers** (`02` §2) are platform-free. Port the question set and the tailoring table as data, not as screens, so both clients read the same config.
- **The contract** stays `lib/domain/types.ts`; the Dart models mirror it field for field. The API becomes the app's sync target too, so the app's offline queue writes the same `SessionSummary` and `Waveform`.
- **Scoring** is one TypeScript library today. The app needs it in Dart or needs to upload raw signals and let the API score. Decide before the app's sync work: two implementations need shared golden vectors (they exist: `src/lib/analysis/golden/`).
- **Notifications** move from email to push; the one-a-day priority order is the same.
- **Things the web can't do that the app must:** background sessions with the audio pacer, haptics on each transition, BLE on iOS, health-app export.
