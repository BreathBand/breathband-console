import type { PathLike } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BANNER,
  ENTRY_POINTS,
  NATIVE_PACKAGES,
  OUT_DIR,
  esbuildOptions,
  findPackageDir,
  packageClosure,
} from "../../scripts/build-server.mjs";

const root = join("/", "repo");
const nm = (...parts: string[]) => join(root, "node_modules", ...parts);

/** A fake node_modules: directory → package.json. */
function fakeInstall(packages: Record<string, { dependencies?: object; optionalDependencies?: object }>) {
  return {
    exists: (path: PathLike) => Object.keys(packages).some((dir) => join(dir, "package.json") === String(path)),
    read: (dir: string) => packages[dir],
  };
}

describe("build:server options", () => {
  it("bundles the API and the migration runner into build/server as ESM for Node 22", () => {
    const options = esbuildOptions(root);
    expect(options).toMatchObject({
      absWorkingDir: root,
      entryPoints: { main: "server/main.ts", migrate: "server/db/migrate.ts" },
      outdir: "build/server",
      outExtension: { ".js": ".mjs" },
      bundle: true,
      platform: "node",
      target: "node22",
      format: "esm",
    });
    expect(ENTRY_POINTS).toEqual(options.entryPoints);
    expect(OUT_DIR).toBe("build/server");
  });

  it("keeps only the native libSQL binding and ws's optional add-ons outside the bundle", () => {
    expect(NATIVE_PACKAGES).toEqual(["libsql"]);
    expect(esbuildOptions(root).external).toEqual(["libsql", "bufferutil", "utf-8-validate"]);
  });

  it("gives bundled CommonJS a require()", () => {
    expect(esbuildOptions(root).banner.js).toBe(BANNER);
    expect(BANNER).toContain("const require = __bbCreateRequire(import.meta.url);");
  });
});

describe("findPackageDir", () => {
  it("prefers a nested copy, then walks up to the root's node_modules", () => {
    const { exists } = fakeInstall({ [nm("a", "node_modules", "b")]: {}, [nm("b")]: {}, [nm("c")]: {} });
    expect(findPackageDir("b", nm("a"), root, exists)).toBe(nm("a", "node_modules", "b"));
    expect(findPackageDir("c", nm("a"), root, exists)).toBe(nm("c"));
  });

  it("stops at the root", () => {
    const { exists } = fakeInstall({ [join("/", "node_modules", "x")]: {} });
    expect(findPackageDir("x", root, root, exists)).toBeNull();
  });
});

describe("packageClosure", () => {
  it("collects dependencies and the installed optional binaries", () => {
    const install = fakeInstall({
      [nm("libsql")]: {
        dependencies: { "@neon-rs/load": "^0.0.4", "detect-libc": "2.0.2" },
        optionalDependencies: { "@libsql/linux-x64-musl": "0.5.29", "@libsql/darwin-arm64": "0.5.29" },
      },
      [nm("@neon-rs", "load")]: {},
      [nm("detect-libc")]: {},
      [nm("@libsql", "linux-x64-musl")]: {},
    });
    const closure = packageClosure(root, ["libsql"], install);
    expect([...closure.keys()]).toEqual(["libsql", "@neon-rs/load", "detect-libc", "@libsql/linux-x64-musl"]);
    expect(closure.get("@libsql/linux-x64-musl")).toBe(nm("@libsql", "linux-x64-musl"));
  });

  it("refuses a missing required package", () => {
    const install = fakeInstall({ [nm("libsql")]: { dependencies: { "detect-libc": "2.0.2" } } });
    expect(() => packageClosure(root, ["libsql"], install)).toThrow("detect-libc is not installed");
  });

  it("refuses two copies of one package, which a flat copy can't hold", () => {
    const install = fakeInstall({
      [nm("a")]: { dependencies: { b: "1" } },
      [nm("b")]: {},
      [nm("c")]: { dependencies: { b: "2" } },
      [nm("c", "node_modules", "b")]: {},
    });
    expect(() => packageClosure(root, ["a", "c"], install)).toThrow("two copies of b");
  });
});
