import { beforeEach, describe, expect, it } from "vitest";
import { CONSENT_KINDS, currentConsents } from "@/lib/domain/consent";
import { BackendError, type AuthService, type AuthUser, type Backend, type BackendErrorCode, type SignUpInput } from "../types";

// The AuthService half of the shared adapter suite (planning/v1/04-infrastructure.md,
// "Tests": contract parity is the acceptance test). Every adapter runs it:
//
//   describeAuthContract("local", traits, setup)   contract/auth.local.test.ts
//   describeAuthContract("http", traits, setup)    http/auth.http.test.ts (the API in-process)
//
// Where adapters differ on purpose, the difference is a named trait, not a skipped test.

export interface AuthContractTraits {
  /** A new account must follow an emailed link before it can sign in (http: Better Auth). */
  confirmsEmail: boolean;
  /** Sign-up says so when the address already has an account (http hides it: no account enumeration). */
  revealsEmailInUse: boolean;
}

export interface AuthContractHarness {
  /** The adapter as one browser sees it. */
  backend: Backend;
  /** The same browser after a reload: a new adapter on the same stored session. */
  reload(): Backend;
  /** Follows the link in the latest confirmation email to this address, as a mail app would. */
  confirmEmail(email: string): Promise<void>;
}

const PASSWORD = "correct horse battery";
const ADULT_BIRTH_YEAR = new Date().getUTCFullYear() - 30;

let lastEmail = 0;
const uniqueEmail = () => `contract${++lastEmail}-${Date.now()}@example.test`;

const signUpInput = (changes: Partial<SignUpInput> = {}): SignUpInput => ({
  email: uniqueEmail(),
  password: PASSWORD,
  displayName: "Ana Contract",
  role: "athlete",
  consents: currentConsents(),
  birthYear: ADULT_BIRTH_YEAR,
  ...changes,
});

/** The first state onAuthStateChanged reports, and every one after it. */
function watch(auth: AuthService) {
  const seen: (AuthUser | null)[] = [];
  let first: (user: AuthUser | null) => void;
  const firstState = new Promise<AuthUser | null>((resolve) => (first = resolve));
  const unsubscribe = auth.onAuthStateChanged((user) => {
    if (seen.length === 0) first(user);
    seen.push(user);
  });
  return { seen, firstState, unsubscribe };
}

async function refusal(promise: Promise<unknown>, code: BackendErrorCode) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(BackendError);
  expect(error).toMatchObject({ code });
}

