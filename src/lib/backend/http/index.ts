import { BackendError, type Backend, type DataService } from "../types";
import { createHttpAuth } from "./auth";
import { createApiClient, type Fetch } from "./client";
import { createHttpData } from "./data";
import { HTTP_ROUTES } from "./routes";

// The adapter for the API in server/ (planning/v1/04-infrastructure.md).
// AuthService talks to Better Auth (I-07); DataService to /api/v1: profile,
// preferences, sessions and waveforms (I-08), the rest with I-09 and I-10.

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
  return { kind: "http", auth, data: { ...unavailableData(), ...createHttpData(api) } };
}

/** The API card that serves a method, where it isn't the usual I-09..I-10 range. */
const SERVED_BY: Partial<Record<keyof DataService, string>> = {
  // TODO(I-10): mood check-ins (J6), on the server's `mood_checkins` table.
  saveMoodCheckins: "API card I-10",
  listMoodCheckins: "API card I-10",
};

/**
 * The DataService methods the API doesn't serve yet fail with BackendError("unavailable"):
 * coaching arrives with I-09; squads, alerts, coach invites, groups, the waitlist and mood
 * check-ins with I-10.
 */
function unavailableData(): DataService {
  const notYet = (method: string) =>
    new BackendError(
      "unavailable",
      `${method}: the API doesn't serve this yet (${SERVED_BY[method as keyof DataService] ?? "I-09..I-10"}). Use NEXT_PUBLIC_BACKEND=local for now.`,
    );
  const methods = Object.keys(HTTP_ROUTES.data).map((method) => [
    method,
    // watchGroupLive hands back an unsubscribe function, not a promise.
    method === "watchGroupLive"
      ? () => {
          throw notYet(method);
        }
      : () => Promise.reject(notYet(method)),
  ]);
  return Object.fromEntries(methods) as DataService;
}
