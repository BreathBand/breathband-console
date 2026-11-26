// Cloud Storage driver: a STUB (planning/v1/04-infrastructure.md, I-16).
//
// It has the StorageService shape so the deploy can be planned around it, but
// every call fails with "not configured". It imports no Google Cloud package:
// the house rules forbid cloud SDKs (`@google-cloud/*`) until the owner
// approves one. Nothing selects it yet: server/main.ts always builds the fs
// driver. What implementing it takes, and the alternatives, are in
// docs/deploy.md ("Storage").

import { assertSafeKey, type StorageService } from "./index";

export type GcsStorageOptions = {
  /** The bucket's name, e.g. `breathband-prod-blobs`. Uniform access, no public objects. */
  bucket: string;
  /** Optional folder inside the bucket every key is stored under, e.g. `blobs`. */
  prefix?: string;
};

export class StorageNotConfiguredError extends Error {
  constructor(bucket: string) {
    super(
      `Cloud Storage is not configured: the gcs driver for bucket "${bucket}" is a stub. ` +
        "Use the fs driver (STORAGE_DIR), or implement server/storage/gcs.ts (see docs/deploy.md).",
    );
    this.name = "StorageNotConfiguredError";
  }
}

/** Every method checks the key like the fs driver, then rejects with StorageNotConfiguredError. */
export function createGcsStorage(options: GcsStorageOptions): StorageService {
  const notConfigured = (key: string): never => {
    assertSafeKey(key);
    throw new StorageNotConfiguredError(options.bucket);
  };

  return {
    async putJson(key) {
      notConfigured(key);
    },

    async getJson<T>(key: string): Promise<T | null> {
      return notConfigured(key);
    },

    async delete(key) {
      notConfigured(key);
    },
  };
}
