// Drops a file database and applies the migrations to a fresh one. File
// databases only: anything else (Turso's libsql://, https://, a local sqld)
// is refused before a connection is made.

import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "../client";
import { MIGRATIONS_DIR } from "../env";

/** The file behind a `file:` URL, or null when the URL isn't a file database. */
export function fileDatabasePath(url: string): string | null {
  if (!url.startsWith("file:")) return null;
  const path = url.slice("file:".length).split("?")[0];
  if (!path || path === ":memory:") return null;
  return path;
}

export async function resetFileDatabase(url: string, migrationsFolder = MIGRATIONS_DIR): Promise<void> {
  const path = fileDatabasePath(url);
  if (path === null) {
    throw new Error("db:reset works on file databases only (TURSO_DATABASE_URL=file:./data/<name>.db). Refusing to reset this one.");
  }
  // libSQL may leave its write-ahead log and shared-memory files next to the database.
  for (const file of [path, `${path}-wal`, `${path}-shm`, `${path}-journal`]) rmSync(file, { force: true });
  const { client, db } = createDb(url);
  try {
    await migrate(db, { migrationsFolder: resolve(migrationsFolder) });
  } finally {
    client.close();
  }
}
