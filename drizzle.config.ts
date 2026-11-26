import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";
import { databaseAuthToken, databaseUrl, MIGRATIONS_DIR } from "./server/db/env";

// drizzle-kit reads ./.env by itself before loading this file. This repo keeps
// its environment in .env.local and passes it in explicitly
// (`node --env-file=.env.local ...`), so a stray .env must not be picked up.
if (existsSync(".env")) {
  throw new Error("Found ./.env, which drizzle-kit would load automatically. Move it to .env.local.");
}

export default defineConfig({
  dialect: "turso",
  schema: "./server/db/schema/index.ts",
  out: MIGRATIONS_DIR,
  dbCredentials: { url: databaseUrl(), authToken: databaseAuthToken() },
  strict: true,
  verbose: true,
});
