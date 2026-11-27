# Breathband web: development plan

Breathband on the web is two things, which can share one domain:

| Path      | What                                                                 | Audience                         |
| --------- | -------------------------------------------------------------------- | -------------------------------- |
| `/`       | **Public site**: presents Breathband and collects sign-ups (the call to action). Its own repo, [breathband-site](https://github.com/BreathBand/breathband-site), since decision 10 | Prospects, investors, press      |
| `/cloud/` | **BreathCloud console**: sign in and see your breathing data         | Athletes with a band, coaches    |

This plan covers what has to happen, in order, to take the scaffold that exists today to a launched public site and a working console login, where new and returning users can see their data.

Status: **local development only.** No Firebase or Google Cloud dependency is installed. The backend is a Hono API in `server/` on libSQL (a file locally, Turso when shared) with Better Auth, behind the `http` adapter ([decision 10](#decisions)). Nothing is deployed; what a Cloud Run deploy needs is in [docs/deploy.md](deploy.md).

---

## Where things stand

Already done in this repo:

- Next.js 16 + React 19 + TypeScript, built as a **static export** (`out/`): plain files that any static host can serve.
- **Backend seam** (`src/lib/backend/`): every screen talks to `AuthService` and `DataService` interfaces through `useBackend()`. Three adapters exist:
  - `local`: a working, rule-enforcing fake backed by `localStorage`, with seeded demo data. This is the current default.
  - `firebase`: a stub that tells you how to implement it. It's selected with `NEXT_PUBLIC_BACKEND=firebase`.
  - `http`: talks to the API in `server/` ([decision 10](#decisions)). It's selected with `NEXT_PUBLIC_BACKEND=http`; the shared contract tests run against it and against `local`.
- **Domain contract** (`src/lib/domain/types.ts`): `UserProfile`, `SessionSummary`, `Waveform`, `CoachLink`, `Invite`, `WaitlistEntry`. These are the shapes the Flutter app will upload.
- **Placeholder routes**:
  - `/` (waitlist form)
  - `/cloud/login/` and `/cloud/signup/`
  - `/cloud/`: athlete history or coach athlete list, depending on role
  - `/cloud/sessions/?athlete=`
  - `/cloud/session/?athlete=&id=`
- **Draft access rules** in `firebase/firestore.rules` and `firebase/storage.rules`, matching what the local adapter enforces.
- **Deployment target, ready but not deployed**: one `Dockerfile` image for Cloud Run in which the API serves `/api/*` and the static export ([decision 10](#decisions), [Cloud Run](#cloud-run), [docs/deploy.md](deploy.md)). `nginx.conf` is gone. `firebase.json` (Hosting + emulators) is kept as it is but not used.
- **Tests and CI**: Vitest tests define the behaviour every adapter must have, plus the domain helpers (scores, activity flags, breath analysis). GitHub Actions runs lint, typecheck, tests and build.

- **Console styled in the Coach Console direction** (Phase 1 tokens and much of Phase 3 on the local adapter): coach dashboard, roster with search and flags, athlete workspace (overview, sessions table with CSV export, practice plans, private coach notes), session review with waveform, deviation strip, breath table, comments and kudos, sharing scope (scores only, or scores and curves), and an account page. See the README for the routes. Practice plans, comments, kudos and sharing scope are the console side of the v1.1 coaching features in the app's requirements (F22); the app still has to show them (Phase 5). **Live group sessions** (`/cloud/group/`) run on a local simulation of the realtime channel. Going live for real needs the Realtime Database (or another realtime channel), the `createGroupSession` Cloud Function, and the app's join and stream flow (the v2 "Group, live" mode).

- **Product redesign and web recording (2026-11-24, [decision 9](#decisions))**: one design system for the site and the console (`DESIGN.md`); a carbon sidebar shell; the athlete home; the Band page (Web Bluetooth or simulated band, strap gauge); recording (`/cloud/record/` setup, then a full-screen instrument with strap check, calibration circle, circle or line pacer with Web Audio tones, open sessions with two markers); saving with method-C or Appendix open scoring; the method-C and open-metrics review; the two-person (User 1 / User 2) session; demo data generated from the synth library and scored with method C, including the five demo faults. The demo walkthrough is `docs/DEMO.md`.

Demo logins (local only): `coach@demo.local`, `athlete@demo.local`, `sam@demo.local`, `priya@demo.local`, password `breathband`.

---

## Decisions

Made by the owner on 2026-11-23. Where older text in this plan disagrees with one of these, the decision here wins and the older text is marked superseded.

| # | Date | Decision |
| --- | --- | --- |
| 1 | 2026-11-23 | **The deploy target is Google Cloud Run.** ~~Using the existing `Dockerfile` and `nginx.conf`: the static export, served by nginx on `$PORT` 8080.~~ (The nginx part is superseded by [decision 10](#decisions): the API serves the static export.) No Firebase SDK, no Firebase Hosting and no emulators. `firebase/` and `firebase.json` are left untouched. See [Cloud Run](#cloud-run). |
| 2 | 2026-11-23 | **"Cloud" means the backend seam, ready but local.** BreathCloud features run on the local adapter. A documented `http` adapter stub is added for a future Cloud Run API. (The stub is superseded by [decision 10](#decisions): the `http` adapter now talks to the API in `server/`; `local` stays as the demo fallback.) |
| 3 | 2026-11-23 | **The console computes scores**: method C for paced sessions and the Appendix metrics for open sessions, in a shared `src/lib/analysis/` library. This replaces "scores are computed in the app". |
| 4 | 2026-11-23 | **Total Breath Score** is the mean of the four sub-scores, rounded once. |
| 5 | 2026-11-23 | **Web Bluetooth** uses the Nordic UART service UUIDs as a named, labelled assumption, kept in one config file. The simulated sensor is the default. |
| 6 | 2026-11-23 | **PDF is browser print** with print stylesheets. No server rendering. |
| 7 | 2026-11-23 | **A UI overhaul is allowed**, but it goes through `DESIGN.md` first. |
| 8 | 2026-11-24 | **Open-session metrics locate each transition on the raw signal** (confirmed 2026-11-27, decision 12; paced sessions now do too). The Appendix says "Low-pass the signal (~1 Hz, 4th-order Butterworth, zero-phase)." (l.15) and "Find peaks and troughs with prominence ≥ 1% of max and spacing ≥ 0.5 s." (l.16). It does not say whether a transition's time and level come from the filtered or the raw signal, so two readings fit: (a) the extrema are located on the filtered signal; (b) they are detected on the filtered signal, then located on the raw signal at the extremum of the same type within 0.25 s. The filter moves the extrema of asymmetric breaths: on the noise-free normal pattern (1.5 s in, 3.0 s out), reading (a) gives I:E 1.81 and reading (b) gives 2.0. Both use reading (b): open metrics in `analyzeOpen` (`src/lib/analysis/open.ts`) and paced scoring in `analyzePacedRecording` (`src/lib/analysis/session.ts`). |
| 9 | 2026-11-24 | **BreathCloud is a self-standing product, built to take the real band.** Athletes record in the browser: the band over Web Bluetooth (the app's protocol; UUIDs assumed, see `src/lib/device/config.ts`) or the simulated band behind the same `SignalSource` interface. Sessions are scored on save with the analysis library and stored with `DataService.saveSession`. The site and the console share one design system, Carbon & Breath (`DESIGN.md`), which replaces the Coach Console direction (D2). |
| 10 | 2026-11-26 | **The backend is our own API, not Firebase** (`planning/v1/04-infrastructure.md`, its decisions 1, 5 and 6, with the libSQL override at its top). A Hono API on Node 22 lives in `server/` in the same repo and `package.json`, behind the existing `http` adapter, so screens don't change. Data is in libSQL through Drizzle: a file database locally, Turso when shared. Accounts use Better Auth, self-hosted on the API. **One Cloud Run image** serves `/api/*` and the static export from the same origin, so cookies need no CORS; the API took over nginx's security headers. This replaces decision 1's nginx serving, decision 2's `http` stub, and the [Phase 4](#phase-4-move-to-firebase) Firebase plan (Firebase Auth, Firestore, Storage, Functions). The web stays a static export. The `firebase` adapter stays a stub, `firebase/` and `firebase.json` stay as they are, and no cloud SDK is installed. Deploying is described in [docs/deploy.md](deploy.md) and hasn't been done. |
| 11 | 2026-11-26 | **The public site is its own repo, breathband-site.** It was the `(site)` route group here; its history moved with it. The two are built and deployed separately. One domain can still serve both, with `/cloud/*` routed to the console. The site links to the console through `NEXT_PUBLIC_CONSOLE_URL`, and the console links back through `NEXT_PUBLIC_SITE_URL`. The waitlist moved with the site; the Firestore rules for `waitlist/` stay here with the rest of the Firebase project. Each repo keeps a copy of `DESIGN.md` and the tokens. |
| 12 | 2026-11-27 | **Harry's open decisions, taken as yes** (the owner, until Harry says otherwise; `planning/v1/README.md` D-H to D-O, checklist A3 and A4). Method C, the Total formula, the skill bands and the open-session depth band (4.5–7.5%) stand as built (A3). Calibration is 20 s of full breaths once each time the band goes on, scaled from the mean of the top and bottom three, with no per-user baseline yet (D-J). A whole-session rate outside 3–40 breaths a minute is flagged as the band, not the breathing, and scores are unchanged (D-K). We write the programs and Harry approves them; Foundations is approved as written (D-L). Lengths are 2, 3, 5 and 10 min, a length of your own, and "until I stop" for open sessions; 3 min stays because Focus and Calm default to it (D-M). Under-16s stay out (D-N). Decision 8's reading (b) is confirmed and paced sessions now use it too (D-O). Invite codes and links, not a second password (D-H). |

## Decisions already made

| Decision | Why |
| --- | --- |
| **Superseded (2026-11-26) by [decision 10](#decisions).** ~~One web project for the site and the console~~ | ~~One deploy, one domain, `/cloud` is just a folder of routes~~ |
| React (Next.js) for the console, not Flutter web | Faster to load, better for dashboards, and the web-design tooling applies directly |
| Static export with the browser talking to the backend directly | No server to run or pay for. ~~Firebase rules handle authorization.~~ Superseded (2026-11-26) by [decision 10](#decisions): the browser talks to the API in `server/`, which enforces the access rules (`server/authz.ts`). |
| **Superseded (2026-11-23) by [decisions 1 and 2](#decisions).** ~~Firebase as the target backend (Auth, Firestore, Storage, Functions)~~ | ~~Managed, has Flutter and JavaScript SDKs, free tier for early use. Cloud Run is added only for heavy jobs.~~ |
| **Superseded (2026-11-23) by [decision 3](#decisions).** ~~Scores are computed **in the app** and uploaded~~ | ~~Scoring formulas exist in one place (Dart). The console only displays them.~~ |
| `scoringVersion` stored on every session | Old sessions can be told apart (and rescored) when the formula changes |
| Coach access through **one-time invite codes**, not a second password | Can be revoked, leaves an audit trail, and nobody shares passwords. **Spec row 10 says "second password", so this needs client sign-off.** |
| Per-record pages use query strings (`?id=`) | A static export can't prerender per-user dynamic routes |

### Static export rules

Because the build is static, these Next.js features are **off-limits**:

- server actions
- route handlers that read the request
- `proxy` (middleware)
- `cookies()` / `headers()`
- rewrites, redirects and headers in `next.config.ts` (headers are set by the API instead: `SECURITY_HEADERS` in `server/index.ts`; `nginx.conf` is gone, [decision 10](#decisions))
- dynamic `[param]` routes without `generateStaticParams`
- the default `next/image` optimizer

Anything per-user happens in Client Components after load. ~~If a future feature needs a server, the upgrade path is Firebase App Hosting (Next.js on Cloud Run). That change is mostly config, with no rewrite.~~ Superseded (2026-11-26) by [decision 10](#decisions): server work goes in the API in `server/`, and the web stays a static export.

---

## Open decisions (need an owner before the phase that depends on them)

| # | Question | Blocks | Suggested default |
| --- | --- | --- | --- |
| D1 | **Domain name** and registrar | Phase 2 launch | Cloudflare Registrar or Porkbun |
| D2 | **Brand direction**: which of the five client UI directions (or a new one) the web adopts | Phase 1 | The console uses **Coach Console** (Nov 2026). The public site still needs a decision; match whatever the app ships with |
| D3 | **Who can create a web account?** Only people who already set up the app, or anyone (e.g. coaches first)? | Phase 3.2 | Anyone, with role chosen at sign-up. Athletes see an empty state until the app uploads. |
| D4 | **Scoring display**: legacy 0–100% scores, or the 1–10 per-transition method in the metrics spec | Phase 3.4 | Show whatever `scoringVersion` the session has. Build the display for both. |
| D5 | Coach access: invite codes (above) vs the spec's second password | Phase 3.5, 5 | Invite codes |
| D6 | Data region (US vs EU) and retention period | Phase 4 | Region where most users are; keep data until the account is deleted |
| D7 | Analytics on the public site, and whether a cookie banner is needed | Phase 2 | Privacy-friendly analytics without cookies (Plausible / Fathom / Cloudflare Web Analytics) |
| D8 | Who signs off on marketing claims (health, patent) | Phase 2 | The patent attorney + whoever owns regulatory questions |

---

## Phase 1: Brand and design system

The goal is a small shared visual system, so the site and console look like one product.

1. Pick the direction (D2), then define tokens in `src/app/globals.css`: colours (light and dark), type scale, spacing, radii and motion durations. Everything already reads from tokens, so this is a swap.
2. Choose typefaces and load them with `next/font` (self-hosted at build time, so no third-party requests at runtime).
3. Build primitives as components:
   - Button, Input, Select, Card, Stat, EmptyState, ErrorState, Skeleton, Toast
   - page shell (header, footer)
4. Logo usage, favicon set, and social share image template.
5. Run the design detector and the accessibility check (contrast, focus states, tap targets of at least 44 px).

**Done when:** the placeholder pages are restyled using only the primitives, in light and dark mode.

---

## Phase 2: Public site (the call to action)

The site's code is in [breathband-site](https://github.com/BreathBand/breathband-site) (decision 10). This plan still tracks it.

The goal is a page that explains Breathband in under a minute and converts visitors to waitlist sign-ups (later, pre-orders).

### Content and structure

1. **Hero:** one sentence on what Breathband does, a product shot (band + app), and the primary call to action (join the waitlist).
2. **How it works:** three steps: wear the band → follow the pacer → see your score.
3. **What you get:** live pacer, breath scores, session history, BreathCloud for coaches.
4. **Who it's for:** athletes, people working on breathing, coaches.
5. **Proof:** testimonials or pilot results once available. Leave the slot empty rather than invent anything.
6. **FAQ:** device, battery, phones supported, privacy, availability.
7. **Repeat the call to action**, then a footer: Privacy, Terms, Contact, "BreathCloud sign in" → `/cloud/`.

### Supporting pages

`/privacy/`, `/terms/` and `/contact/` (a mailto link is fine to start). A privacy policy is **required** before the app can go into the App Store or Google Play, and it must cover health-related data.

### Guardrails for the copy (D8)

- Stick to **general wellness** language: "train", "practise", "track". Avoid diagnostic or treatment claims ("treats asthma", "improves lung function") unless regulatory review allows them.
- Say "patent pending" only once an application is filed. **Never describe the confidential calibration percentage or other method details.**

### Technical work

- [ ] Metadata, Open Graph and Twitter tags. Generate `sitemap.xml` and `robots.txt` as static route handlers (`export const dynamic = 'force-static'`). Keep `/cloud/*` out of search results (already `noindex`).
- [ ] Images: export at the right sizes as AVIF/WebP. `next/image` needs `unoptimized` or a custom loader under static export, so pre-size the assets.
- [ ] Performance budget: LCP under 2.5 s on a mid-range phone over 4G, and no layout shift from fonts or images.
- [ ] Accessibility: WCAG 2.2 AA, keyboard path through the waitlist form.
- [ ] Analytics (D7) plus events for "waitlist submitted" and "BreathCloud sign-in clicked".
- [ ] Waitlist: the form already writes through `DataService.joinWaitlist`. Add spam protection (honeypot field now, App Check in Phase 4).

**Launch dependency:** in local mode the waitlist only saves to the visitor's own browser. ~~To launch the site publicly, do **Phase 4a** (Hosting + Firestore waitlist) first. It's small and doesn't need the rest of Firebase.~~ Superseded (2026-11-26) by [decision 10](#decisions): with `NEXT_PUBLIC_BACKEND=http` the waitlist is stored by the API (`server/routes/waitlist.ts`), so the public launch needs the Cloud Run deploy ([docs/deploy.md](deploy.md)) instead.

**Done when:** the site is live on the domain, sign-ups land in Firestore, and Lighthouse scores are 90+ across the board.

---

## Phase 3: BreathCloud console (login and data)

The goal is that a new user can create an account and understand what to do next, and a returning user signs in and sees their sessions and trends.

### 3.1 Authentication screens

- [ ] Sign in, with clear errors and "show password".
- [ ] Sign up (name, email, password, role). Send email verification after sign-up, and show a banner until verified.
- [ ] Forgot password: `AuthService.sendPasswordReset` exists. Build the page and the "check your email" state.
- [ ] Session persistence across reloads (Firebase does this; the local adapter already persists).
- [ ] Sign out everywhere it's needed. Redirect back to the page the user wanted after sign-in (`?next=` parameter, same-origin paths only).
- [ ] Later: Sign in with Apple and Google, **in step with the app.** The App Store requires Apple sign-in if Google is offered in the app.

### 3.2 First run vs returning

- **New athlete with no sessions:** an empty state explaining the three steps: get the app → pair the band → record a session. Include app store links. Sessions appear automatically once the app uploads.
- **New coach:** an empty state with an "Enter invite code" form (3.5).
- **Returning athlete:** lands on the dashboard (3.3).
- **Returning coach:** lands on the athlete list (3.5).
- Accounts are **shared with the app.** The same Firebase Auth user signs in on both, so the console has no real data until Phase 5 ships in the app.

### 3.3 Athlete dashboard

- [ ] Headline: last session score, sessions this week, streak.
- [ ] Trend chart: overall score per paced session over time, and breathing rate per open session (as in the spec's home-screen row).
- [ ] Session list with paging (`listSessions({ before })`) and filters (paced/open, date range).
- [ ] Replace `useLoad` with TanStack Query (caching, retries, background refresh). With Firebase, switch the list to a live listener so new uploads appear without a reload.

### 3.4 Session detail

- [ ] A real chart with uPlot (fast with thousands of points): user line vs pacer, zoom and pan, marker lines, and a time axis in seconds.
- [ ] Score breakdown matching the app's review screen. Display by `scoringVersion` (D4).
- [ ] Note editing for the athlete (`updateSessionNote`). Read-only for coaches.
- [ ] Optional: print view / PDF (the spec's export row).

### 3.5 Coach features

- [ ] Athlete list: name, last session date, last score, and a small trend line.
- [ ] Redeem an invite code (`redeemInvite`), with clear errors for an invalid or expired code.
- [ ] Athlete view: reuses the dashboard and session detail, read-only.
- [ ] Athlete side (web and/or app): generate an invite code (`createInvite`), see linked coaches (`listCoaches`), revoke access (`revokeCoach`).

### 3.6 Account settings

- [ ] Change name; change email (with re-verification) and password.
- [ ] **Delete account**: deletes the profile, sessions and waveforms (a Cloud Function in Phase 4). Apple requires in-app deletion for apps with account creation, and offering it on the web too is good practice.
- [ ] Download my data (JSON export).

### 3.7 Quality bar for every screen

Every screen needs: a loading skeleton, an empty state, an error state with retry, "permission denied" handling, a mobile layout (coaches will use phones), and keyboard and screen-reader support.

**Done when:** with the local adapter, a new user can sign up and see the right empty state. The demo athlete can browse trends and session detail. The demo coach can redeem a code, see the athlete and be revoked. All of it is covered by tests.

---

## Phase 4: Move to Firebase

**Superseded (2026-11-23) by [decisions 1 and 2](#decisions), and replaced (2026-11-26) by [decision 10](#decisions).** The backend is the Hono API in `server/` (libSQL/Turso, Better Auth) behind the `http` adapter, deployed as one [Cloud Run](#cloud-run) image. The Firebase steps below are kept for reference only; don't start them.

Do **4a** early, because it unblocks the public launch. Do **4b** when the console and app are ready for real data.

### 4a: Hosting and waitlist

1. Create Firebase projects `breathband-dev` and `breathband-prod`. Copy `.firebaserc.example` to `.firebaserc`.
2. Upgrade to the Blaze plan and **set budget alerts** (e.g. $10 and $50).
3. `npm install firebase` and `npm install -g firebase-tools`, then `firebase login`.
4. Implement `joinWaitlist` in the Firebase adapter: `addDoc(waitlist, { email, source, createdAt: serverTimestamp() })`. Note that `firestore.rules` expects `createdAt`.
5. Deploy: `firebase deploy --only hosting,firestore:rules`. Connect the custom domain in the Firebase console and add the DNS records it gives you.
6. Turn on App Check (reCAPTCHA Enterprise) for the waitlist.

### 4b: Auth, data and Functions

1. Enable email/password in Firebase Auth (Apple and Google later, D-dependent).
2. Create Firestore (choose region, D6) and Storage. Deploy rules and indexes.
3. Implement every method in `src/lib/backend/firebase/index.ts`. The mapping is listed in that file.
4. **Rules tests:** add `@firebase/rules-unit-testing` and port the cases in `src/lib/backend/local/local.test.ts` to run against the emulators. Add the emulator run to CI.
5. Cloud Functions (`functions/`, TypeScript):
   - `redeemInvite`: validates the code, creates the `coachLinks/{coachId}_{athleteId}` doc, deletes the invite.
   - `deleteAccount`: removes Auth user, profile, sessions and waveforms.
   - `onSessionCreated` (optional): notifies linked coaches.
6. CI/CD: deploy to `dev` on merge to `main` and to `prod` on tagged releases, with preview channels for pull requests. Authenticate with Workload Identity Federation (no long-lived keys in GitHub).
7. Operations: scheduled Firestore exports or point-in-time recovery, error tracking (e.g. Sentry), uptime check on `/` and `/cloud/login/`.

---

## Cloud Run

The deploy target ([decisions 1 and 10](#decisions)). `Dockerfile` builds one image: the static export plus the API compiled to `build/server/` (`npm run build:server`). The API serves `/api/*` and the static export, with the security headers nginx used to add, on `$PORT` (8080). It needs `AUTH_SECRET`, `SMTP_HOST` and, on Cloud Run, the Turso settings and `TRUSTED_PROXY_HOPS` at run time. No Firebase SDK, Firebase Hosting or emulators are involved.

**Everything a deploy needs is in [docs/deploy.md](deploy.md)**: the Google Cloud mapping, the environment and secrets, the migrations job, storage, and the "Before first deploy" checklist. Nothing has been deployed.

### Run the container locally

```
AUTH_SECRET=$(openssl rand -base64 32) docker compose --profile full up --build
```

Then open <http://localhost:8080/> (the console is at <http://localhost:8080/cloud/>; emails land in Mailpit on <http://localhost:8025>). `npm run docker:smoke` builds, runs and checks the image. See the README, "Run in a container".

### Build arg: `NEXT_PUBLIC_BACKEND`

`NEXT_PUBLIC_*` values are inlined into the JavaScript at build time, so the backend is picked with a Docker build arg, not a runtime environment variable. Changing it means building a new image. The image defaults to `http` with an empty `NEXT_PUBLIC_API_BASE_URL` (the API on the same origin). `local` builds the demo fallback, which needs no API:

```
docker build --build-arg NEXT_PUBLIC_BACKEND=local -t breathband-console .
```

### Deploy (a person runs this)

**A person runs this step by hand, from their own machine with their own `gcloud` login. CI and agents do not run it**, and no workflow in `.github/workflows/` deploys. It hasn't been run yet. The region waits on D6. The commands, and what must be fixed first, are in [docs/deploy.md](deploy.md).

---

## Phase 5: Flutter app integration (in the `breathband` repo)

The console shows real data only once the app uploads it. This work is a dependency, tracked here so it isn't forgotten.

1. `flutterfire configure` against the same Firebase projects.
2. Onboarding with Firebase Auth (spec row 1). Drop the "second password" if D5 goes to invite codes.
3. **Persist scores at save time.** Today the app computes scores on the review screen (`result_page.dart`) but stores only the raw signal in sqflite. Save the computed `scores`, `respirationRateBpm`, `scoringVersion` and `appVersion` with each session.
4. Upload queue: a `synced` flag on local sessions. When online, upload `Waveform` (gzip JSON) to `waveforms/{uid}/{id}.json.gz`, then write `SessionSummary` to `users/{uid}/sessions/{id}`.
5. Dart models that match `src/lib/domain/types.ts` field for field. Change both together.
6. Invite code UI in the app (generate, list coaches, revoke).

---

## Phase 6: Launch checklist

- [ ] Privacy policy (health data, retention, deletion, processors: Google/Firebase, analytics) and Terms.
- [ ] Data Safety form (Google Play) and privacy labels (App Store) consistent with the policy.
- [ ] Security review: rules tests passing, App Check enforced, no admin credentials in the client, dependencies audited.
- [ ] Backups verified by an actual restore into the dev project.
- [ ] Accessibility and performance passes (Phase 2 and 3 targets).
- [ ] Marketing claims signed off (D8).
- [ ] Budget alerts and error alerts go to a monitored inbox.

---

## Suggested order

```
Phase 1 design system ──► Phase 2 public site ──► Phase 4a hosting + waitlist ──► PUBLIC LAUNCH
                     └──► Phase 3 console (local adapter) ──┐
Phase 5 app accounts + upload (app repo) ───────────────────┴──► Phase 4b Firebase ──► CONSOLE LAUNCH ──► Phase 6
```

Phases 2 and 3 can run in parallel after Phase 1. The console can be fully built and demoed on the local adapter before any Firebase work. The public site can launch well before the console.
