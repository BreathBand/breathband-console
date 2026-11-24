# T-0011 · Add a documented http backend adapter stub for a future Cloud Run API

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 00:34 intake: card drafted with 5 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 00:35 intake: intake confirmed; card sha256 62594a5442442fde3ed85b612a9bac6366aa5e2d1729ff02fd9a99a4924eea0f (arynbht@gmail.com (--yes))
- 2026-11-24 00:35 route: assembly proposed; sha256 57adf44b572c0f013f494a619ca523060ce7c06d8e010eb52a836a225364a9fd; skills none; proof test-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 00:35 route: route approved; assembly sha256 57adf44b572c0f013f494a619ca523060ce7c06d8e010eb52a836a225364a9fd (arynbht@gmail.com (--yes))
- 2026-11-24 00:36 isolate: worktree .worktrees/T-0011 · branch feature/t-0011 from origin/main (7fa76ea1e1d8) · port 5174 · db breathband_console_t0011 · env sha256 21fc284e3fe0bf046dc2c5257e421d7199988cf2330d4ba80529603e98d2fafc (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:37 build: build started · skills spine only · budget 16 steps / 60k ctx · ~23218 prompt tokens · 4 repo file(s) in context · 189556 tokens · $0.47 · 3 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:39 build: build done · commit 201f4a75a543 · 6 file(s) this round · 868832 tokens · $0.90 · 17 turns · I added the `http` backend adapter stub, and it passes all checks. The new test file `src/lib/backend/http/http.test.ts` passed 14 of 14 tests, and `npm run typecheck` and `npm run lint` came back cle (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:39 prove: proof deferred · test-run: the judge's tier 1 run on the change is the proof (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:40 prove: proof passed · test-run (the judge's tier 1 run) (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:40 judge: judge needs a human · round 1 · head 201f4a75a543 · the reviewer wasn't shown .env.example · record sha256 ad2362b15b7fb88eb756eb2634a90564ef7000ed54252410fc14e6c11a9e1513 (rivetari judge (for arynbht@gmail.com))

## Plan

- 2026-11-24 00:37 1. Create src/lib/backend/http/index.ts with no comments. Export a type `HttpRoute = { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: `/v1/${string}` }` and a const `HTTP_ROUTES` shaped `{ auth: Record<keyof AuthService, HttpRoute>; data: Record<keyof DataService, HttpRoute> }`, so typecheck catches a missing method. Give it one entry per method: the 6 auth methods (currentUser GET /v1/auth/me, onAuthStateChanged GET /v1/auth/session, signIn POST /v1/auth/sign-in, signUp POST /v1/auth/sign-up, sendPasswordReset POST /v1/auth/password-reset, signOut POST /v1/auth/sign-out) and every DataService method, from getProfile through joinWaitlist. Data routes follow the resources, e.g. GET /v1/athletes/{athleteId}/sessions, GET /v1/group-sessions/{id}/live and POST /v1/waitlist.
- 2026-11-24 00:37 2. In the same file, export `createHttpBackend(): Backend`, which throws `new Error("NEXT_PUBLIC_BACKEND=http, but the HTTP adapter for the Cloud Run API isn't implemented yet. See src/lib/backend/http/index.ts and src/lib/backend/http/README.md.")`. It does not reference fetch and imports only types from ../types. Follow the pattern of src/lib/backend/firebase/index.ts but add no header comment.
- 2026-11-24 00:37 3. Edit src/lib/backend/types.ts: change `Backend['kind']` from `"local" | "firebase"` to `"local" | "firebase" | "http"`. Add or change no comments; the existing JSDoc stays as it is.
- 2026-11-24 00:37 4. Edit src/lib/backend/index.ts: import createHttpBackend from "./http". `backendKind()` reads `process.env.NEXT_PUBLIC_BACKEND` and returns "http" for "http", "firebase" for "firebase", and "local" otherwise. `createBackend(kind)` dispatches through a switch or lookup: http → createHttpBackend(), firebase → createFirebaseBackend(), otherwise createLocalBackend(). Add no new comments.
- 2026-11-24 00:37 5. Grep src for consumers of `backend.kind` and `BackendKind` (CloudShell.tsx, CloudLanding.tsx, login/page.tsx compare against "local"; BackendProvider.tsx, WaitlistForm.tsx) to confirm the widened union needs no other changes and breaks no exhaustive switch.
- 2026-11-24 00:37 6. Edit .env.example: change `# local | firebase` to `# local | firebase | http`. Add a block such as `# Needed once NEXT_PUBLIC_BACKEND=http (base URL of the future Cloud Run API)` followed by the commented placeholder `# NEXT_PUBLIC_API_BASE_URL=`. Keep NEXT_PUBLIC_BACKEND=local as the default value.
- 2026-11-24 00:37 7. Write src/lib/backend/http/README.md. Cover: what the stub is (Decision 2: local now, http seam for a future Cloud Run API); that it makes no network calls and the factory only throws; a table of the proposed REST route for every AuthService and DataService method, copied exactly from HTTP_ROUTES and grouped auth/data; notes that onAuthStateChanged and currentUser need a client-side session cache and that watchGroupLive needs a streaming transport (SSE or WebSocket); that auth for the API is an open decision (Firebase Auth ID tokens, Cloud Run IAM or the API's own sessions) and is not decided here; and activation steps: implement createHttpBackend against ../types.ts, map HTTP errors to BackendErrorCode, set NEXT_PUBLIC_BACKEND=http and NEXT_PUBLIC_API_BASE_URL, and run the behaviours in ../local/local.test.ts against it. Add no dependency.
- 2026-11-24 00:37 8. Write src/lib/backend/http/http.test.ts (vitest, node env, no comments). Test createHttpBackend(): it throws an Error whose message contains 'NEXT_PUBLIC_BACKEND=http' and 'src/lib/backend/http/index.ts'.
- 2026-11-24 00:37 9. In http.test.ts, test HTTP_ROUTES. Build `createLocalBackend({ store: memoryStore(createSeededDb(new Date(...))), latencyMs: 0 })` and assert the sorted keys of HTTP_ROUTES.auth equal the sorted keys of local.auth that are functions, and do the same for data. Every route's method is in the allowed verb set and its path matches /^\/v1\//.
- 2026-11-24 00:37 10. In http.test.ts, test backendKind() with vi.stubEnv('NEXT_PUBLIC_BACKEND', ...): 'http' gives 'http', 'firebase' gives 'firebase', and 'local', '' and 'other' give 'local'. Call vi.unstubAllEnvs() in afterEach.
- 2026-11-24 00:37 11. In http.test.ts, stub fetch with vi.stubGlobal('fetch', vi.fn()). Assert that `createBackend('http')` throws the same message as createHttpBackend() and that the fetch mock was not called. Unstub globals in afterEach.
- 2026-11-24 00:37 12. In http.test.ts, read .env.example with node:fs readFileSync at path.resolve(process.cwd(), '.env.example'). Assert one line matches /^#\s*local \| firebase \| http\s*$/m and one line matches /^#\s*NEXT_PUBLIC_API_BASE_URL=/m.
- 2026-11-24 00:37 13. Check the diff for new comments in .ts files (none allowed; the only commented lines are the .env.example entries the card requires), for any eslint-disable or ts-ignore, and for anything outside the card's touches. Leave the firebase and local files and their existing tests unchanged.
- 2026-11-24 00:37 14. Run `npm run test -- related --run src/lib/backend/http/index.ts src/lib/backend/index.ts src/lib/backend/types.ts src/lib/backend/http/http.test.ts`, then `npm run typecheck` and `npm run lint`, and fix any failures.

## Decisions

- 2026-11-24 00:34 risk high: derived from the touches: high: secrets handling (.env.example) (the declared medium can't lower it)
- 2026-11-24 00:35 routed to api: api ("api" in the title)
- 2026-11-24 00:35 under the threshold, for the approver: infra, docs
- 2026-11-24 00:35 decided not in: docs (scored only on description keywords)

## Stop-and-ask

- 2026-11-24 00:40 asked: judge: the reviewer wasn't shown .env.example; look at the change
- 2026-11-24 04:48 answered: allowed — Owner (present, 2026-11-24): A5 checked by hand. .env.example diff adds 'local | firebase | http' and a commented NEXT_PUBLIC_API_BASE_URL placeholder; new test asserts both. Ship it.

## Proof

- 2026-11-24 00:40 tests passed (npm test, exit 0, in the judge's tier 1 run on the change) · new tests: src/lib/backend/http/http.test.ts: throws an Error naming the setting and the stub's file; src/lib/backend/http/http.test.ts: has one route per AuthService method; src/lib/backend/http/http.test.ts: has one route per DataService method; src/lib/backend/http/http.test.ts: uses an HTTP verb and a /v1/ path for every route; src/lib/backend/http/http.test.ts: matches the route table in the README; src/lib/backend/http/http.test.ts: returns http for NEXT_PUBLIC_BACKEND=http; src/lib/backend/http/http.test.ts: returns firebase for NEXT_PUBLIC_BACKEND=firebase; src/lib/backend/http/http.test.ts: throws the stub's error without calling fetch; src/lib/backend/http/http.test.ts: is what an NEXT_PUBLIC_BACKEND=http build creates; src/lib/backend/http/http.test.ts: lists http as an allowed NEXT_PUBLIC_BACKEND value; src/lib/backend/http/http.test.ts: has a commented placeholder for the API base URL
- 2026-11-24 00:40 output: …2m[2m27 tests[22m[2m)[22m[32m 79[2mms[22m[39m [32m✓[39m src/lib/backend/http/http.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 14[2mms[22m[39m [2m Test Files [22m [1m[32m5 passed[39m[22m[90m (5)[39m [2m Tests [22m [1m[32m66 passed[39m[22m[90m (66)[39m [2m Start at [22m 19:40:07 [2m Duration [22m 369ms[2m (tests 33%, import 33%, transform 29%, worker 5%)[22m
- 2026-11-24 00:40 evidence: the judge's test run on the evidence branch: https://github.com/BreathBand/breathband-console/blob/evidence/T-0011/test-run.txt?raw=true

## Judge

- 2026-11-24 00:40 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 00:40 review round 1: needs-human; 0 blocking, 3 suggestion(s) (claude-opus-5-5) · 18244 tokens · $0.17
- 2026-11-24 00:40 acceptance A1: met — createHttpBackend() throws an Error whose message contains NEXT_PUBLIC_BACKEND=http and src/lib/backend/http/index.ts; a test asserts both.
- 2026-11-24 00:40 acceptance A2: met — HTTP_ROUTES is typed as Record<keyof AuthService|DataService, HttpRoute> with a GET/POST/PUT/PATCH/DELETE verb and a /v1/ path per entry. New tests compare its keys to the local backend's auth and dat…
- 2026-11-24 00:40 acceptance A3: met — README covers every route (a test checks it matches HTTP_ROUTES), the auth open decision, that the stub makes no network calls, and activation steps. The diff adds no code comments.
- 2026-11-24 00:40 acceptance A4: met — Backend['kind'] includes 'http'. backendKind() and createBackend() are covered in http.test.ts for http, firebase and local/''/other, with a fetch stub asserted not called.
- 2026-11-24 00:40 acceptance A5: unverified — .env.example was withheld from review as a sensitive path, so its contents can't be checked here. The new tests assert both lines (the value list including http, and the commented NEXT_PUBLIC_API_BASE…
