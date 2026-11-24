# Breathband Console

The Breathband website (`/`) and the BreathCloud console (`/cloud/`), where athletes and coaches sign in to see breathing sessions recorded with the Breathband app.

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

The same static build the deploy uses, served by nginx on port 8080:

```bash
docker build -t breathband-console .
docker run -p 8080:8080 breathband-console
```

Then open <http://localhost:8080/>. The backend is chosen at build time with `--build-arg NEXT_PUBLIC_BACKEND=local` (the default); see [Cloud Run](docs/PLAN.md#cloud-run).

Open <http://localhost:3000/cloud/> and sign in with a demo account (password `breathband`, or use the one-click buttons on the sign-in page):

- `coach@demo.local` (Lena Vos): a coach with three athletes. Lands on the roster.
- `athlete@demo.local` (Alex Morgan): 8 weeks of sessions, the oldest scored the legacy 0–100% way. Lands on their overview.
- `sam@demo.local` and `priya@demo.local`: the coach's other athletes (one with a score drop, one who hasn't trained for a week).

Demo data lives in your browser's localStorage. Use **Reset** in the top bar to start over.

### What's in the console

The look is the **Coach Console** design direction (graphite top bar, IBM Plex, dense panes; tokens in `src/app/globals.css`, layout in `src/app/cloud/console.css`).

