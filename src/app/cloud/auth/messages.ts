import { BackendError, isRateLimited } from "@/lib/backend";

// What the signed-out screens say when the backend refuses (T-0139). Kept apart
// from the pages so the choice of words can be tested without a browser.

export type FormProblem<F extends string = string> = { field?: F; message: string };

/**
 * The fallback for a failure the form can't name, unless it's a rate limit:
 * then the error's own message ("Too many attempts…"), which says what to do.
 */
export function failureMessage(error: unknown, fallback: string): string {
  return isRateLimited(error) ? error.message : fallback;
}

/**
 * Why sign-in failed, as the login form shows it; "unverified" when the address
 * isn't confirmed yet, which gets its own "Check your email" view.
 */
export function signInProblem(error: unknown): FormProblem<"email" | "password"> | "unverified" {
  const code = error instanceof BackendError ? error.code : null;
  if (code === "email-not-verified") return "unverified";
  if (code === "invalid-credentials") return { message: "Email or password is incorrect." };
  if (code === "invalid-email") return { field: "email", message: "That email address doesn't look right." };
  return { message: failureMessage(error, "Couldn't sign in. Check your connection and try again.") };
}

/** Why "Send the link again" failed. */
export function resendProblem(error: unknown): string {
  return failureMessage(error, "Couldn't send the email right now. Check your connection and try again.");
}
