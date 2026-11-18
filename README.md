# Breathband Console

The Breathband website (`/`) and the BreathCloud console (`/cloud/`), where athletes and coaches sign in to see breathing sessions recorded with the Breathband app.

**Status:** local development. The console runs on a local demo backend; Firebase and Google Cloud are prepared for but not installed. The roadmap is in [docs/PLAN.md](docs/PLAN.md).

## Quick start

```bash
nvm use            # Node 22
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

Open <http://localhost:3000/cloud/> and sign in with a demo account (password `breathband`):

- `athlete@demo.local`: an athlete with 8 weeks of sessions
- `coach@demo.local`: a coach linked to that athlete

Demo data lives in your browser's localStorage. Use **Reset demo data** in the banner to start over.

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
firebase.json                 Hosting + emulator config (not used yet)
Dockerfile, nginx.conf        Cloud Run alternative to Firebase Hosting
```

- **The build is fully static.** `next build` emits HTML/JS/CSS only. The browser talks to the backend directly, and access control lives in the backend's rules (`firebase/firestore.rules`), not in a server. The local adapter enforces the same rules, so permission errors show up in development.
- **Screens never import an adapter.** They call `useBackend()`. Moving to Firebase means implementing `src/lib/backend/firebase/index.ts` and setting `NEXT_PUBLIC_BACKEND=firebase`. No page changes are needed.

## Deploy targets (prepared, not active)

- **Firebase Hosting:** `firebase deploy --only hosting` serves `out/` (see `firebase.json`).
- **Cloud Run:** `gcloud run deploy breathband-web --source .` builds the `Dockerfile` (nginx on :8080).

Both steps are in [docs/PLAN.md](docs/PLAN.md#phase-4-move-to-firebase).

## Related

- Mobile app (Flutter): the `breathband` repo. Session uploads must match `src/lib/domain/types.ts`.
