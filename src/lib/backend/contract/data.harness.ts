import { expect } from "vitest";
import { currentConsents } from "@/lib/domain/consent";
import type { Role, ShareScope } from "@/lib/domain/types";
import { BackendError, type Backend, type BackendErrorCode, type SignUpInput } from "../types";

// What the DataService sections of the shared suite need from an adapter
// (profile.contract.ts, sessions.contract.ts). Each person is a separate
// browser on the same data: local shares one store, http one API.

export interface Person {
  uid: string;
  email: string;
  birthYear: number;
  /** This person's browser, signed in. */
  backend: Backend;
}

export interface DataContractHarness {
  /** A new account, signed in in its own browser. */
  person(role?: Role): Promise<Person>;
  /** A browser where nobody is signed in. */
  signedOut(): Backend;
  /**
   * Makes, changes (scope) or removes (null: revoked) a coach link directly.
   * The coaching routes that do this for real are I-09's.
   */
  link(coachId: string, athleteId: string, scope: ShareScope | null): Promise<void>;
  /**
   * Tries to change account fields outside DataService, as a client could: http
   * posts Better Auth's /api/auth/update-user. Local has no such route, so nothing
   * can change there and it reports "refused".
   */
  updateAccount(person: Person, fields: Record<string, unknown>): Promise<"refused" | "accepted">;
}

export const PASSWORD = "correct horse battery";
export const ADULT_BIRTH_YEAR = new Date().getUTCFullYear() - 30;

let lastEmail = 0;
export const uniqueEmail = () => `data${++lastEmail}-${Date.now()}@example.test`;

export const signUpInput = (role: Role = "athlete"): SignUpInput => ({
  email: uniqueEmail(),
  password: PASSWORD,
  displayName: role === "coach" ? "Cara Coach" : "Ana Athlete",
  role,
  consents: currentConsents(),
  birthYear: ADULT_BIRTH_YEAR,
});

export async function refusal(promise: Promise<unknown>, code: BackendErrorCode) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(BackendError);
  expect(error).toMatchObject({ code });
}
