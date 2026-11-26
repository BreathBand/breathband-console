// Blobs that don't belong in the database: today the waveforms, as gzip JSON
// (planning/v1/04-infrastructure.md, decision 7). The fs driver writes under
// STORAGE_DIR; a Cloud Storage driver comes later (I-16) behind the same interface.

export interface StorageService {
  /** Stores a JSON value at `key`, replacing whatever was there. */
  putJson(key: string, value: unknown): Promise<void>;
  /** The JSON value at `key`, or null when there is none. */
  getJson<T>(key: string): Promise<T | null>;
  /** Removes `key`; a missing key is not an error. */
  delete(key: string): Promise<void>;
}

export { createFsStorage } from "./fs";

/** Where a session's signal lives: `SessionSummary.waveformPath`. */
export function waveformKey(athleteId: string, sessionId: string): string {
  return `waveforms/${athleteId}/${sessionId}.json.gz`;
}

const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

/**
 * A key is slash-separated segments of letters, digits, `.`, `_` and `-`, none
 * starting with a dot: no `..`, no absolute paths, no backslashes or drive letters.
 */
export function assertSafeKey(key: string): void {
  const segments = key.split("/");
  if (key.length > 512 || !segments.every((segment) => SEGMENT.test(segment))) {
    throw new Error(`Unsafe storage key: ${JSON.stringify(key)}`);
  }
}
