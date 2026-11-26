# Onboarding and tailoring

Two families, six tracks, and how every answer changes the rest of the product.

- **Individuals:** Train (athlete), Focus (student), Calm (casual). Docs priority: Calm, Focus, Train.
- **Professionals:** Coach, Clinician, Educator.

The docs give the individual presets in detail (`product/user-profiles.md`) and say almost nothing about professionals beyond "a lighter web view". The professional tracks below are new, built from the coaching mode, the roles table, the sharing rules and the console's existing coach workspace.

## 1. Principles

These are the lessons to carry to the app as much as the steps themselves.

1. **Every question has a consumer.** If no screen, default, message or report changes because of the answer, the question isn't asked. §7 lists each field and what reads it.
2. **First breath fast.** Target: a calibrated first breath within 6 minutes of "Create account" for an individual with a band (the docs' first-run target), and a professional's first invite sent within 5 minutes.
3. **Ask the minimum before the first win, the rest later.** Optional questions move to a "Tell us more" card on Home after the first session (progressive profiling).
4. **Skippable, with honest defaults.** Every optional step says what the default will be ("We'll start you on 3-minute sessions").
5. **Explain every sensitive field in one line, where it's asked.** Age: "Normal breathing ranges change with age." Never ask for conditions, diagnoses or medication.
6. **Consent is separate and explicit.** Terms, privacy, and processing of breathing data are their own checkbox, with a versioned record. Sharing with a professional is a separate, later choice, made with the exact wording of what is shared.
7. **Resumable everywhere.** Onboarding progress is saved in the backend after every step; closing the tab and signing in on another computer resumes at the same step.
8. **Measure each step.** Started, completed, skipped, and time on step, per track (§9).
9. **Same voice as the product.** Warm for Calm, supportive for Focus, direct for Train, plain and professional for professionals. Keep the manual's warmth ("Good job!", the balloon) and cut every card to one sentence.

## 2. Entry points

| Arrives from | Lands on | What's different |
| --- | --- | --- |
| Site "Get started" | Sign up, "For myself" preselected | Standard individual track |
| Site "For coaches", "For clinicians", "For educators" pages | Sign up, "I work with people" and the kind preselected | Standard professional track |
| A professional's invite link or code | The invite page: who invited them and what they're asking to see, then sign up | Individual track with the professional attached; the goal step is pre-filled from the professional's kind and skippable (§3.5) |
| A professional's in-person session (clinic, team training) | A claim link by email or QR after the session | Account creation claims the session recorded for them (§6) |
| Already uses the phone app | Sign in | `onboardedAt` is set: straight to Home. Anything the app didn't ask (web-only settings) appears as one card on Home |
| No band yet (waitlist, investor, curious) | Sign up, then "I don't have a band yet" at the band step | Sample data mode: a demo person's sessions, clearly labelled, and a waitlist or "where to get one" card |
| A colleague's invite into an organisation | Later | |

## 3. Individual onboarding

Steps in order. **Bold** steps are required; everything else is skippable with the default shown.

### 3.1 The steps

| # | Step | What they see | Why it's asked / what reads it | Skip default |
| --- | --- | --- | --- | --- |
| 1 | **Account** | Name, email, password (show toggle). "For myself" or "I work with people". Two checkboxes: terms and privacy; "Process my breathing data to give me scores" | Identity, role, consent records | none |
| 2 | **Age** | "How old are you?" (number or year of birth). Under 16: "Breathband is for people 16 and over for now." and stop | Age gate (D-N); normal-range context; may feed the per-user baseline (D-J) | none |
| 3 | Verify email | A banner, not a wall: "Check your inbox. You can keep going." | Email deliverability before reminders go out | Continue unverified; reminders and sharing wait for verification |
| 4 | **What brings you to Breathband?** | Three cards: **Train** "Breath control for sport and performance" · **Focus** "Calm and focus for study, exams and sleep" · **Calm** "A daily habit for less stress" | Sets the track; changes defaults, Home, copy tone, programs and reminders. Never scoring | none |
| 5 | Goal questions | Two or three taps, specific to the track (§3.2–3.4) | Each answer feeds a named default (§7) | Track defaults |
| 6 | Experience | "How much breath training have you done?" Never / a little / regularly / a lot, each with one line on what it means for scoring ("We'll be generous while you learn the pacer") | Skill level → tolerance band | Beginner, with a suggestion to move up after 10 sessions with Total ≥ 8 |
| 7 | Your plan | Sessions a week and minutes a day (the ring), prefilled from the track; reminder time and days | Daily ring, streak, reminders, weekly target | Track defaults |
| 8 | About you (optional) | Sex (with "prefer not to say"); "Anything else we should know?" is **not** asked | May feed the per-user baseline once Harry gives the rule; otherwise unused, so leave the step out until it has a consumer | Not collected |
| 9 | **Your band** | Browser check first. Then: connect over Bluetooth · "I'll use the phone app" · "I don't have a band yet" · (dev and demo) simulated band | Device record; route to fit and calibration, or to sample data | none |
| 10 | Strap fit | Three cards with the live gauge: where to wear it (between the belly button and the bottom of the ribs); thread the clip and pull your stomach in; tighten until the gauge turns teal, then lock | A correct fit makes calibration valid | Can't skip if connecting a band |
| 11 | Calibrate | Balloon animation: "Imagine your belly as a balloon." Full breaths for the agreed time (D-J), the circle filling to the edge on each breath in. "Good job." Rejects fewer than three clean breaths once | Per-person, per-band calibration (A100, midline, normal reference) | Can't skip if recording; can postpone ("Calibrate before your first session") |
| 12 | First session | One suggested session for the track (§3.2–3.4), started with one click, with the option to do it later | First win; seeds History | "Later": Home shows "Your first session takes three minutes." |
| 13 | Done | A summary of what was set ("Calm · 3-minute sessions · reminder at 8:00") and where to change it | Trust; discoverability of Settings | |

Order rule: when the band is in hand, fit → calibrate → first session run back to back without returning to Home; that's the "ritual" the docs ask for. When there's no band, steps 10–12 move to a "Set up your band" card on Home.

### 3.2 Train (athlete, performer)

| Ask | Options | Feeds |
| --- | --- | --- |
| What's your sport or activity? | Running, cycling, swimming, team sport, combat sport, strength, climbing, performing (music, voice, stage), other (free text) | Copy examples; program names ("Pre-performance" instead of "Pre-training" for performers); professional matching later |
| What do you want from your breathing? (up to two) | Calm before competition · Recovery after training · Control under effort · Longer, steadier breaths | Which programs are promoted; the first suggested session |
| When do you train? | Days of the week, and morning / midday / evening | Reminder timing: pre-training activation and post-training downshift |
| Do you work with a coach or physio? | Yes, invite them now (link or email) · Not now | Sharing; a pre-filled invite with "scores and curves" as the default scope |

Defaults: Paced 5-5, 10 minutes (first session 3 minutes so the first win is quick); phase cue off; complex detail shown (per-turn table, histogram open); CSV export visible. First suggested session: **Post-training Downshift** (5-5, 3 min) if "recovery", otherwise **Breath Control** (5-5, 3 min).

### 3.3 Focus (student, 16+)

| Ask | Options | Feeds |
| --- | --- | --- |
| When does stress get in the way? (any) | Exams and tests · Presentations · Studying and focus · Falling asleep | Programs promoted; reminder copy |
| Any exams coming up? | Up to five dates (optional) | Exam Week program start; countdown on Home; reminder escalation the week before |
| When do you study, and when are you in class? | Rough times | Reminders outside class (quiet hours) |
| Check in on your mood before and after? | Yes / No (default yes) | Mood check-in (five faces) around each session; "mood change" on Results |
| A teacher or counsellor working with you? | Invite now · Not now | Sharing; default scope **scores only** |

Defaults: Paced 5-5, 3 minutes; phase cue on; simple results. First suggested session: **Focus Sprint** (5-5, 3 min).

### 3.4 Calm (casual)

| Ask | Options | Feeds |
| --- | --- | --- |
| What are you hoping for? (any) | Less stress · Better sleep · A daily habit · Curious about my breathing | Programs promoted; Home's encouraging line |
| When suits you best? | Morning · Lunch · Evening · Bedtime | Reminder time; which program is suggested first (Morning Minute, Lunch Reset, Wind-down) |

Defaults: **Open, 3 minutes**, so the first session measures natural breathing and needs no pacer skill; a paced 5-5 session is suggested on day 3. Phase cue on; minimal results (headline, word, one tip). Gamification: ring and streak on, milestones on. First suggested session: "Just breathe" (Open, 3 min, eyes closed allowed, tones off).

### 3.5 Invited by a professional

The invite page says who invited them and exactly what they'll see: "Lena Vos (coach) would like to see your scores and breathing curves. You can change this or stop sharing at any time."

- **Accept** creates the link at the requested scope; the person can lower it before accepting.
- The goal step is pre-filled from the professional's kind: Coach → Train, Clinician → Calm, Educator → Focus. It can be changed.
- If the professional has already assigned practice, the first suggested session **is** that assignment, locked to its settings.
- Home leads with "From Lena" until the first assignment is done.
- **Clinician invites** turn streak-at-risk reminders off by default and keep copy in the Calm tone: someone in rehab or anxiety work shouldn't be nudged by a streak.
- An existing account accepting an invite skips onboarding and just confirms the share.

## 4. Professional onboarding

### 4.1 The steps

| # | Step | Coach | Clinician | Educator |
| --- | --- | --- | --- | --- |
| 1 | **Account** | As individuals, with "I work with people" | same | same |
| 2 | **What kind of work?** | Coach or trainer | Clinician or therapist | Teacher or counsellor |
| 3 | **Your practice** | Sport(s); team or club name (optional); level (youth 16+, amateur, collegiate, pro) | Profession: physiotherapist, respiratory therapist, physician, psychologist or therapist, nurse, other; clinic or practice name (optional); country | School or college; role (teacher, counsellor, coach); student age range (16+ only in v1) |
| 4 | **What will you use it for?** (any) | Pre-competition calm · Recovery · Breath control under effort · Team warm-ups | Breathing pattern practice between visits · Stress and anxiety skills · Recovery after injury or surgery · Performance (sports medicine) | Exam stress · Focus before study · Class calm |
| 5 | **How you'll refer to people** | "Athletes" (default) | "Clients" (default; "patients" is not offered in v1, D-G) | "Students" |
| 6 | **Professional terms** | Standard professional terms | Professional terms **plus** a wellness acknowledgement: "Breathband is a wellness tool. It doesn't diagnose, treat or monitor any condition. Don't record diagnoses, medical history or treatment in BreathCloud." | Professional terms plus "Only invite students aged 16 or over." |
| 7 | Defaults for the people you invite | Targets: Total 7, 4 sessions a week. Flags: 3 missed days, Total down 2. Scope requested: scores and curves | Targets: 5 sessions a week, no score target at first. Flags: 3 missed days only (no score-drop flag at the start). Scope requested: scores and curves | Targets: 3 sessions a week. Flags: off. Scope requested: scores only |
| 8 | Practice templates | Pre-training Activation (2-2, 2 min), Post-training Downshift (5-5, 8 min), Breath Control Block | Daily slow breathing (5-5, 5 min), weekly open check (Open, 3 min), "between visits" plan | Focus Sprint (5-5, 3 min), Exam Week, Class calm (group, 5-5, 3 min) |
| 9 | Try it yourself (recommended) | Connect a band, calibrate, record one session: "You'll coach it better once you've felt it." | same: "Do what you'll ask your clients to do." | same |
| 10 | **Invite your first people** | Link, email, QR code; bulk by CSV (name, email); add to a squad | Link, email, QR; one at a time (no bulk: caseloads are individual) | Link, QR to show in class; group code |
| 11 | Done | A checklist on the dashboard: invite three athletes · set a squad · assign the first practice · record your own session | invite a client · assign a between-visits plan · see a sample client · read the professional guide | invite your class · run a class session · set a weekly target |

### 4.2 Coach

- **Dashboard emphasis:** who practised this week, who needs a look (missed days, score drop), squad comparison, practice due.
- **Squads** are central: create one during onboarding if a team name was given.
- **Live group** for team warm-ups and **two-person** for demonstrations.
- **Tone:** numbers first. Flags read "Missed 3 days" and "Total down 2.1 since last week".

### 4.3 Clinician

The persona the docs don't cover. What makes it different:

- **Workflow:** an in-person first visit (baseline open session, then a first paced session) → a between-visits plan (daily practice) → review before the next visit → a progress report for their own notes.
- **In-person session** (§6): record the client on the clinician's band in the room, saved to the client's account once the client accepts.
- **Progress report:** the period report, with the client's sessions, adherence against the plan, trends in rate, rhythm and depth, and the clinician's comments. No diagnosis, condition or treatment fields anywhere on it.
- **Private notes** stay, with a standing hint: "For practice notes only. Don't record diagnoses or medical history here." (D-G)
- **Flags use neutral words:** "worth a look", never "abnormal", "alert" or "risk".
- **Access log** for the client: every time a professional opens a session, the client can see it. Clinicians expect this; clients trust it.
- **Why the posture matters:** a clinician entering patient information in BreathCloud may make the data health records under HIPAA (US) or special-category data under GDPR (EU), which brings contracts (a BAA, a DPA), security duties and possibly device regulation if the product is used to treat or monitor a condition. The design keeps the client as the account owner and the data as wellness data; **counsel must confirm before real clinicians onboard real clients.** This doesn't block the demo with fictional people.

### 4.4 Educator

- **Class first:** a group code students join; a class session on one pacer; who's practising, never a ranking.
- **Scores only** by default; curves only if a student chooses.
- **Under-16s can't be invited** in v1; the invite page repeats the age gate.
- Challenges on days completed (Later) fit this track best.

## 5. Tailoring after onboarding

### 5.1 Individuals

| Surface | Train | Focus | Calm | Invited by a clinician |
| --- | --- | --- | --- | --- |
| Home | Score tile + week card (average rate, depth trend, sessions vs plan); dense | Score tile + mood change + exam countdown and study-day strip | Score tile, daily ring, streak, one encouraging line; minimal | "From your clinician" card first; score tile; no streak pressure |
| New session defaults | Paced 5-5, 10 min, phase cue off | Paced 5-5, 3 min, phase cue on | Open, 3 min; paced suggested on day 3 | The assignment, locked |
| Live session | Line or circle; no cue | Circle, cue on | Circle, cue on, tones soft | As assigned |
| Results emphasis | Every sub-score, I:E, per-turn table, histogram open, CSV | Headline, % of time calm, mood change | Headline, word label, one tip | Headline and what the clinician asked to track |
| Coaching line | "Exhale timing 7. You cut exhales short on breaths 4 to 9." | "Four calm minutes before your exam. Rate dropped from 17 to 12." | "Nice. Three days in a row." | "Done for today. Lena will see this before your next visit." |
| History default | 30 days, Total and rate | 7 days, with exam dates marked | Calendar of rings | Since the plan started |
| Programs promoted | Breath Control Block (28 d), Pre-training Activation, Post-training Downshift | Exam Week (7 d), Focus Sprint, Wind-down | Foundations (14 d), Morning Minute, Lunch Reset | The clinician's plan only |
| Reminders | Before and after training days | Outside class; more in exam week | One daily time | Plan reminders only; no streak-at-risk |
| Gamification | Ring, streak; weekly summary (Later) | Ring, streak, mood change | Ring, streak, milestones | Milestones only |
| Help surfaced | Reading the per-turn table; pacer tips | Using it before an exam | What the score means; wearing the band | What your clinician sees |
| Sharing default | Coach or physio, scores and curves | Teacher or counsellor, scores only | Off | As accepted |
| Empty states | "Your first session sets your baseline." | "Three minutes before you study." | "Your first session takes three minutes." | "Lena has set your first practice." |

### 5.2 Professionals

| Surface | Coach | Clinician | Educator |
| --- | --- | --- | --- |
| People are called | Athletes | Clients | Students |
| Dashboard | Practice due, squad grid, flags | Clients with a visit soon (Later), adherence, worth a look | Class participation, who joined |
| Default flags | 3 missed days, Total down 2 | 3 missed days | Off |
| Default targets | Total 7, 4 a week, rate 12–16 | 5 a week | 3 a week |
| Templates | Activation, Downshift, Control Block | Daily slow breathing, weekly open check | Focus Sprint, Exam Week, Class calm |
| Report | Squad week-by-week, CSV | Per-client progress report (print/PDF) | Class participation |
| Scope requested | Scores and curves | Scores and curves | Scores only |
| Live tools | Group warm-up, two-person | Two-person (demonstrate, then client) | Class session |
| Emails | Daily digest | Weekly digest, before visit days later | Weekly digest |

### 5.3 Changing track later

- Switching goal rewrites only the defaults the person hasn't customised (docs rule). Saved sessions and scores never change.
- A professional can add a second kind (a physio who also coaches) and pick the terminology per person.

## 6. Edge cases

| Case | Behaviour |
| --- | --- |
| No compatible browser (Safari, Firefox, iOS) | Before the band step: "Recording needs Chrome or Edge on a computer or Android phone." Offer the phone app (when it ships) or the simulated band to look around |
| No band yet | Sample data mode, labelled "Sample" everywhere, plus a waitlist or "Get a band" card. Leaving it wipes the sample |
| Calibration fails twice | Stop and offer the strap guide again and help; never a dead end |
| Back after 30 days or the band was taken off | Fit check fails → re-calibrate; the copy says why ("The band has shifted. Let's re-check your range.") |
| Under 16 | Stopped at the age step; no data kept beyond a counter |
| A person with two professionals (coach and physio) | Two links, two scopes; Home shows both; each sees only their own comments and notes |
| A professional who also breathes | "My practice" with their own sessions; their own data is never visible to their clients |
| In-person session (clinic, team training) | The professional records on their band under "Session for someone else", enters the person's email, and the session is held for 14 days until the person accepts by email. Calibration is the person's own (taken in the session), never the professional's. Unclaimed sessions are deleted. **Needs a decision and counsel's view for clinicians** |
| Invite to an email that already has an account | Sign in, then confirm the share; no second account |
| Invite expired or revoked | Clear message and "Ask Lena for a new link" |
| A person revokes a professional | The professional loses access at once; their notes about that person are kept only for them, for 30 days, then deleted (decide) |
| Account deletion with active professional links | Professionals are told the person left, not why |
| Professional leaves | Clients are told and their links end; their data stays theirs |

## 7. What onboarding stores, and what reads it

| Field | Asked in | Read by | Sensitivity |
| --- | --- | --- | --- |
| `displayName`, `email` | Account | Everything | Personal |
| `role` (`athlete` / `coach`, unchanged), `proKind` (`coach` / `clinician` / `educator`) | Account, kind | Navigation, terminology, defaults | Low |
| `consents[]` (kind, version, time) | Account, terms | Legal record | Low |
| `birthYear` or `age` | Age | Age gate; normal-range copy; per-user baseline (pending D-J) | Personal |
| `sex` (optional) | About you, only once it has a consumer | Per-user baseline (pending D-J) | Personal |
| `preferences.goal` (`train` / `focus` / `calm`) | Goal | Home, defaults, copy, programs, reminders | Low |
| `preferences.goalDetails` (sport, focus areas, exam dates, study and class times, hopes, best time) | Goal questions | Programs promoted, reminders, copy examples | Low; exam dates are personal |
| `preferences.skillLevel` | Experience | Tolerance band | Low |
| `preferences.session`, `sessionsPerWeek`, `dailyMinutes`, `reminders` | Plan | New session, ring, streak, emails | Low |
| `preferences.gamification` toggles, `moodCheckins` | Plan, Focus | Home, Results | Low |
| `devices`, `calibrations` | Band, calibrate | Recording, fit check | Breathing data |
| `proProfile` (organisation, profession, sports, use cases, terminology, default targets, flags, scope requested) | Professional steps | Dashboard, invites, reports | Professional |
| `onboarding` (current step, completed steps, skipped steps, timestamps) | Every step | Resume; funnel analytics | Low |

Never collected in v1: conditions, diagnoses, medication, weight, height, or free-text health history.

## 8. Copy samples

| Moment | Train | Focus | Calm | Professional |
| --- | --- | --- | --- | --- |
| Welcome | "Breath control you can measure." | "Calm you can take into the exam room." | "A few calm minutes a day." | "See how the people you work with breathe between sessions." |
| Before calibration | "Full breaths. Fill the belly, empty it completely." | "Imagine your belly as a balloon." | "Imagine your belly as a balloon." | "Your clients will do this once each time they put the band on." |
| After calibration | "Range set. Let's go." | "Good job. You're ready." | "Good job." | "That's the step your clients will do. Next: invite one." |
| Streak paused | "Streak paused. Back at it today." | "Your streak paused. Three minutes picks it back up." | "Your streak paused. Start today to pick it back up." | n/a |

## 9. Measuring it

Events, each with track, step and time: `onboarding_step_viewed`, `onboarding_step_completed`, `onboarding_step_skipped`, `browser_unsupported`, `band_connect_result`, `strap_fit_result`, `calibration_result`, `first_session_started`, `first_session_saved`, `invite_sent`, `invite_accepted`, `sample_mode_entered`. No breathing data in any event.

Launch targets (to revisit after the first 30 users):

| Measure | Target |
| --- | --- |
| Individuals with a band: account to first calibrated breath | Median under 6 min; 80% complete |
| First session saved within 24 h of sign-up | 70% |
| D7: a session in days 2–7 | 50% (the docs' beta gate is 60% in week 2) |
| Professionals: account to first invite sent | Median under 5 min |
| Invites accepted within 7 days | 60% |

## 10. Carrying this to the app

- The steps and tailoring tables are **data**: store the question set, defaults per track and copy per tone in one config both clients read (the docs already want programs and thresholds remote-configurable).
- The app adds what the web can't: OS Bluetooth permission with its one-line reason, notifications permission (ask after the first session, not during onboarding), haptics, background audio pacer.
- The app's first run is shorter for invited people, as here: the professional's setup replaces most questions.
- Measure the same events with the same names, so web and app funnels compare.
