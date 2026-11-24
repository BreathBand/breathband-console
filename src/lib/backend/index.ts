import { createFirebaseBackend } from "./firebase";
import { createHttpBackend } from "./http";
import { createLocalBackend } from "./local";
import type { Backend } from "./types";

export * from "./types";

// Chosen at build time. Static export inlines NEXT_PUBLIC_* values, so each
// build targets exactly one backend.
export type BackendKind = Backend["kind"];

export function backendKind(): BackendKind {
  const value = process.env.NEXT_PUBLIC_BACKEND;
  return value === "http" || value === "firebase" ? value : "local";
}

export function createBackend(kind: BackendKind = backendKind()): Backend {
  switch (kind) {
    case "http":
      return createHttpBackend();
    case "firebase":
      return createFirebaseBackend();
    default:
      return createLocalBackend();
  }
}
