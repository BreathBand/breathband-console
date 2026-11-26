// Where the database is. Read from the process environment only: nothing here
// loads a .env file. To point at Turso, the caller passes the environment in,
// e.g. `node --env-file=.env.local --import tsx server/db/migrate.ts`.

export const DEFAULT_DATABASE_URL = "file:./data/breathband.db";

export const MIGRATIONS_DIR = "./server/db/migrations";

export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.TURSO_DATABASE_URL || DEFAULT_DATABASE_URL;
}

export function databaseAuthToken(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.TURSO_AUTH_TOKEN || undefined;
}