export function describeAuthContract(
  adapter: string,
  traits: AuthContractTraits,
  setup: () => AuthContractHarness | Promise<AuthContractHarness>,
) {
  describe(`AuthService contract: ${adapter}`, () => {
    let h: AuthContractHarness;
    let auth: AuthService;

    beforeEach(async () => {
      h = await setup();
      auth = h.backend.auth;
    });

    /** An account that can sign in, with nobody signed in afterwards. */
    async function existingAccount(changes: Partial<SignUpInput> = {}) {
      const input = signUpInput(changes);
      await auth.signUp(input);
      await h.confirmEmail(input.email);
      if (auth.currentUser()) await auth.signOut();
      return input;
    }

    async function signedIn() {
      const input = await existingAccount();
      return { input, user: await auth.signIn(input.email, input.password) };
    }

    describe("state", () => {
      it("starts signed out, and onAuthStateChanged says so first", async () => {
        const { firstState, unsubscribe } = watch(auth);
        expect(await firstState).toBeNull();
        expect(auth.currentUser()).toBeNull();
        unsubscribe();
      });

      it("keeps the session across a reload", async () => {
        const { user } = await signedIn();
        const { firstState, unsubscribe } = watch(h.reload().auth);
        expect(await firstState).toEqual(user);
        unsubscribe();
      });

      it("stops calling back after unsubscribe", async () => {
        const { input } = await signedIn();
        await auth.signOut();
        const { seen, firstState, unsubscribe } = watch(auth);
        await firstState;
        unsubscribe();
        await auth.signIn(input.email, input.password);
        expect(seen).toEqual([null]);
      });
    });

    describe("signUp", () => {
      it("returns the new account, with the email trimmed and lower-cased", async () => {
        const email = uniqueEmail();
        const user = await auth.signUp(signUpInput({ email: `  ${email.toUpperCase()} ` }));
        expect(user.email).toBe(email);
        expect(user.uid).toEqual(expect.any(String));
        expect(user.uid).not.toBe("");
      });

      if (traits.confirmsEmail) {
        it("leaves the person signed out, with the address unconfirmed, until the emailed link", async () => {
          const user = await auth.signUp(signUpInput());
          expect(user.emailVerified).toBe(false);
          const { firstState, unsubscribe } = watch(auth);
          expect(await firstState).toBeNull();
          expect(auth.currentUser()).toBeNull();
          unsubscribe();
        });

        it("refuses sign-in before the emailed link, then allows it after", async () => {
          const input = signUpInput();
          await auth.signUp(input);
          await refusal(auth.signIn(input.email, input.password), "email-not-verified");
          expect(auth.currentUser()).toBeNull();
          await h.confirmEmail(input.email);
          expect(await auth.signIn(input.email, input.password)).toMatchObject({ email: input.email, emailVerified: true });
        });
      } else {
        it("signs the new account in and tells listeners", async () => {
          const { seen, firstState, unsubscribe } = watch(auth);
          await firstState;
          const user = await auth.signUp(signUpInput());
          expect(auth.currentUser()).toEqual(user);
          expect(seen.at(-1)).toEqual(user);
          unsubscribe();
        });
      }

      it.each<[string, Partial<SignUpInput>, BackendErrorCode]>([
        ["a malformed email", { email: "not-an-email" }, "invalid-email"],
        ["a password under 8 characters", { password: "short" }, "weak-password"],
        ["someone under 16", { birthYear: new Date().getUTCFullYear() - 10 }, "under-age"],
        ["a birth year in the future", { birthYear: new Date().getUTCFullYear() + 1 }, "invalid-input"],
        ["a missing consent", { consents: currentConsents(CONSENT_KINDS.filter((k) => k !== "breathing-data")) }, "invalid-input"],
        ["an outdated consent version", { consents: currentConsents().map((c) => ({ ...c, version: "old" })) }, "invalid-input"],
      ])("refuses %s, and creates no account", async (_, changes, code) => {
        const input = signUpInput(changes);
        await refusal(auth.signUp(input), code);
        expect(auth.currentUser()).toBeNull();
        if (code !== "invalid-email") {
          await h.confirmEmail(input.email).catch(() => undefined);
          await refusal(auth.signIn(input.email, input.password), "invalid-credentials");
        }
      });

      it(
        traits.revealsEmailInUse
          ? "refuses an address that already has an account"
          : "answers an address that already has an account like a new one",
        async () => {
          const original = await existingAccount();
          const again = auth.signUp(signUpInput({ email: original.email, password: "another long password" }));
          if (traits.revealsEmailInUse) await refusal(again, "email-in-use");
          else await again;
          if (auth.currentUser()) await auth.signOut();
          await refusal(auth.signIn(original.email, "another long password"), "invalid-credentials");
          expect(await auth.signIn(original.email, original.password)).toMatchObject({ email: original.email });
        },
      );
    });

    describe("signIn", () => {
      it("signs in, confirms the address, and tells listeners", async () => {
        const input = await existingAccount();
        const { seen, firstState, unsubscribe } = watch(auth);
        await firstState;
        const user = await auth.signIn(input.email, input.password);
        expect(user).toMatchObject({ email: input.email, emailVerified: true });
        expect(auth.currentUser()).toEqual(user);
        expect(seen.at(-1)).toEqual(user);
        unsubscribe();
      });

      it("ignores case and surrounding space in the email", async () => {
        const input = await existingAccount();
        expect(await auth.signIn(` ${input.email.toUpperCase()}  `, input.password)).toMatchObject({ email: input.email });
      });

      it("refuses a wrong password and stays signed out", async () => {
        const input = await existingAccount();
        await refusal(auth.signIn(input.email, "wrong password"), "invalid-credentials");
        expect(auth.currentUser()).toBeNull();
      });

      it("refuses an address with no account the same way", async () => {
        await refusal(auth.signIn(uniqueEmail(), PASSWORD), "invalid-credentials");
        expect(auth.currentUser()).toBeNull();
      });
    });

    describe("signOut", () => {
      it("signs out, tells listeners, and stays signed out after a reload", async () => {
        await signedIn();
        const { seen, firstState, unsubscribe } = watch(auth);
        await firstState;
        await auth.signOut();
        expect(auth.currentUser()).toBeNull();
        expect(seen.at(-1)).toBeNull();
        unsubscribe();
        const reloaded = watch(h.reload().auth);
        expect(await reloaded.firstState).toBeNull();
        reloaded.unsubscribe();
      });
    });

    describe("sendPasswordReset", () => {
      it("answers the same whether or not the address has an account", async () => {
        const input = await existingAccount();
        await expect(auth.sendPasswordReset(input.email)).resolves.toBeUndefined();
        await expect(auth.sendPasswordReset(uniqueEmail())).resolves.toBeUndefined();
      });
    });

    describe("sendVerificationEmail", () => {
      it("answers the same for an unconfirmed address, a confirmed one and one with no account", async () => {
        const unconfirmed = signUpInput();
        await auth.signUp(unconfirmed);
        if (auth.currentUser()) await auth.signOut();
        const confirmed = await existingAccount();
        await expect(auth.sendVerificationEmail(unconfirmed.email)).resolves.toBeUndefined();
        await expect(auth.sendVerificationEmail(confirmed.email)).resolves.toBeUndefined();
        await expect(auth.sendVerificationEmail(uniqueEmail())).resolves.toBeUndefined();
      });

      it("sends a link that confirms the address, after which sign-in works", async () => {
        const input = signUpInput();
        await auth.signUp(input);
        if (auth.currentUser()) await auth.signOut();
        await auth.sendVerificationEmail(` ${input.email.toUpperCase()} `);
        await h.confirmEmail(input.email);
        expect(await auth.signIn(input.email, input.password)).toMatchObject({ email: input.email, emailVerified: true });
      });
    });
  });
}
