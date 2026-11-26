import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createGcsStorage, StorageNotConfiguredError } from "./gcs";
import { waveformKey, type StorageService } from "./index";

// Typed as the interface, so `npm run typecheck` fails if the stub drifts from StorageService.
const storage: StorageService = createGcsStorage({ bucket: "breathband-test-blobs", prefix: "blobs" });
const key = waveformKey("athlete-1", "session-1");

describe("gcs StorageService (stub)", () => {
  it("rejects every call with 'not configured'", async () => {
    await expect(storage.putJson(key, { a: 1 })).rejects.toThrow(StorageNotConfiguredError);
    await expect(storage.putJson(key, { a: 1 })).rejects.toThrow(/not configured/i);
    await expect(storage.getJson(key)).rejects.toThrow(/not configured.*breathband-test-blobs/i);
    await expect(storage.delete(key)).rejects.toThrow(/not configured/i);
  });

  it("returns promises rather than throwing synchronously, like the fs driver", () => {
    const pending = storage.delete(key);
    expect(pending).toBeInstanceOf(Promise);
    return expect(pending).rejects.toThrow(StorageNotConfiguredError);
  });

  it("still refuses unsafe keys first", async () => {
    await expect(storage.putJson("../outside.json.gz", {})).rejects.toThrow(/unsafe storage key/i);
    await expect(storage.getJson("/etc/passwd")).rejects.toThrow(/unsafe storage key/i);
  });

  it("uses no Google Cloud SDK (house rule)", () => {
    const source = readFileSync(new URL("./gcs.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from\s+["']@google-cloud\//);
    expect(source).not.toMatch(/require\(\s*["']@google-cloud\//);
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(names.filter((name) => name.startsWith("@google-cloud/") || name.startsWith("firebase"))).toEqual([]);
  });
});
