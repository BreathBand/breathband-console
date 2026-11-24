# T-0008 · Add a documented http backend adapter stub for a future Cloud Run API

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 00:14 intake: card drafted with 5 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 00:14 intake: intake confirmed; card sha256 8b5250a89b7f2d81b10e51cffcb4d11ec147537db9e83a2364794be6d7646ddf (arynbht@gmail.com (--yes))
- 2026-11-24 00:14 route: assembly proposed; sha256 6f7f077a8c2e3702d142ca2b01f5725af0217acca49ab0977e684e6aabaa44c9; skills none; proof test-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 00:14 route: assembly proposed; sha256 6f7f077a8c2e3702d142ca2b01f5725af0217acca49ab0977e684e6aabaa44c9; skills none; proof test-run; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 00:15 route: route approved; assembly sha256 6f7f077a8c2e3702d142ca2b01f5725af0217acca49ab0977e684e6aabaa44c9 (arynbht@gmail.com (--yes))
- 2026-11-24 00:17 isolate: worktree .worktrees/T-0008 · branch feature/t-0008 from origin/main (7fa76ea1e1d8) · port 5174 · db breathband_console_t0008 · env sha256 ae19ff028748304fe2835ada626aae076be0f2e66624da3e8a59ba52e39b2ede (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:17 build: build started · skills spine only · budget 16 steps / 60k ctx · ~23114 prompt tokens · 4 repo file(s) in context · 190417 tokens · $0.48 · 3 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:21 build: build done · commit 7618c9bdaa64 · 6 file(s) this round · 1113616 tokens · $1.01 · 18 turns · I added the http backend stub. Lint, typecheck, the 16 new tests and `npm run build` all pass. I didn't run the full test suite; the judge runs that on a clean clone. (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:21 prove: proof deferred · test-run: the judge's tier 1 run on the change is the proof (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:21 prove: proof passed · test-run (the judge's tier 1 run) (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:22 judge: judge failed · round 1 · head 7618c9bdaa64 · 1 blocking · record sha256 0d127c01b1e06af38edf07d3d452aae0cf375e5b72c59665d065996511ea4c4a (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 00:22 build: build paused: 1 thing(s) to ask about · commit 7618c9bdaa64 · 111899 tokens · $0.39 · 3 turns · retry (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 00:17 1. Create src/lib/backend/http/index.ts and copy the shape of firebase/index.ts. Export createHttpBackend(): Backend. It imports nothing that touches the network and throws new Error("NEXT_PUBLIC_BACKEND=http, but the HTTP adapter for the Cloud Run API isn't implemented yet. See src/lib/backend/http/index.ts.").
- 2026-11-24 00:17 2. Conflict to flag: A2 asks for a header comment, but the judge's diff.no-new-comments rule fails the round on any new code comment. Plan: write no comments. Put the documentation in data instead, in the same file: export an HTTP_ROUTES constant typed `satisfies Record<keyof AuthService | keyof DataService, { method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; path: string }>`, so typecheck fails if any interface method lacks a route. Also export HTTP_AUTH_STATUS = "open-decision" and HTTP_NETWORK_CALLS = false. Mention this choice in the PR so a person can rule on how A2 is read.
- 2026-11-24 00:17 3. Fill HTTP_ROUTES for every AuthService method (currentUser, onAuthStateChanged, signIn, signUp, sendPasswordReset, signOut) and every DataService method in types.ts, under a /v1 prefix. Examples: listSessions GET /v1/athletes/{athleteId}/sessions?limit&before; getWaveform GET /v1/athletes/{athleteId}/sessions/{sessionId}/waveform; redeemInvite POST /v1/coaches/{coachId}/invites/redeem; group sessions under /v1/group-sessions/{id}/start|pacer|markers|end|cancel; watchGroupLive GET /v1/group-sessions/{id}/live (stream); joinWaitlist POST /v1/waitlist.
- 2026-11-24 00:17 4. Add src/lib/backend/http/README.md, which the card's src/lib/backend/http/** glob allows. It explains the stub, says how to read HTTP_ROUTES, states that auth (Firebase ID token, Identity Platform or a session cookie) is an open decision, says the stub makes no network calls, and lists the activation steps: implement the adapter, set NEXT_PUBLIC_BACKEND=http and NEXT_PUBLIC_API_BASE_URL, and run the cases in ../local/local.test.ts against it.
- 2026-11-24 00:17 5. In src/lib/backend/types.ts, change Backend's kind to "local" | "firebase" | "http" and change nothing else in the file.
- 2026-11-24 00:17 6. In src/lib/backend/index.ts, import createHttpBackend from "./http". backendKind() returns "firebase" or "http" when NEXT_PUBLIC_BACKEND matches exactly, else "local". createBackend() uses a switch on kind (firebase → createFirebaseBackend, http → createHttpBackend, default → createLocalBackend). Add no comments.
- 2026-11-24 00:17 7. Check the UI uses of backend.kind (CloudShell.tsx:121, CloudLanding.tsx:70, login/page.tsx:138). They compare only to "local", so http typechecks and needs no page change.
- 2026-11-24 00:17 8. In .env.example, change the allowed-values line to "# local | firebase | http". Add a commented placeholder "# NEXT_PUBLIC_API_BASE_URL=https://<service>-<hash>.run.app" with a line saying it's needed once NEXT_PUBLIC_BACKEND=http.
- 2026-11-24 00:17 9. Create src/lib/backend/http/http.test.ts (vitest; vi.stubEnv / vi.unstubAllEnvs in afterEach). Tests: createHttpBackend() throws an Error whose message contains "NEXT_PUBLIC_BACKEND=http" and "src/lib/backend/http/index.ts"; createBackend("http") throws the same message.
- 2026-11-24 00:17 10. In the same test file: backendKind() returns "http" for NEXT_PUBLIC_BACKEND=http, "firebase" for firebase, and "local" for unset, "local", "HTTP" and "rest". Also check that createBackend("http") calls neither fetch nor XMLHttpRequest (spy on globalThis.fetch via vi.spyOn or vi.stubGlobal).
- 2026-11-24 00:17 11. Also in http.test.ts: build createLocalBackend({ store: memoryStore(createSeededDb(now)), latencyMs: 0 }) and assert that Object.keys(HTTP_ROUTES), sorted, equals the sorted keys of its auth and data objects. Every route path starts with "/v1/" and every method is a valid HTTP verb. This imports from local/ without changing it.
- 2026-11-24 00:17 12. Check the diff for added comments in .ts files, suppressions, new dependencies and any change under src/lib/backend/local/**. Confirm that only http/**, index.ts, types.ts and .env.example changed and package.json is untouched.
- 2026-11-24 00:17 13. Run npm run lint and npm run typecheck and fix anything they report.
- 2026-11-24 00:17 14. Run npm run test -- related --run src/lib/backend/http/http.test.ts src/lib/backend/index.ts src/lib/backend/types.ts src/lib/backend/http/index.ts and make sure it passes.
- 2026-11-24 00:17 15. Run npm run build to confirm the static export still builds with the default local backend.

## Decisions

- 2026-11-24 00:14 risk high: derived from the touches: high: secrets handling (.env.example) (the declared medium can't lower it)
- 2026-11-24 00:14 routed to api: api ("api" in the title)
- 2026-11-24 00:14 under the threshold, for the approver: infra
- 2026-11-24 00:14 routed to api: api ("api" in the title)
- 2026-11-24 00:14 under the threshold, for the approver: infra

## Stop-and-ask

- 2026-11-24 00:22 asked: agent_question: A2 needs a header comment in src/lib/backend/http/index.ts, but the diff.no-new-comments rule (.rivetari/profile.yml `quality.no-new-comments: true`) fails the round on any new comment. Which should give way: (a) allow the header comment in this file anyway, (b) change A2 so the exported HTTP_ROUTES/HTTP_AUTH/HTTP_NETWORK_CALLS data plus src/lib/backend/http/README.md count as the documentation, or (c) something else?

## Proof

- 2026-11-24 00:21 tests passed (npm test, exit 0, in the judge's tier 1 run on the change) · new tests: src/lib/backend/http/http.test.ts: throws, naming the setting and pointing to the stub; src/lib/backend/http/http.test.ts: makes no network calls; src/lib/backend/http/http.test.ts: leaves auth as an open decision; src/lib/backend/http/http.test.ts: throws the stub's error for http; src/lib/backend/http/http.test.ts: picks http from NEXT_PUBLIC_BACKEND=http; src/lib/backend/http/http.test.ts: still builds the local backend by default; src/lib/backend/http/http.test.ts: returns http for NEXT_PUBLIC_BACKEND=http; src/lib/backend/http/http.test.ts: still returns firebase for NEXT_PUBLIC_BACKEND=firebase; src/lib/backend/http/http.test.ts: returns local when unset; src/lib/backend/http/http.test.ts: has a route for every AuthService and DataService method; src/lib/backend/http/http.test.ts: uses a valid verb and a /v1/ path for every route
- 2026-11-24 00:21 output: …[2m16 tests[22m[2m)[22m[32m 10[2mms[22m[39m [32m✓[39m src/lib/backend/local/local.test.ts [2m([22m[2m27 tests[22m[2m)[22m[32m 75[2mms[22m[39m [2m Test Files [22m [1m[32m5 passed[39m[22m[90m (5)[39m [2m Tests [22m [1m[32m68 passed[39m[22m[90m (68)[39m [2m Start at [22m 19:21:37 [2m Duration [22m 285ms[2m (transform 37%, import 32%, tests 26%, worker 4%)[22m
- 2026-11-24 00:21 evidence: the judge's test run on the evidence branch: https://github.com/BreathBand/breathband-console/blob/evidence/T-0008/test-run.txt?raw=true

## Judge

- 2026-11-24 00:21 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 00:22 review round 1: request-changes; 1 blocking, 3 suggestion(s) (claude-opus-5-5) · 23478 tokens · $0.20
- 2026-11-24 00:22 blocking acceptance (A2) src/lib/backend/http/index.ts:1 — Stub has no header comment; the route map, auth status and no-network note live in exported data and a README · repro: Open src/lib/backend/http/index.ts as added in the diff: line 1 is `import type { AuthService, Backend, DataService } from "../types";` and none of the 93 lines is a comment. The route map, open-decision auth status and no-network flag exist only as the runtime exports HTTP_ROUTES, HTTP_AUTH and HTT… · fix: Add a header comment at the top of index.ts that lists each method → METHOD /v1/... (or points line-by-line to HTTP_ROUTES with the verbs/paths inline), says auth is an open decision (firebase-id-toke…
- 2026-11-24 00:22 acceptance A1: met — createHttpBackend throws an Error naming NEXT_PUBLIC_BACKEND=http and pointing to src/lib/backend/http/index.ts; covered by the test
- 2026-11-24 00:22 acceptance A2: unmet — No header comment in index.ts; the content is in exported data and README.md instead
- 2026-11-24 00:22 acceptance A3: met — kind includes 'http'; backendKind and createBackend('http') are covered in the new http.test.ts, including the firebase and fallback-to-local cases
- 2026-11-24 00:22 acceptance A4: unverified — .env.example was withheld from the judge as a sensitive path
- 2026-11-24 00:22 acceptance A5: unverified — No new deps and no local/** changes in the diff; the lint/typecheck/test/build results were not provided
