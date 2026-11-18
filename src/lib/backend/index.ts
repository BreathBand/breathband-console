import { createFirebaseBackend } from "./firebase";
import { createLocalBackend } from "./local";
import type { Backend } from "./types";

export * from "./types";

// Chosen at build time. Static export inlines NEXT_PUBLIC_* values, so each
// build targets exactly one backend.
export type BackendKind = Backend["kind"];

export function backendKind(): BackendKind {
  return process.env.NEXT_PUBLIC_BACKEND === "firebase" ? "firebase" : "local";
}

export function createBackend(kind: BackendKind = backendKind()): Backend {
  return kind === "firebase" ? createFirebaseBackend() : createLocalBackend();
}