| Route | Who | What |
| --- | --- | --- |
| `/`, `/coaches/` | Anyone | Public site with its own identity ("Carbon & Breath": warm carbon and bone, Funnel Display/Sans and Geist Mono; the only colour is the breath, red in and blue out). One concise home page (live breathing instrument, why it's different, a session in three steps, the score, who it's for, BreathCloud, where Breathband is today, FAQ) and a BreathCloud page for coaches. The waitlist asks who's joining (athlete, coach, investor or partner) and stores it in `source`. Code in `src/app/(site)/`; set `NEXT_PUBLIC_SITE_URL` for canonical and Open Graph links |
| `/cloud/` | Signed out | BreathCloud landing page: what it is, athletes and coaches, how the app syncs, sharing controls |
| `/cloud/login/`, `/cloud/signup/`, `/cloud/reset/` | Signed out | Sign in (with demo accounts locally), create an account (athlete or coach), password reset. `?next=` returns people to the page they asked for |
| `/cloud/` | Coach | Dashboard: team numbers, "Needs a look" (replies owed, score drops, practice behind, missed days), sessions not yet opened, a 14-day training grid, practice due, recent notes and comments |
| `/cloud/athletes/` | Coach | Roster with search, filters and sorting: latest score, trend, practice progress, flags; redeem an invite code |
| `/cloud/` | Athlete | Their own workspace (as below, without Notes) |
| `/cloud/sessions/?athlete=&tab=` | Both | Athlete workspace. Tabs: **Overview** (headline numbers, trends, practice, latest comments), **Sessions** (filterable table, CSV export), **Plan** (coach assigns practice; athlete sees it as "From your coach"), **Notes** (coach's private notes) |
| `/cloud/session/?athlete=&id=` | Both | Session review: scores, waveform vs pacer (zoom, scrub), per-breath deviations, note, comment thread, kudos, the practice it counts toward, print/PDF. Opening it marks it reviewed for the coach |
| `/cloud/sessions/?athlete=&tab=trends` | Both | **Trends**: 7 d / 30 d / 90 d / 6 mo charts (score per session against the target, timing vs depth, breathing rate against its range, sessions per day or week), an automatic plain-words summary against the previous period, and the coach's **targets** (editable by the coach, visible to the athlete) |
| `/cloud/trends/` | Coach | **Compare**: up to six athletes week by week on one chart (score, sessions or breathing rate), pick by squad, and a side-by-side table |
| `/cloud/report/?athlete=&days=` | Both | Printable **progress report** for a period: summary, charts, practice and every session |
| `/cloud/join/?code=` | Athlete | Accept a coach's invite: shows exactly what the coach will see, choose scores only or scores and curves |
| `/cloud/group/` | Coach | Start a live **group session** (pick 2–30 athletes, pacer 5-5 or 2-2, length) and see earlier ones with their group average |
| `/cloud/group/live/?id=` | Coach (host) | Lobby (who has joined), then the live room: the shared pacer, each athlete's breathing in a grid or **lined up on one time axis**, pacer switching, markers, end for everyone; afterwards the results and a replay of everyone lined up in time |
| `/cloud/sharing/` | Athlete | Create invite codes; per coach, choose **scores and curves** or **scores only**, or stop sharing |
| `/cloud/account/` | Both | Name, email, account type, sign out |

Practice ("assignments") counts a session when its mode, pacer and length match inside the assignment's window (`src/lib/domain/coaching.ts`), so the app doesn't have to tag sessions. A coach whose link is **scores only** can't load waveforms; the review shows a locked panel instead.

**Coach tools adapted from HeartCloud** (a remote-monitoring service the client pointed to): trend charts by period with automatic summaries; per-athlete **targets** with out-of-target sessions marked (diamonds) and flagged; **alert rules** the coach tunes under Account → "What needs a look" (missed days, score drop, under target, trending down, rate out of range, practice behind); **squads** to group athletes (roster, dashboard and group-session filters); a multi-athlete **comparison** chart; **coach-to-athlete invites** by text or email with consent on the athlete's side; and a printable **progress report**. Billing, prescribing, EMR and telehealth parts don't apply to a wellness product and were left out. Chart colours for athletes are validated for colour-blind separation and leave out red and blue (inhale and exhale).

Group sessions follow the "Group, live" mode in the product docs. Each athlete's app streams its band over a realtime channel (draft rules in `firebase/database.rules.json`) and saves an ordinary paced session with `groupSessionId` when the host ends it. The view lines athletes up in time but deliberately computes no synchrony score (patent figure 332, 16 Nov). Locally, `src/lib/backend/local/live.ts` stands in for the channel and the athletes' apps: athletes join the lobby after a few seconds, one drops out briefly, and everyone's breathing follows the pacer about as well as their recent scores. Scores-only athletes' live curves stay private.

Sessions carry legacy 0–100% scores (`legacy-v1`) or the 1–10 per-transition scores (`transition-v1`, `TransitionScores` in `src/lib/domain/types.ts`); the console shows whichever a session has.

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
│       └── firebase/         stub, implemented in Phase 4
firebase/                     draft Firestore/Storage rules + indexes (not deployed)
firebase.json                 Hosting + emulator config (kept, not used)
Dockerfile, nginx.conf        Cloud Run image: static export served by nginx on :8080
```

- **The build is fully static.** `next build` emits HTML/JS/CSS only. The browser talks to the backend directly, and access control lives in the backend's rules (`firebase/firestore.rules`), not in a server. The local adapter enforces the same rules, so permission errors show up in development.
- **Screens never import an adapter.** They call `useBackend()`. Moving off the local adapter (the plan is an `http` adapter for a future Cloud Run API) means implementing an adapter and selecting it with `NEXT_PUBLIC_BACKEND`. No page changes are needed.

## Deploy target: Cloud Run (prepared, not deployed)

The deploy target is **Google Cloud Run**. `gcloud run deploy breathband-web --source . --region <region> --allow-unauthenticated` builds the `Dockerfile` (nginx on :8080). A person runs that by hand; CI and agents don't. Details are in [docs/PLAN.md](docs/PLAN.md#cloud-run).

Firebase Hosting is no longer a target. `firebase.json` and `firebase/` stay in the repo unchanged, but nothing deploys them.

## Related

- Mobile app (Flutter): [BreathBand/breathband-app](https://github.com/BreathBand/breathband-app). Session uploads must match `src/lib/domain/types.ts`.
- Specs and design docs: [BreathBand/breathband-docs](https://github.com/BreathBand/breathband-docs), including the metrics and scoring spec the app implements.
