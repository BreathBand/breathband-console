import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import { assertSafeKey, type StorageService } from "./index";

const zip = promisify(gzip);
const unzip = promisify(gunzip);

/** gzip JSON files under `root` (STORAGE_DIR), one per key, written atomically. */
export function createFsStorage(root: string): StorageService {
  const base = resolve(root);

  const pathOf = (key: string) => {
    assertSafeKey(key);
    const path = join(base, ...key.split("/"));
    // Belt and braces: the key check already rules this out.
    const inside = relative(base, path);
    if (inside.startsWith("..") || inside.includes(`..${sep}`)) throw new Error(`Unsafe storage key: ${key}`);
    return path;
  };

  return {
    async putJson(key, value) {
      const path = pathOf(key);
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${randomUUID()}.tmp`;
      await writeFile(temporary, await zip(JSON.stringify(value)));
      await rename(temporary, path);
    },

    async getJson<T>(key: string) {
      let bytes: Buffer;
      try {
        bytes = await readFile(pathOf(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
      return JSON.parse((await unzip(bytes)).toString("utf8")) as T;
    },

    async delete(key) {
      await rm(pathOf(key), { force: true });
    },
  };
}
