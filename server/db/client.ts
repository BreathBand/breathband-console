import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { databaseAuthToken, databaseUrl } from "./env";
import * as schema from "./schema";

export function createDb(url = databaseUrl(), authToken = databaseAuthToken()) {
  ensureFileDirectory(url);
  const client = createClient({ url, authToken });
  return { client, db: drizzle(client, { schema }) };
}

export type Db = ReturnType<typeof createDb>["db"];

/** libSQL creates the database file but not its folder (`data/` is gitignored, so often missing). */
function ensureFileDirectory(url: string): void {
  if (!url.startsWith("file:")) return;
  const path = url.slice("file:".length);
  if (path && path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
}
