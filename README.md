# Breathband Console

The Breathband website (`/`) and BreathCloud (`/cloud/`): a web product where athletes record breathing sessions with the Breathband over Bluetooth (or a simulated band), get them scored, review every breath and share them with a coach, and where coaches follow their athletes.

**Status:** local development. The console runs on a local demo backend. The deploy target is Google Cloud Run, prepared but not deployed. The roadmap and the decisions behind it are in [docs/PLAN.md](docs/PLAN.md#decisions).

## Quick start

### Run locally

```bash
nvm use            # Node 22
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

### Run in a container

The production image (`Dockerfile`) is one service, the way Cloud Run will run it: the API, compiled by `npm run build:server` (esbuild, no tsx at run time), serves `/api/*` and the static export with the security headers on `$PORT` (8080). It runs as a non-root user and holds no secrets. With Mailpit, a one-shot migration and a file database in a volume:

```bash
AUTH_SECRET=$(openssl rand -base64 32) docker compose --profile full up --build
```

Then open <http://localhost:8080/> (emails land in Mailpit on <http://localhost:8025>). `docker compose --profile full down` stops it; add `-v` to drop the database volume. `npm run docker:smoke` builds the image, runs it, applies the migrations, checks `/api/health`, two pages, the headers and the caching, then removes the container.

The image builds with `NEXT_PUBLIC_BACKEND=http` and an empty API base URL (same origin); `--build-arg NEXT_PUBLIC_BACKEND=local` builds the demo fallback instead. At run time it needs `AUTH_SECRET` (32+ characters) and `SMTP_HOST`; `TURSO_DATABASE_URL` defaults to `file:/app/data/breathband.db`.

Open <http://localhost:3000/cloud/> and sign in with a demo account (password `breathband`, or use the one-click buttons on the sign-in page):

- `coach@demo.local` (Lena Vos): a coach with five athletes. Lands on the dashboard.
- `athlete@demo.local` (Alex Morgan): 8 weeks of sessions scored with method C (the five oldest with the legacy 0–100% way), including the five demo faults (early, shallow, too deep, too fast, lost then recovered) and open sessions with markers. Lands on their home.
- `sam@demo.local` and `priya@demo.local`: the coach's other athletes (one with a score drop, one who hasn't trained for a week).

Demo data lives in your browser's localStorage. Use **Reset** in the sidebar to start over. To record without a band, open **Band**, keep **Simulated band** and press **Start the simulated band**, then **Start a session**. The walkthrough for a demo is in [docs/DEMO.md](docs/DEMO.md).

### What's in the console

The look is **Carbon & Breath**, shared with the public site: a carbon sidebar, bone and carbon neutrals, Funnel Display and Funnel Sans, and the breath (red in, blue out) as the only colour. Recording happens on a full-screen dark instrument. See [DESIGN.md](DESIGN.md).

| Route | Who | What |
| --- | --- | --- |
| `/`, `/coaches/` | Anyone | Public site with its own identity ("Carbon & Breath": warm carbon and bone, Funnel Display/Sans and Geist Mono; the only colour is the breath, red in and blue out). One concise home page (live breathing instrument, why it's different, a session in three steps, the score, who it's for, BreathCloud, where Breathband is today, FAQ) and a BreathCloud page for coaches. The waitlist asks who's joining (athlete, coach, investor or partner) and stores it in `source`. Code in `src/app/(site)/`; set `NEXT_PUBLIC_SITE_URL` for canonical and Open Graph links |
| `/cloud/` | Signed out | BreathCloud landing page: what it is, athletes and coaches, how the app syncs, sharing controls |
| `/cloud/login/`, `/cloud/signup/`, `/cloud/reset/` | Signed out | Sign in (with demo accounts locally), create an account (athlete or coach), password reset. `?next=` returns people to the page they asked for |
| `/cloud/` | Coach | Dashboard: team numbers, "Needs a look" (replies owed, score drops, practice behind, missed days), sessions not yet opened, a 14-day training grid, practice due, recent notes and comments |
| `/cloud/athletes/` | Coach | Roster with search, filters and sorting: latest score, trend, practice progress, flags; redeem an invite code |
| `/cloud/` | Athlete | **Home**: Start a session, the last session as a dark card (score, its breath over the pacer, timing and depth), this week, streak, average, breathing at rest, the 8-week trend, recent sessions, practice and comments |
| `/cloud/device/` | Athlete | **Band**: choose the Breathband over Web Bluetooth or the simulated band, connect, live signal, battery, strap-tension gauge, and the simulated athlete's breathing pattern (steady, early, shallow, too deep, rushed, distracted) |
| `/cloud/record/` | Both | **New session**: paced (5-5 or 2-2) or open, length, circle or line pacer, tones, skill level, or the coach's practice in one tap |
| `/cloud/record/live/?…` | Both | The **recording instrument** (full screen, dark): strap check, calibration circle, countdown, live pacer with Web Audio tones or open breathing with two markers and a live rate, then the score and a note; saving scores it with method C or the Appendix open metrics |
| `/cloud/record/duo/` | Both | **Two-person session** (User 1 / User 2): two bands on one pacer, two lanes, side-by-side scores (not saved) |
| `/cloud/sessions/?athlete=&tab=` | Both | Athlete workspace. Tabs: **Overview** (headline numbers, trends, practice, latest comments), **Sessions** (filterable table, CSV export), **Plan** (coach assigns practice; athlete sees it as "From your coach"), **Notes** (coach's private notes) |
| `/cloud/session/?athlete=&id=` | Both | Session review: scores, waveform vs pacer (zoom, scrub), per-breath deviations, note, comment thread, kudos, the practice it counts toward, print/PDF. Opening it marks it reviewed for the coach |
| `/cloud/sessions/?athlete=&tab=trends` | Both | **Trends**: 7 d / 30 d / 90 d / 6 mo charts (score per session against the target, timing vs depth, breathing rate against its range, sessions per day or week), an automatic plain-words summary against the previous period, and the coach's **targets** (editable by the coach, visible to the athlete) |
| `/cloud/trends/` | Coach | **Compare**: up to six athletes week by week on one chart (score, sessions or breathing rate), pick by squad, and a side-by-side table |
| `/cloud/report/?athlete=&days=` | Both | Printable **progress report** for a period: summary, charts, practice and every session |
| `/cloud/join/?code=` | Athlete | Accept a coach's invite: shows exactly what the coach will see, choose scores only or scores and curves |
| `/cloud/group/` | Coach | Start a live **group session** (pick 2–30 athletes, pacer 5-5 or 2-2, length) and see earlier ones with their group average |
| `/cloud/group/live/?id=` | Coach (host) | Lobby (who has joined), then the live room: the shared pacer, each athlete's breathing in a grid or **lined up on one time axis**, pacer switching, markers, end for everyone; afterwards the results and a replay of everyone lined up in time |
| `/cloud/sharing/` | Athlete | Create invite codes; per coach, choose **scores and curves** or **scores only**, or stop sharing |
| `/cloud/account/` | Both | Name, email, account type, session defaults, appearance (system, light, dark), sign out |

Practice ("assignments") counts a session when its mode, pacer and length match inside the assignment's window (`src/lib/domain/coaching.ts`), so the app doesn't have to tag sessions. A coach whose link is **scores only** can't load waveforms; the review shows a locked panel instead.

**Coach tools adapted from HeartCloud** (a remote-monitoring service the client pointed to): trend charts by period with automatic summaries; per-athlete **targets** with out-of-target sessions marked (diamonds) and flagged; **alert rules** the coach tunes under Account → "What needs a look" (missed days, score drop, under target, trending down, rate out of range, practice behind); **squads** to group athletes (roster, dashboard and group-session filters); a multi-athlete **comparison** chart; **coach-to-athlete invites** by text or email with consent on the athlete's side; and a printable **progress report**. Billing, prescribing, EMR and telehealth parts don't apply to a wellness product and were left out. Chart colours for athletes are validated for colour-blind separation and leave out red and blue (inhale and exhale).

Group sessions follow the "Group, live" mode in the product docs. Each athlete's app streams its band over a realtime channel (draft rules in `firebase/database.rules.json`) and saves an ordinary paced session with `groupSessionId` when the host ends it. The view lines athletes up in time but deliberately computes no synchrony score (patent figure 332, 16 Nov). Locally, `src/lib/backend/local/live.ts` stands in for the channel and the athletes' apps: athletes join the lobby after a few seconds, one drops out briefly, and everyone's breathing follows the pacer about as well as their recent scores. Scores-only athletes' live curves stay private.

Sessions carry legacy 0–100% scores (`legacy-v1`) or the 1–10 per-transition scores (`transition-v1`, `TransitionScores` in `src/lib/domain/types.ts`); the console shows whichever a session has.

## Local infrastructure

The web app on the local adapter needs none of this. It is for the API that is coming (`server/`, see [planning/v1/04-infrastructure.md](planning/v1/04-infrastructure.md)): a database, an SMTP inbox and the environment names every card shares.

```bash
cp .env.example .env.local   # once; keeps the defaults below
npm run infra:up             # Mailpit, waits until healthy
# Mailpit inbox: http://localhost:8025 (SMTP on localhost:1025)
npm run infra:down           # stops every service in the project
```

- **Database: a libSQL file, no container.** The default is `TURSO_DATABASE_URL=file:./data/breathband.db` with no token. `data/` and `*.db` files are gitignored.
- **Shared database: Turso.** Put its `libsql://` URL in `TURSO_DATABASE_URL` and the token in `TURSO_AUTH_TOKEN`, in `.env.local` only. Never commit either. Tests never use it: they run on a file database (card I-03 makes the test setup refuse `libsql://` URLs).
- **Email: Mailpit** (`mail` in `docker-compose.yml`). It accepts any SMTP login, keeps the last 500 messages and has an HTTP API the e2e tests read.
- **Optional sqld.** For parity with Turso's wire protocol: `docker compose --profile sqld up -d --wait sqld`, then `TURSO_DATABASE_URL=http://127.0.0.1:8081`. Its data lives in the `breathband_sqld-data` volume.
- **One Compose project for every worktree.** `docker-compose.yml` sets `name: breathband`, so running `infra:up` from any checkout or worktree reuses the same containers and ports instead of starting a second set. `infra:down` from any of them stops it for all.

Ports: 1025 (SMTP), 8025 (Mailpit UI), 8081 (sqld, only with its profile). Port 8080 belongs to the production image: `--profile full` and `docker:smoke`, one at a time.

## Scripts

| Command             | Does                                                    |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Dev server with hot reload                              |
| `npm run build`     | Static export to `out/`                                 |
| `npm run preview`   | Serves `out/` the way a static host would               |
| `npm test`          | Vitest: backend behaviour tests                         |
| `npm run typecheck` | Generates route types, then runs `tsc`                  |
| `npm run lint`      | ESLint                                                  |
| `npm run check`     | All of the above, as CI runs it                         |
| `npm run infra:up`  | Starts Mailpit in Docker and waits until it's healthy   |
| `npm run infra:down`| Stops and removes the local infrastructure containers   |
| `npm run api:dev`   | The API on :8787 with reload (`server/`, tsx watch)     |
| `npm run db:migrate`| Applies `server/db/migrations` to `TURSO_DATABASE_URL` (default: the file DB) |
| `npm run db:seed`   | Writes the demo people into the database (`db:reset` starts it over) |
| `npm run build:server` | Compiles the API to `build/server/` for the image    |
| `npm run docker:smoke` | Builds, runs and checks the production image         |

## How it's put together

```
src/
├── app/                      routes (static export)
│   ├── page.tsx              /            public site (placeholder)
│   └── cloud/                /cloud/...   console, behind a client-side auth gate
├── lib/
│   ├── domain/types.ts       data contract shared with the Flutter app
│   └── backend/
│       ├── types.ts          AuthService + DataService interfaces
│       ├── index.ts          picks the adapter from NEXT_PUBLIC_BACKEND
│       ├── BackendProvider   React context: useBackend(), useAuth()
│       ├── local/            working fake (localStorage + seeded demo data)
│       ├── http/             talks to the API in server/
│       ├── contract/         the behaviour tests every adapter passes (local and http)
│       └── firebase/         stub, not used (docs/PLAN.md, decision 10)
server/                       the API: Hono, Drizzle on libSQL, Better Auth (decision 10)
├── routes/                   /api/v1/... and the access rules (authz.ts beside it)
├── db/                       schema, committed migrations, seed
└── storage/                  StorageService: fs driver; gcs.ts is a stub
firebase/                     draft Firestore/Storage rules + indexes (not deployed)
firebase.json                 Hosting + emulator config (kept, not used)
Dockerfile                    Cloud Run image: the API serving /api/* and the static export on :8080
```

- **The web build is fully static.** `next build` emits HTML/JS/CSS only. The browser talks to the API in `server/`, and access control lives there (`server/authz.ts`), not in the web app. The local adapter enforces the same rules, and the shared contract tests run against both, so permission errors show up in development.
- **Screens never import an adapter.** They call `useBackend()`; `NEXT_PUBLIC_BACKEND` picks `local` or `http` at build time. No page changes are needed to switch.

## Deploy target: Cloud Run (prepared, not deployed)

The deploy target is **Google Cloud Run**. `gcloud run deploy breathband-web --source . --region <region> --allow-unauthenticated` builds the `Dockerfile` (the API and the static export on :8080; it also needs `AUTH_SECRET`, `SMTP_*` and the database settings, see [Run in a container](#run-in-a-container)). A person runs that by hand; CI and agents don't. Everything a deploy needs (environment, secrets, the migrations job, storage, and what must be fixed first) is in [docs/deploy.md](docs/deploy.md). Nothing has been deployed.

Firebase Hosting is no longer a target. `firebase.json` and `firebase/` stay in the repo unchanged, but nothing deploys them.

## Related

- Mobile app (Flutter): [BreathBand/breathband-app](https://github.com/BreathBand/breathband-app). Session uploads must match `src/lib/domain/types.ts`.
- Specs and design docs: [BreathBand/breathband-docs](https://github.com/BreathBand/breathband-docs), including the metrics and scoring spec the app implements.
