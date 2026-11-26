// The API's environment, validated once at startup. Read from the process
// environment only: nothing here loads a .env file (.env.local can hold the
// owner's Turso credentials).

import { z } from "zod";
import { databaseAuthToken, databaseUrl } from "./db/env";

export const DEFAULT_API_PORT = 8787;

export type Mode = "development" | "test" | "production";

const blankAsUndefined = (value: unknown) => (value === "" ? undefined : value);

// How many proxies in front of the API append to X-Forwarded-For (T-0133). 0, the default, trusts none:
// the rate limits key on the socket's address, since without a proxy a client writes that header itself.
// Cloud Run alone is 1 (its front end appends the client's address); behind a load balancer as well, 2.
// The deploy sets it (I-16). Read per request by clientIp() in server/rate-limit.ts.
const trustedProxyHopsSchema = z.preprocess(blankAsUndefined, z.coerce.number().int().min(0).max(10).default(0));

const schema = z.object({
  // Unset means production: no stack traces in errors and no CORS unless asked for.
  NODE_ENV: z.preprocess(blankAsUndefined, z.enum(["development", "test", "production"]).default("production")),
  // The API's port. When it is unset, production falls back to PORT (Cloud Run
  // sets it), then 8787. Outside production PORT is ignored: it is Next's dev port.
  API_PORT: z.preprocess(blankAsUndefined, z.coerce.number().int().min(1).max(65535).optional()),
  PORT: z.preprocess(blankAsUndefined, z.coerce.number().int().min(1).max(65535).optional()),
  APP_URL: z.preprocess(blankAsUndefined, z.url().default("http://localhost:3000")),
  STORAGE_DIR: z.preprocess(blankAsUndefined, z.string().default("./data/blobs")),
  SMTP_HOST: z.preprocess(blankAsUndefined, z.string().optional()),
  SMTP_PORT: z.preprocess(blankAsUndefined, z.coerce.number().int().min(1).max(65535).optional()),
  SMTP_FROM: z.preprocess(blankAsUndefined, z.string().optional()),
  SMTP_USER: z.preprocess(blankAsUndefined, z.string().optional()),
  SMTP_PASS: z.preprocess(blankAsUndefined, z.string().optional()),
  // Checked by authSecret() in server/auth.ts: required in production, a dev-only fallback otherwise.
  AUTH_SECRET: z.preprocess(blankAsUndefined, z.string().optional()),
  // The API's public address; links in auth emails point here. See authBaseUrl() in server/auth.ts.
  API_URL: z.preprocess(blankAsUndefined, z.url().optional()),
  // Validated at startup with the rest; read through trustedProxyHops() below.
  TRUSTED_PROXY_HOPS: trustedProxyHopsSchema,
});

export type Env = {
  mode: Mode;
  port: number;
  appUrl: string;
  databaseUrl: string;
  databaseAuthToken: string | undefined;
  storageDir: string;
  smtp: SmtpEnv;
  authSecret?: string;
  apiUrl?: string;
};

export type SmtpEnv = { host?: string; port?: number; from?: string; user?: string; pass?: string };

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  const env = parsed.data;
  const database: NodeJS.ProcessEnv = {
    NODE_ENV: env.NODE_ENV,
    TURSO_DATABASE_URL: source.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: source.TURSO_AUTH_TOKEN,
  };
  return {
    mode: env.NODE_ENV,
    port: env.API_PORT ?? (env.NODE_ENV === "production" ? env.PORT : undefined) ?? DEFAULT_API_PORT,
    appUrl: env.APP_URL,
    databaseUrl: databaseUrl(database),
    databaseAuthToken: databaseAuthToken(database),
    storageDir: env.STORAGE_DIR,
    smtp: { host: env.SMTP_HOST, port: env.SMTP_PORT, from: env.SMTP_FROM, user: env.SMTP_USER, pass: env.SMTP_PASS },
    authSecret: env.AUTH_SECRET,
    apiUrl: env.API_URL,
  };
}

/**
 * TRUSTED_PROXY_HOPS (see trustedProxyHopsSchema): 0 unless set. Not part of
 * `Env`: the rate limits read it where they key a request, so it needs no
 * threading through the app. readEnv() still validates it at startup.
 */
export function trustedProxyHops(source: Record<string, string | undefined> = process.env): number {
  const parsed = trustedProxyHopsSchema.safeParse(source.TRUSTED_PROXY_HOPS);
  if (!parsed.success) throw new Error(`Invalid environment: TRUSTED_PROXY_HOPS: ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}
