import { describe, expect, it } from "vitest";
import { BackendError, RATE_LIMITED_MESSAGE } from "@/lib/backend";
import { toBackendError } from "@/lib/backend/http";
import { failureMessage, resendProblem, signInProblem } from "./messages";

const rateLimited = () => toBackendError(429, { message: "Too many requests. Please try again later." });

describe("signInProblem", () => {
  it("says to wait on a rate limit, not to check the connection (T-0136's bug)", () => {
    expect(signInProblem(rateLimited())).toEqual({ message: RATE_LIMITED_MESSAGE });
    expect(RATE_LIMITED_MESSAGE).toBe("Too many attempts. Wait a minute and try again.");
  });

  it("sends an unconfirmed address to the Check your email view", () => {
    expect(signInProblem(toBackendError(403, { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" }))).toBe(
      "unverified",
    );
  });

  it.each<[string, unknown, ReturnType<typeof signInProblem>]>([
    ["a wrong password", new BackendError("invalid-credentials"), { message: "Email or password is incorrect." }],
    ["a malformed email", new BackendError("invalid-email"), { field: "email", message: "That email address doesn't look right." }],
    [
      "a lost connection",
      new BackendError("unavailable", "Couldn't reach the API: fetch failed"),
      { message: "Couldn't sign in. Check your connection and try again." },
    ],
    ["a server error", toBackendError(502, null), { message: "Couldn't sign in. Check your connection and try again." }],
    ["anything else", new Error("boom"), { message: "Couldn't sign in. Check your connection and try again." }],
  ])("names %s", (_, error, expected) => {
    expect(signInProblem(error)).toEqual(expected);
  });
});

describe("failureMessage and resendProblem", () => {
  it("show a rate limit's own message, and the fallback for anything else", () => {
    expect(failureMessage(rateLimited(), "fallback")).toBe(RATE_LIMITED_MESSAGE);
    expect(failureMessage(new BackendError("unavailable", "Couldn't reach the API: x"), "fallback")).toBe("fallback");
    expect(resendProblem(rateLimited())).toBe(RATE_LIMITED_MESSAGE);
    expect(resendProblem(new TypeError("fetch failed"))).toMatch(/couldn't send the email/i);
  });
});
