import { fileURLToPath } from "node:url";
import {
  ROUTES,
  SMOKE,
  baseUrl,
  buildArgs,
  checkResponse,
  checkScripts,
  containerName,
  describeError,
  run,
  runArgs,
  scriptPaths,
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
  return { status: response.status, contentType: response.headers.get("content-type"), body: await response.text() };
}

async function checkRoute(route) {
  const base = baseUrl();
  let page;
  try {
    page = await fetchText(new URL(route.path, base));
  } catch (error) {
    return `${route.path}: request failed: ${describeError(error)}`;
  }
  const problem = checkResponse(page, route);
  if (problem || route.scripts.length === 0) return problem;
  const sources = [];
  for (const path of scriptPaths(page.body)) {
    try {
      const script = await fetchText(new URL(path, base));
      if (script.status !== 200) return `${route.path}: script ${path} returned ${script.status}`;
      sources.push(script.body);
    } catch (error) {
      return `${route.path}: script ${path} request failed: ${describeError(error)}`;
    }
  }
  return checkScripts(sources, route);
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
  const started = await run("docker", runArgs(name));
  if (started.code !== 0) {
    const stderr = started.stderr.trim();
    const portInUse = /port is already allocated|ports are not available|address already in use/i.test(stderr);
    throw new Error(
      portInUse
        ? `port ${SMOKE.port} is already in use; stop whatever is listening on it and retry: ${stderr}`
        : `docker run failed with exit code ${started.code}: ${stderr}`,
    );
  }
  console.log(`Started container ${name} on ${baseUrl()}`);

  await waitUntilReady(`${baseUrl()}/`);

  const failures = [];
  for (const route of ROUTES) {
    const failure = await checkRoute(route);
    if (failure) {
      failures.push(failure);
      console.error(`✗ ${failure}`);
    } else {
      console.log(`✓ ${route.path}`);
    }
  }
  if (failures.length > 0) throw new Error(`${failures.length} of ${ROUTES.length} route checks failed`);
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
