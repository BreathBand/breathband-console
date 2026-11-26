import { BackendError, type BackendErrorCode } from "../types";

// One request to the API, with the browser's cookies, and every failure turned
// into a BackendError. Better Auth (/api/auth/*) answers errors as
// `{ code, message }` with its own codes; the API's other routes answer
// `{ error: { code, message } }` with the adapter's codes. Both are handled.

export type Fetch = typeof fetch;

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
}

export function createApiClient(baseUrl: string, fetchImpl: Fetch): ApiClient {
  const origin = baseUrl.replace(/\/+$/, "");

  async function send<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${origin}${path}`, {
        method,
        credentials: "include",
        headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      });
    } catch (error) {
      throw new BackendError("unavailable", `Couldn't reach the API: ${(error as Error).message}`);
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw toBackendError(response.status, payload);
    return payload as T;
  }

  return {
    get: (path) => send("GET", path),
    post: (path, body) => send("POST", path, body),
  };
}

const BACKEND_CODES = new Set<BackendErrorCode>([
  "invalid-credentials",
  "email-in-use",
  "weak-password",
  "invalid-email",
  "not-signed-in",
  "permission-denied",
  "not-found",
  "invite-invalid",
  "invalid-input",
  "under-age",
  "unavailable",
]);

/** Better Auth's error codes (`@better-auth/core`, BASE_ERROR_CODES) that have a more precise meaning here. */
const BETTER_AUTH_CODES: Record<string, BackendErrorCode> = {
  INVALID_EMAIL_OR_PASSWORD: "invalid-credentials",
  INVALID_PASSWORD: "invalid-credentials",
  USER_ALREADY_EXISTS: "email-in-use",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "email-in-use",
  INVALID_EMAIL: "invalid-email",
  PASSWORD_TOO_SHORT: "weak-password",
  PASSWORD_TOO_LONG: "invalid-input",
  // Sign-in before the emailed link was followed; the API has just sent a fresh one.
  EMAIL_NOT_VERIFIED: "permission-denied",
  INVALID_TOKEN: "invalid-input",
  TOKEN_EXPIRED: "invalid-input",
  VALIDATION_ERROR: "invalid-input",
  MISSING_FIELD: "invalid-input",
  FIELD_NOT_ALLOWED: "invalid-input",
  BODY_MUST_BE_AN_OBJECT: "invalid-input",
  SESSION_EXPIRED: "not-signed-in",
};

const MESSAGES: Partial<Record<string, string>> = {
  EMAIL_NOT_VERIFIED: "Confirm your email address first: we've sent you a new link.",
};

const STATUS_CODES: Partial<Record<number, BackendErrorCode>> = {
  400: "invalid-input",
  401: "not-signed-in",
  403: "permission-denied",
  404: "not-found",
  409: "email-in-use",
  422: "invalid-input",
};

/** The BackendError for a failed response, from its code if it has a known one, else from its status. */
export function toBackendError(status: number, payload: unknown): BackendError {
  const { code, message } = errorFields(payload);
  if (code && BACKEND_CODES.has(code as BackendErrorCode)) return new BackendError(code as BackendErrorCode, message);
  if (code && BETTER_AUTH_CODES[code]) return new BackendError(BETTER_AUTH_CODES[code], MESSAGES[code] ?? message);
  if (status === 429) return new BackendError("unavailable", "Too many attempts. Wait a minute and try again.");
  return new BackendError(STATUS_CODES[status] ?? "unavailable", message ?? `The API answered ${status}`);
}

function errorFields(payload: unknown): { code?: string; message?: string } {
  if (!payload || typeof payload !== "object") return {};
  const outer = payload as { code?: unknown; message?: unknown; error?: unknown };
  const source = outer.error && typeof outer.error === "object" ? (outer.error as typeof outer) : outer;
  return {
    code: typeof source.code === "string" ? source.code : undefined,
    message: typeof source.message === "string" ? source.message : undefined,
  };
}
