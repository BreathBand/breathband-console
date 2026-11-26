import type { Backend } from "../types";
import { createHttpAuth } from "./auth";
import { createApiClient, type Fetch } from "./client";
import { createHttpData } from "./data";

// The adapter for the API in server/ (planning/v1/04-infrastructure.md).
// AuthService talks to Better Auth (I-07); DataService to /api/v1: profile,
// preferences, sessions and waveforms (I-08), coaching (I-09), and squads,
// alert rules, a coach's invites, group sessions and the waitlist (I-10).

export * from "./routes";
export { toBackendError } from "./client";

export interface HttpBackendOptions {
  /** The API's origin. Default NEXT_PUBLIC_API_BASE_URL; empty means the page's own origin. */
  baseUrl?: string;
  /** The web app's origin, where the reset link lands. Default: the page's own origin. */
  appUrl?: string;
  /** Default: the global fetch, called with `credentials: "include"` so the session cookie goes along. */
  fetch?: Fetch;
  now?: () => Date;
}

export function createHttpBackend(options: HttpBackendOptions = {}): Backend {
  // Inlined at build time, so it has to be read by its full name.
  const baseUrl = options.baseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  const auth = createHttpAuth(createApiClient(baseUrl, fetchImpl), {
    appUrl: () => options.appUrl ?? window.location.origin,
    now: options.now ?? (() => new Date()),
  });
  // A 401 from a data route means the session is gone: the person counts as signed out.
  const api = createApiClient(baseUrl, fetchImpl, { area: "data", onUnauthorized: () => auth.expire() });
  return { kind: "http", auth, data: createHttpData(api) };
}
