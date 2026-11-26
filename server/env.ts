// The API's environment, validated once at startup. Read from the process
// environment only: nothing here loads a .env file (.env.local can hold the
// owner's Turso credentials).

import { z } from "zod";
import { databaseAuthToken, databaseUrl } from "./db/env";

export type Mode = "development" | "test" | "production";

const blankAsUndefined = (value: unknown) => (value === "" ? undefined : value);

const schema = z.object({
  // Unset means production: no stack traces in errors and no CORS unless asked for.
  NODE_ENV: z.preprocess(blankAsUndefined, z.enum(["development", "test", "production"]).default("production")),
  API_PORT: z.preprocess(blankAsUndefined, z.coerce.number().int().min(1).max(65535).default(8787)),
  APP_URL: z.preprocess(blankAsUndefined, z.url().default("http://localhost:3000")),
  STORAGE_DIR: z.preprocess(blankAsUndefined, z.string().default("./data/blobs")),
  SMTP_HOST: z.preprocess(blankAsUndefined, z.string().optional()),
  SMTP_PORT: z.preprocess(blankAsUndefined, z.coerce.number().int().min(1).max(65535).optional()),
  SMTP_FROM: z.preprocess(blankAsUndefined, z.string().optional()),
});

export type Env = {
  mode: Mode;
  port: number;
  appUrl: string;
  databaseUrl: string;
  databaseAuthToken: string | undefined;
  storageDir: string;
  smtp: { host?: string; port?: number; from?: string };
};

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
    port: env.API_PORT,
    appUrl: env.APP_URL,
    databaseUrl: databaseUrl(database),
    databaseAuthToken: databaseAuthToken(database),
    storageDir: env.STORAGE_DIR,
    smtp: { host: env.SMTP_HOST, port: env.SMTP_PORT, from: env.SMTP_FROM },
  };
}
