import { spawn } from "node:child_process";

export const SMOKE = {
  image: "breathband-console:smoke",
  containerPrefix: "breathband-smoke",
  port: 8080,
  backend: "local",
  readyTimeoutMs: 30_000,
  readyIntervalMs: 500,
  requestTimeoutMs: 5_000,
};

export const ROUTES = [
  { path: "/", html: ['<h1 id="hero-h"', "breathing."], scripts: [] },
  { path: "/cloud/login/", html: ["<title>BreathCloud"], scripts: ["Sign in to BreathCloud"] },
];

export function baseUrl(port = SMOKE.port) {
  return `http://localhost:${port}`;
}

export function containerName(pid = process.pid, now = Date.now()) {
  return `${SMOKE.containerPrefix}-${pid}-${now}`;
}

export function buildArgs(root, image = SMOKE.image) {
  return ["build", "--build-arg", `NEXT_PUBLIC_BACKEND=${SMOKE.backend}`, "-t", image, root];
}

export function runArgs(name, image = SMOKE.image, port = SMOKE.port) {
  return ["run", "-d", "--name", name, "-p", `${port}:8080`, image];
}

export function checkResponse({ status, contentType, body }, route) {
  if (status !== 200) return `${route.path}: expected status 200, got ${status}`;
  if (!/^text\/html\b/i.test(contentType ?? "")) {
    return `${route.path}: expected an HTML content-type, got "${contentType ?? "none"}"`;
  }
  const missing = route.html.filter((text) => !body.includes(text));
  if (missing.length > 0) {
    return `${route.path}: HTML is missing ${missing.map((text) => JSON.stringify(text)).join(", ")}`;
  }
  return null;
}

export function scriptPaths(html) {
  const found = html.match(/\/_next\/static\/[^"'\\\s]+\.js/g) ?? [];
  return [...new Set(found)];
}

export function checkScripts(sources, route) {
  const missing = route.scripts.filter((text) => !sources.some((source) => source.includes(text)));
  if (missing.length > 0) {
    return `${route.path}: none of the page's ${sources.length} scripts contain ${missing
      .map((text) => JSON.stringify(text))
      .join(", ")}`;
  }
  return null;
}

export function describeError(error) {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error ? `${error.message}: ${error.cause.message}` : error.message;
}

export async function waitUntilReady(
  url,
  {
    timeoutMs = SMOKE.readyTimeoutMs,
    intervalMs = SMOKE.readyIntervalMs,
    fetchImpl = fetch,
    now = Date.now,
  } = {},
) {
  const deadline = now() + timeoutMs;
  let lastError = "no attempt made";
  while (now() <= deadline) {
    try {
      return await fetchImpl(url, { signal: AbortSignal.timeout(SMOKE.requestTimeoutMs) });
    } catch (error) {
      lastError = describeError(error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`${url} was not ready after ${timeoutMs} ms (last error: ${lastError})`);
}

export function run(cmd, args, { capture = true, cwd } = {}) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(cmd, args, { cwd, shell: false, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" });
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if ("code" in error && error.code === "ENOENT") {
        reject(new Error(`${cmd} CLI not found on PATH`));
      } else {
        reject(new Error(`could not start ${cmd}: ${error.message}`));
      }
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
