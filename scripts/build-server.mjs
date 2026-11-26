// Compiles the API for the production image: `npm run build:server`.
//
// esbuild (already installed with tsx and drizzle-kit) bundles server/main.ts
// and the migration runner, with the `@/` alias and every pure-JS dependency,
// into build/server/. Native packages can't be bundled, so they and the
// packages they need are copied next to the bundle in build/server/node_modules.
// The result runs with plain `node`, without tsx and without the 300 MB of
// Next.js that `npm ci --omit=dev` would install:
//
//   node build/server/main.mjs          the API (serves out/ in production)
//   node build/server/migrate.mjs       applies server/db/migrations
//
// Both resolve out/ and server/db/migrations from the working directory, as
// `npm run api:start` and `npm run db:migrate` do.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const OUT_DIR = "build/server";

export const ENTRY_POINTS = { main: "server/main.ts", migrate: "server/db/migrate.ts" };

/** Native addons (libsql's prebuilt binary) stay outside the bundle. */
export const NATIVE_PACKAGES = ["libsql"];

/** ws's optional speed-ups; ws falls back to JavaScript when they're missing. */
export const OPTIONAL_PACKAGES = ["bufferutil", "utf-8-validate"];

// Bundled CommonJS code calls require() for Node built-ins; ESM output has none.
export const BANNER = 'import { createRequire as __bbCreateRequire } from "node:module";\nconst require = __bbCreateRequire(import.meta.url);';

export function esbuildOptions(root) {
  return {
    absWorkingDir: root,
    entryPoints: ENTRY_POINTS,
    outdir: OUT_DIR,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    banner: { js: BANNER },
    external: [...NATIVE_PACKAGES, ...OPTIONAL_PACKAGES],
    sourcemap: "linked",
    logLevel: "warning",
  };
}

function readPackage(dir) {
  return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
}

/** Node's lookup: `<dir>/node_modules/<name>`, walking up from `fromDir` to `root`. */
export function findPackageDir(name, fromDir, root, exists = existsSync) {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, "node_modules", name);
    if (exists(join(candidate, "package.json"))) return candidate;
    if (dir === root) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * The installed packages `names` need at runtime: each one, its dependencies,
 * and whichever of its optionalDependencies are installed (libsql's binary for
 * this platform). Returns name → directory. Throws when a required package is
 * missing or two different copies share a name (a flat copy can't hold both).
 */
export function packageClosure(root, names, { read = readPackage, exists = existsSync } = {}) {
  const found = new Map();
  const queue = names.map((name) => ({ name, from: root, optional: false }));
  while (queue.length > 0) {
    const { name, from, optional } = queue.shift();
    const dir = findPackageDir(name, from, root, exists);
    if (!dir) {
      if (optional) continue;
      throw new Error(`${name} is not installed (needed by the server bundle); run npm ci`);
    }
    const seen = found.get(name);
    if (seen !== undefined) {
      if (seen !== dir) throw new Error(`two copies of ${name} are needed (${seen} and ${dir}); can't copy both flat`);
      continue;
    }
    found.set(name, dir);
    const pkg = read(dir);
    for (const dep of Object.keys(pkg.dependencies ?? {})) queue.push({ name: dep, from: dir, optional: false });
    for (const dep of Object.keys(pkg.optionalDependencies ?? {})) queue.push({ name: dep, from: dir, optional: true });
  }
  return found;
}

export async function buildServer(root) {
  const { build } = await import("esbuild");
  const out = join(root, OUT_DIR);
  rmSync(out, { recursive: true, force: true });
  await build(esbuildOptions(root));
  const packages = packageClosure(root, NATIVE_PACKAGES);
  for (const [name, dir] of packages) {
    const target = join(out, "node_modules", name);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(dir, target, { recursive: true, dereference: true });
  }
  return { out, packages: [...packages.keys()] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  try {
    const { packages } = await buildServer(root);
    console.log(`Built ${OUT_DIR}/main.mjs and ${OUT_DIR}/migrate.mjs; copied ${packages.join(", ")}`);
  } catch (error) {
    console.error(`✗ build:server failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
