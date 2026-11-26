// npm run docker:smoke: builds the production image (Dockerfile), runs it,
// applies the migrations inside it, checks /api/health, the home page and the
// console sign-in page (with their scripts), the security headers and the
// /_next/static/ caching, then removes the container. Plain Node and the docker
// CLI, no shell, so it runs the same from Git Bash on Windows and POSIX shells.

import { fileURLToPath } from "node:url";
import {
  HEALTH,
  ROUTES,
  SMOKE,
  baseUrl,
  buildArgs,
  checkResponse,
  checkScripts,
  checkSecurityHeaders,
  checkStaticCaching,
  containerName,
  describeError,
  execArgs,
  run,
  runArgs,
  scriptPaths,
  smokeSecretEnv,
  waitUntilReady,
} from "./docker-smoke-lib.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

let container = null;
let cleaning = null;

function cleanup() {
  cleaning ??= removeContainer();
  return cleaning;
}

async function removeContainer() {
  if (!container) return;
  const name = container;
  const result = await run("docker", ["rm", "-f", name]);
  if (result.code !== 0 && !/no such container/i.test(result.stderr)) {
    throw new Error(`could not remove container ${name} (run "docker rm -f ${name}"): ${result.stderr.trim()}`);
  }
  container = null;
  console.log(`Removed container ${name}`);
}

for (const [signal, code] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  process.once(signal, () => {
    console.error(`\n✗ docker:smoke interrupted (${signal}), cleaning up`);
    cleanup()
      .catch((error) => console.error(`✗ ${describeError(error)}`))
      .finally(() => process.exit(code));
  });
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(SMOKE.requestTimeoutMs) });
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    headers: response.headers,
    body: await response.text(),
  };
}

/** Every problem with one route: status, body, headers, and its scripts' status, headers and caching. */
async function checkRoute(route) {
  const base = baseUrl();
  let page;
  try {
    page = await fetchText(new URL(route.path, base));
  } catch (error) {
    return [`${route.path}: request failed: ${describeError(error)}`];
  }
  const problems = [checkResponse(page, route), checkSecurityHeaders(page.headers, route.path)];
  if (!route.html) return problems.filter(Boolean);

  const sources = [];
  const paths = scriptPaths(page.body);
  if (paths.length === 0) problems.push(`${route.path}: no /_next/static/ scripts found in the page`);
  for (const path of paths) {
    try {
      const script = await fetchText(new URL(path, base));
      if (script.status !== 200) {
        problems.push(`${route.path}: script ${path} returned ${script.status}`);
        continue;
      }
      problems.push(checkSecurityHeaders(script.headers, path), checkStaticCaching(script.headers, path));
      sources.push(script.body);
    } catch (error) {
      problems.push(`${route.path}: script ${path} request failed: ${describeError(error)}`);
    }
  }
  if (route.scripts.length > 0) problems.push(checkScripts(sources, route));
  return problems.filter(Boolean);
}

async function printLogs(name) {
  const logs = await run("docker", ["logs", name]);
  console.error(`--- docker logs ${name} ---`);
  console.error((logs.stdout + logs.stderr).trim() || "(no output)");
  console.error("--- end of logs ---");
}

async function main() {
  const info = await run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  if (info.code !== 0) {
    throw new Error(
      `Docker daemon isn't running (start Docker Desktop or the docker service, then retry): ${info.stderr.trim()}`,
    );
  }
  console.log(`Docker ${info.stdout.trim()}; building ${SMOKE.image} with NEXT_PUBLIC_BACKEND=${SMOKE.backend}`);

  const build = await run("docker", buildArgs(root), { capture: false, cwd: root });
  if (build.code !== 0) throw new Error(`docker build failed with exit code ${build.code} (see the output above)`);

  const name = containerName();
  container = name;
  const started = await run("docker", runArgs(name), { env: smokeSecretEnv() });
  if (started.code !== 0) {
    const stderr = started.stderr.trim();
    const portInUse = /port is already allocated|ports are not available|address already in use/i.test(stderr);
    throw new Error(
      portInUse
        ? `port ${SMOKE.port} is already in use (is \`docker compose --profile full\` up?); stop it and retry: ${stderr}`
        : `docker run failed with exit code ${started.code}: ${stderr}`,
    );
  }
  console.log(`Started container ${name} on ${baseUrl()}`);

  await waitUntilReady(`${baseUrl()}${HEALTH.path}`);

  const migrated = await run("docker", execArgs(name));
  if (migrated.code !== 0) {
    throw new Error(`migrations failed with exit code ${migrated.code}: ${(migrated.stdout + migrated.stderr).trim()}`);
  }
  console.log(`✓ ${migrated.stdout.trim()}`);

  let failed = 0;
  for (const route of ROUTES) {
    const problems = await checkRoute(route);
    if (problems.length > 0) {
      failed += 1;
      for (const problem of problems) console.error(`✗ ${problem}`);
    } else {
      console.log(`✓ ${route.path}${route.html ? " (security headers; scripts cached immutable)" : " (security headers)"}`);
    }
  }
  if (failed > 0) throw new Error(`${failed} of ${ROUTES.length} route checks failed`);
}

try {
  await main();
  console.log("✓ docker:smoke passed");
} catch (error) {
  console.error(`✗ docker:smoke failed: ${describeError(error)}`);
  process.exitCode = 1;
  if (container) {
    await printLogs(container).catch((logError) =>
      console.error(`✗ could not read docker logs for ${container}: ${describeError(logError)}`),
    );
  }
} finally {
  try {
    await cleanup();
  } catch (error) {
    console.error(`✗ ${describeError(error)}`);
    process.exitCode = 1;
  }
}
