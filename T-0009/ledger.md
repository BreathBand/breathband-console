# T-0009 · Build and serve the console in Docker locally, with npm run docker:smoke

<!-- Written by Rivetari runtime from ledger.jsonl. Don't edit: changes are detected. -->

## Timeline

- 2026-11-24 00:15 intake: card drafted with 4 acceptance criteria; awaiting confirmation (arynbht@gmail.com)
- 2026-11-24 00:16 intake: intake confirmed; card sha256 be1c64040d6d6211da98350994adfef4b231aa2309d83502e4031d76d36f684c (arynbht@gmail.com (--yes))
- 2026-11-24 00:16 route: assembly proposed; sha256 f9971722588e37f057a9163c8a1ac024d3566b3f45574b50b736273a6d99ffcc; skills none; proof infra-plan; awaiting approval (rivetari router (for arynbht@gmail.com))
- 2026-11-24 00:16 route: route approved; assembly sha256 f9971722588e37f057a9163c8a1ac024d3566b3f45574b50b736273a6d99ffcc (arynbht@gmail.com (--yes))
- 2026-11-24 00:21 isolate: worktree .worktrees/T-0009 · branch chore/t-0009 from origin/main (7fa76ea1e1d8) · port 5177 · db breathband_console_t0009 · env sha256 0d247b819dcacd953dadf8a35d9072d0972c805b98841b00c312c8bd66a3d5ed (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:21 build: build started · skills spine only · budget 16 steps / 60k ctx · ~13348 prompt tokens · 4 repo file(s) in context · 144631 tokens · $0.36 · 3 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:26 build: build paused: 1 thing(s) to ask about · commit 8d36cc59f5a0 · 2023295 tokens · $1.32 · 41 turns (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:36 prove: proof passed · infra-plan (rivetari runtime (for arynbht@gmail.com))
- 2026-11-24 00:38 judge: judge passed · round 1 · head 8d36cc59f5a0 · record sha256 2d8cd78b115ac26b6188d263f7400da1ca01a4afc6aa7ac0e57da6c4c38f933f (rivetari judge (for arynbht@gmail.com))
- 2026-11-24 00:38 ship: draft PR opened: #13 https://github.com/BreathBand/breathband-console/pull/13 · chore/t-0009 at 8d36cc59f5a0 → main (rivetari runtime (for arynbht@gmail.com))

## Plan

- 2026-11-24 00:21 1. Before writing anything, confirm the current setup: Dockerfile:1-24 builds `out/` with node:22-alpine and serves it from nginx:1.27-alpine. nginx.conf listens on 8080 and uses `try_files $uri $uri/ $uri.html =404` with `trailingSlash: true` (next.config.ts). The static HTML has `<h1 id="login-h">Sign in to BreathCloud</h1>` (src/app/cloud/login/page.tsx:90) and `<h1 id="hero-h"` with the text 'breathing.' on / (src/app/(site)/page.tsx:137).
- 2026-11-24 00:21 2. Build the image as it stands and serve it, by hand: `docker build --build-arg NEXT_PUBLIC_BACKEND=local -t breathband-console:smoke .`, then `docker run --rm -d -p 8080:8080`, then curl `/`, `/cloud/login/` and `/cloud/login`. Record whether the build fails (for example the Next SWC binary on alpine or typecheck during `next build`) or a route doesn't return 200 HTML. Then remove the container.
- 2026-11-24 00:21 3. Only if that run showed a real defect, make the smallest fix with no added comments (diff.no-new-comments). Likely candidates: `absolute_redirect off;` in nginx.conf so the 301 from /cloud/login to /cloud/login/ doesn't leak an internal host or port, or adding `.worktrees`, `.rivetari`, `coverage` and `*.log` to .dockerignore so the build context stays small. Keep `listen 8080` and `EXPOSE 8080`, and note each change and its reason for the PR body.
- 2026-11-24 00:21 4. Create scripts/docker-smoke-lib.mjs, a pure ES module that uses node built-ins only. It exports: the smoke config (image tag, container name prefix, host port 8080, readiness timeout and interval); the route checks `[{ path: '/', expect: ['<h1 id="hero-h"', 'breathing.'] }, { path: '/cloud/login/', expect: ['<h1 id="login-h"', 'Sign in to BreathCloud'] }]`; and `checkResponse({ status, contentType, body }, route)`, which returns null or a clear error string covering status not 200, content-type not text/html, or missing expected text.
- 2026-11-24 00:21 5. In the same module, export `waitUntilReady(url, { timeoutMs, intervalMs, fetchImpl })`. It polls with the global fetch and AbortSignal.timeout until a response arrives or the deadline passes, then throws an Error that names the URL and the last error it saw. Also export a `run(cmd, args)` helper around child_process.spawn (shell: false, inherit or capture stdio) that resolves to `{ code, stdout, stderr }` and turns ENOENT into 'docker CLI not found on PATH'.
- 2026-11-24 00:21 6. Create scripts/docker-smoke.mjs as the entry point, with main steps in this order. (1) Run `docker info --format {{.ServerVersion}}`; if it exits non-zero, fail with 'Docker daemon isn't running (start Docker Desktop) …' plus its stderr. (2) Run `docker build --build-arg NEXT_PUBLIC_BACKEND=local -t breathband-console:smoke .` with cwd set to the repo root (resolved from import.meta.url) and stdio inherited. (3) Run `docker run -d --name breathband-smoke-<pid>-<time> -p 8080:8080 breathband-console:smoke` and keep the container name.
- 2026-11-24 00:21 7. Continue main: wait until http://localhost:8080/ is ready, then fetch each route and apply checkResponse. Collect every failure and print a ✓ or ✗ line for each route. On failure also print `docker logs` for the container. Set process.exitCode to 0 only if every check passed, and always print an error message before a non-zero exit (build failure, port 8080 already in use from docker run's stderr, readiness timeout, check failures).
- 2026-11-24 00:21 8. Guarantee cleanup: wrap everything after `docker run` in try/finally that runs `docker rm -f <name>` once the container name is known, even when docker run fails partway. Also register SIGINT/SIGTERM handlers that run the same idempotent cleanup and exit with code 130/143. If cleanup itself fails, report it with context rather than swallowing it.
- 2026-11-24 00:21 9. Edit package.json and add `"docker:smoke": "node scripts/docker-smoke.mjs"`. Leave every existing script unchanged and add no dependency or devDependency (A3).
- 2026-11-24 00:21 10. Add unit tests for the pure helpers in a new test file that `npm run test` actually picks up. vitest.config.mts only includes `src/**/*.test.ts` and must not be edited, so put a .test.ts file under src/, for example src/lib/dockerSmoke.test.ts importing '../../scripts/docker-smoke-lib.mjs'. If tsconfig or eslint reject that import, fall back to a node:test file at scripts/docker-smoke-lib.test.mjs plus a `test:scripts` npm script, and say so in the PR. Cover checkResponse (200 HTML with the text → null; 404, a non-HTML content-type and missing text → messages naming the path) and waitUntilReady (success after N failed fetches with a stub fetchImpl; timeout → Error naming the URL).
- 2026-11-24 00:21 11. Run the new tests only: `npm run test -- related --run scripts/docker-smoke-lib.mjs <test file>` (or `node --test` for the fallback), then `npm run lint` and `npm run typecheck`. Check that eslint (eslint-config-next covers .mjs) and tsc (allowJs: true) accept the new .mjs files with no suppressions, and fix any findings in the code.
- 2026-11-24 00:21 12. Prove A1 end to end: run `npm run docker:smoke` with Docker running, confirm it builds, reaches readiness, prints ✓ for / and /cloud/login/, and exits 0. Then run `docker ps -a --filter name=breathband-smoke` and confirm it shows no container.
- 2026-11-24 00:21 13. Prove the failure paths for A1/A2. (a) Temporarily point the route expectation at missing text through an env override, for example DOCKER_SMOKE_EXPECT_FAIL is not acceptable, so instead start a throwaway nginx on 8080 first and confirm the script fails clearly on 'port is already allocated' and leaves no smoke container. (b) Stop Docker Desktop and confirm a non-zero exit with the 'Docker daemon isn't running' message. (c) Press Ctrl-C during readiness and confirm the container is removed.
- 2026-11-24 00:21 14. Make sure the infra-plan proof can be produced: the diff touches only scripts/**, package.json, a new test file, and Dockerfile/nginx.conf/.dockerignore only if step 3 needed it. It has no comments, no Markdown, nothing under gcloud/CI/firebase, and Dockerfile build args and port 8080 are unchanged. Then commit on chore/t-0009 with the attribution trailer.

## Decisions

- 2026-11-24 00:15 risk high: derived from the touches: high: infrastructure as code (Dockerfile); medium: dependencies or a lockfile (package.json) (the declared medium can't lower it)
- 2026-11-24 00:16 routed to infra, testing: infra (touches **/Dockerfile (Dockerfile); "deploy" in the description; "docker" in the title; "dockerfile" in the description), testing ("test" in the description; "e2e" in the description; "playwright" in the description)
- 2026-11-24 00:16 infra: no vendored skill covers it; the agent works from the spine

## Stop-and-ask

- 2026-11-24 00:26 asked: protected_path: package.json — changes package.json scripts (the commands the checks run)
- 2026-11-24 00:34 answered: allowed — Person approves adding the docker:smoke script to package.json scripts; no dependency changes

## Proof

- 2026-11-24 00:36 infra-plan has no proof runner yet; the test run stands in, and a person attaches the infra-plan proof
- 2026-11-24 00:36 tests passed (npm run test, exit 0) · new tests: src/lib/dockerSmoke.test.ts: builds with the local backend and maps port 8080; src/lib/dockerSmoke.test.ts: names each container uniquely with the smoke prefix; src/lib/dockerSmoke.test.ts: checks the home page and the console sign-in page; src/lib/dockerSmoke.test.ts: passes a 200 HTML page with the expected text; src/lib/dockerSmoke.test.ts: names the path and status when the status isn't 200; src/lib/dockerSmoke.test.ts: rejects a page that isn't HTML; src/lib/dockerSmoke.test.ts: lists the expected text that is missing; src/lib/dockerSmoke.test.ts: finds each Next.js script once, including ones in the RSC payload; src/lib/dockerSmoke.test.ts: passes when any script carries the expected text; src/lib/dockerSmoke.test.ts: fails when no script carries the expected text; src/lib/dockerSmoke.test.ts: retries until the server answers; src/lib/dockerSmoke.test.ts: names the URL and the last error when it times out; src/lib/dockerSmoke.test.ts: includes the cause and handles non-errors; src/lib/dockerSmoke.test.ts: captures output and the exit code; src/lib/dockerSmoke.test.ts: explains a missing CLI
- 2026-11-24 00:36 output: …[2m15 tests[22m[2m)[22m[32m 93[2mms[22m[39m [32m✓[39m src/lib/backend/local/local.test.ts [2m([22m[2m27 tests[22m[2m)[22m[32m 75[2mms[22m[39m [2m Test Files [22m [1m[32m5 passed[39m[22m[90m (5)[39m [2m Tests [22m [1m[32m67 passed[39m[22m[90m (67)[39m [2m Start at [22m 19:36:37 [2m Duration [22m 359ms[2m (import 36%, transform 34%, tests 26%, worker 3%)[22m
- 2026-11-24 00:36 evidence: the test run on the evidence branch: https://github.com/BreathBand/breathband-console/blob/evidence/T-0009/test-run.txt?raw=true

## Judge

- 2026-11-24 00:37 tier 1 round 1: pass · 7/8 pass · 1 pre-existing
- 2026-11-24 00:37 protected: package.json — changes package.json scripts (the commands the checks run) (allowed at build)
- 2026-11-24 00:38 review round 1: approve; 0 blocking, 3 suggestion(s) (claude-opus-5-5) · 20775 tokens · $0.24
- 2026-11-24 00:38 acceptance A1: unverified — The script builds with NEXT_PUBLIC_BACKEND=local, runs with -p 8080:8080, polls until ready, checks / and /cloud/login/ for 200 text/html plus page markers, and exits 1 with a message on failure. No e…
- 2026-11-24 00:38 acceptance A2: met — cleanup() runs in finally and on SIGINT/SIGTERM. container is set before docker run, so a created-but-not-started container is removed too. docker info failure gives a clear daemon message, and a miss…
- 2026-11-24 00:38 acceptance A3: met — Plain .mjs using node:child_process and global fetch only, no dependency changes, with unit tests in src/lib/dockerSmoke.test.ts. The lint, typecheck and test results come from the deterministic check…
- 2026-11-24 00:38 acceptance A4: met — Dockerfile and nginx.conf are unchanged, and the port stays 8080. The only image-related change is a minimal .dockerignore addition (.worktrees, .rivetari, coverage). The PR description should explain…
- 2026-11-24 00:38 judge review posted: https://github.com/BreathBand/breathband-console/pull/13#pullrequestreview-6031829625
