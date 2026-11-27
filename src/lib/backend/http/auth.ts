import { ageGateProblem, consentsProblem } from "@/lib/domain/consent";
import { BackendError, type AuthService, type AuthUser } from "../types";
import type { ApiClient } from "./client";
import { HTTP_ROUTES } from "./routes";

// AuthService over Better Auth at /api/auth/* (server/auth.ts). The session is
// an HttpOnly cookie the browser sends with every request; this side only
// keeps a copy of who that is, so currentUser() can answer without waiting.

/** Where the emailed links land on the web app. */
const AFTER_VERIFY_PATH = "/cloud/";
const RESET_PATH = "/cloud/reset/";

const ROUTES = HTTP_ROUTES.auth;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

type ApiUser = { id: string; email: string; emailVerified: boolean };

export interface HttpAuthOptions {
  /** The web app's origin; the reset link redirects there. Absolute, because the API may be on another origin. */
  appUrl: () => string;
  now: () => Date;
}

/** AuthService, plus a way for the data routes to say the session is gone. */
export interface HttpAuth extends AuthService {
  /** The API answered 401: count the person as signed out and tell listeners. */
  expire(): void;
}

export function createHttpAuth(api: ApiClient, options: HttpAuthOptions): HttpAuth {
  const listeners = new Set<(user: AuthUser | null) => void>();
  let user: AuthUser | null = null;
  let loaded = false;
  let loading: Promise<void> | null = null;

  const set = (next: AuthUser | null) => {
    user = next;
    loaded = true;
    listeners.forEach((l) => l(user));
  };

  // The first read of the session. Until it answers, there is no state to report:
  // onAuthStateChanged waits for it (as Firebase's does) rather than saying "signed out".
  const load = () => {
    loading ??= api
      .get<{ user: ApiUser } | null>(ROUTES.currentUser.path)
      .then((session) => session?.user ?? null)
      .catch(() => null)
      .then((found) => {
        // A sign-in or sign-out that finished first is newer than this read.
        if (!loaded) set(found ? toAuthUser(found) : null);
      });
    return loading;
  };

  return {
    expire() {
      if (user) set(null);
    },

    currentUser() {
      void load();
      return user;
    },

    onAuthStateChanged(callback) {
      listeners.add(callback);
      if (loaded) callback(user);
      else void load();
      return () => listeners.delete(callback);
    },

    async signIn(email, password) {
      const { user: signedIn } = await api.post<{ user: ApiUser }>(ROUTES.signIn.path, {
        email: normalize(email),
        password,
        // If the address isn't confirmed yet, the API emails a fresh link; it lands here.
        callbackURL: AFTER_VERIFY_PATH,
      });
      const next = toAuthUser(signedIn);
      set(next);
      return next;
    },

    async signUp({ email, password, displayName, role, consents, birthYear }) {
      // The same checks, in the same order, as the local adapter, so nothing is sent
      // that would be refused. The API repeats them all and stores the consents (I-08).
      const address = normalize(email);
      if (!EMAIL_PATTERN.test(address)) throw new BackendError("invalid-email");
      if (password.length < MIN_PASSWORD_LENGTH) throw new BackendError("weak-password");
      const tooYoung = ageGateProblem(birthYear, options.now());
      if (tooYoung) {
        throw tooYoung.code === "under-age"
          ? new BackendError("under-age", tooYoung.message)
          : new BackendError("invalid-input", `birthYear: ${tooYoung.message}`);
      }
      const missing = consentsProblem(consents);
      if (missing) throw new BackendError("invalid-input", missing);

      const { token, user: created } = await api.post<{ token: string | null; user: ApiUser }>(
        ROUTES.signUp.path,
        {
          name: displayName.trim(),
          email: address,
          password,
          role,
          birthYear,
          consents,
          // Relative: the API points it at APP_URL (callbackOnApp in server/auth.ts).
          callbackURL: AFTER_VERIFY_PATH,
        },
      );
      const next = toAuthUser(created);
      // With email verification on (it is), there's no session until the emailed link is followed.
      if (token) set(next);
      return next;
    },

    async sendPasswordReset(email) {
      await api.post(ROUTES.sendPasswordReset.path, {
        email: normalize(email),
        redirectTo: new URL(RESET_PATH, options.appUrl()).href,
      });
    },

    async sendVerificationEmail(email) {
      // Better Auth answers the same for an unknown or confirmed address, so this reveals nothing.
      await api.post(ROUTES.sendVerificationEmail.path, {
        email: normalize(email),
        // Relative, as at sign-up: the API points it at APP_URL.
        callbackURL: AFTER_VERIFY_PATH,
      });
    },

    async signOut() {
      try {
        await api.post(ROUTES.signOut.path);
      } finally {
        set(null);
      }
    },
  };
}

const normalize = (email: string) => email.trim().toLowerCase();

const toAuthUser = (user: ApiUser): AuthUser => ({
  uid: user.id,
  email: user.email,
  emailVerified: user.emailVerified,
});
