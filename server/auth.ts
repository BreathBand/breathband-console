// Better Auth: email and password with required email verification and reset
// by email, cookie sessions, and the user's role, pro kind and birth year.
// Runs on the hand-written tables in db/schema/auth.ts through the Drizzle
// adapter (provider "sqlite", libSQL). Mounted at /api/auth by routes/auth.ts.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { z } from "zod";
import type { Db } from "./db/client";
import { account, PRO_KINDS, ROLES, session, user as userTable, verification } from "./db/schema/auth";
import type { Env, Mode } from "./env";
import { resetPasswordEmail, verificationEmail, type Mailer } from "./mailer";
import { signUpHooks } from "./routes/profile";

export const AUTH_BASE_PATH = "/api/auth";

/** Per client IP. Better Auth's default for sign-in is 3 per 10 s; this is gentler on typos, stricter on guessing. */
export const SIGN_IN_RATE_LIMIT = { window: 60, max: 5 } as const;

const MIN_SECRET_LENGTH = 32;

/** Never used in production: authSecret() refuses to start without AUTH_SECRET there. */
export const DEV_ONLY_AUTH_SECRET = "dev-only-insecure-auth-secret:breathband-local-not-for-production";

export type AuthDeps = {
  db: Db;
  mode: Mode;
  /** Signs session cookies and tokens. From authSecret(). */
  secret: string;
  /** The API's public origin; links in emails point at `${baseUrl}/api/auth/...`. From authBaseUrl(). */
  baseUrl: string;
  /** The web app's origin; allowed as a request origin and as a callback or redirect target. */
  appUrl: string;
  mailer: Mailer;
};

/** AUTH_SECRET, required in production (32+ characters); a fixed, public dev-only value otherwise. */
export function authSecret(mode: Mode, secret: string | undefined): string {
  if (mode !== "production") return secret ?? DEV_ONLY_AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required in production. Generate one with `openssl rand -base64 32`.");
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production.`);
  }
  if (secret === DEV_ONLY_AUTH_SECRET) throw new Error("AUTH_SECRET is the dev-only value; set a real secret.");
  return secret;
}

/** API_URL if set; else APP_URL in production (one origin serves both), the API's own port otherwise. */
export function authBaseUrl(env: Pick<Env, "mode" | "apiUrl" | "appUrl" | "port">): string {
  if (env.apiUrl) return new URL(env.apiUrl).origin;
  if (env.mode === "production") return new URL(env.appUrl).origin;
  return `http://localhost:${env.port}`;
}

export function createAuth(deps: AuthDeps) {
  const production = deps.mode === "production";
  const thisYear = new Date().getUTCFullYear();

  return betterAuth({
    appName: "Breathband",
    baseURL: deps.baseUrl,
    basePath: AUTH_BASE_PATH,
    secret: deps.secret,
    trustedOrigins: [new URL(deps.appUrl).origin],
    database: drizzleAdapter(deps.db, {
      provider: "sqlite",
      schema: { user: userTable, session, account, verification },
    }),
    user: {
      additionalFields: {
        role: {
          type: [...ROLES],
          required: false,
          defaultValue: "athlete",
          input: true,
          validator: { input: z.enum(ROLES) },
        },
        proKind: {
          type: [...PRO_KINDS],
          required: false,
          input: true,
          validator: { input: z.enum(PRO_KINDS).nullable() },
        },
        birthYear: {
          type: "number",
          required: false,
          input: true,
          validator: { input: z.number().int().min(1900).max(thisYear).nullable() },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        await deps.mailer.send(resetPasswordEmail(user.email, user.name, url));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // An unverified sign-in attempt sends a fresh link (still under the sign-in rate limit).
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 24 * 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await deps.mailer.send(verificationEmail(user.email, user.name, callbackOnApp(url, deps.appUrl)));
      },
    },
    // Sign-up needs a year of birth (16+, the web's year rule) and the consents, stored with the profile row (I-08, T-0139).
    databaseHooks: { user: signUpHooks(deps.db) },
    rateLimit: {
      // On in every mode, so tests see what production does. In memory: one API instance for now.
      enabled: true,
      storage: "memory",
      customRules: { "/sign-in/email": SIGN_IN_RATE_LIMIT },
    },
    advanced: {
      cookiePrefix: "breathband",
      useSecureCookies: production,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: production },
      // Better Auth skips the origin check when NODE_ENV=test; keep it on so tests match production.
      disableOriginCheck: false,
    },
    telemetry: { enabled: false },
    logger: { disabled: deps.mode === "test" },
  });
}

export type Auth = ReturnType<typeof createAuth>;

/**
 * Better Auth resolves a relative callbackURL (its default is "/") against the API, which in
 * development is another port. Emailed links should land on the web app, so point it there.
 */
export function callbackOnApp(link: string, appUrl: string): string {
  const url = new URL(link);
  const callback = url.searchParams.get("callbackURL");
  if (callback?.startsWith("/")) {
    const onApp = new URL(callback, appUrl);
    // "//host" and "/\host" are not paths; leave them for Better Auth's origin check to refuse.
    if (onApp.origin === new URL(appUrl).origin) url.searchParams.set("callbackURL", onApp.href);
  }
  return url.href;
}
