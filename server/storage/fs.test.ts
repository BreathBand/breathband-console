import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertSafeKey, createFsStorage, waveformKey, type StorageService } from "./index";

let dir: string;
let storage: StorageService;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "breathband-storage-"));
  storage = createFsStorage(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const waveform = { sampleIntervalMs: 50, user: [0, 1, 2, 1, 0], pacer: null, markers: [2], calibration: { min: 0, max: 4 } };

describe("fs StorageService", () => {
  it("stores gzip JSON at the waveformPath key and reads it back", async () => {
    const key = waveformKey("athlete-1", "session-1");
    expect(key).toBe("waveforms/athlete-1/session-1.json.gz");
    await storage.putJson(key, waveform);

    const file = join(dir, "waveforms", "athlete-1", "session-1.json.gz");
    expect(JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"))).toEqual(waveform);
    expect(await storage.getJson(key)).toEqual(waveform);
    expect(readdirSync(join(dir, "waveforms", "athlete-1"))).toEqual(["session-1.json.gz"]);
  });

  it("replaces a value, answers null for a missing key, and deletes", async () => {
    const key = waveformKey("athlete-1", "session-2");
    await storage.putJson(key, { a: 1 });
    await storage.putJson(key, { a: 2 });
    expect(await storage.getJson(key)).toEqual({ a: 2 });

    await storage.delete(key);
    expect(await storage.getJson(key)).toBeNull();
    expect(existsSync(join(dir, "waveforms", "athlete-1", "session-2.json.gz"))).toBe(false);
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });

  it.each([
    "../outside.json.gz",
    "waveforms/../../outside.json.gz",
    "waveforms/a/..",
    "/etc/passwd",
    "C:/Windows/win.ini",
    "waveforms\\a\\b.json.gz",
    "waveforms//b.json.gz",
    ".hidden",
    "",
  ])("refuses the unsafe key %j", async (key) => {
    expect(() => assertSafeKey(key)).toThrow(/unsafe storage key/i);
    await expect(storage.putJson(key, {})).rejects.toThrow(/unsafe storage key/i);
    await expect(storage.getJson(key)).rejects.toThrow(/unsafe storage key/i);
    await expect(storage.delete(key)).rejects.toThrow(/unsafe storage key/i);
  });
});
