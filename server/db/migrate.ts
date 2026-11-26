// Applies the committed migrations in server/db/migrations.
//
//   npm run db:migrate                                   the local file DB
//   TURSO_DATABASE_URL=file:./data/other.db npm run db:migrate
//   node --env-file=.env.local --import tsx server/db/migrate.ts   Turso (the lead only)

import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "./client";
import { databaseUrl, MIGRATIONS_DIR } from "./env";

async function main(): Promise<void> {
  const url = databaseUrl();
  const { client, db } = createDb(url);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    client.close();
  }
  console.log(`Migrations applied to ${url.startsWith("file:") ? url : "the remote database"}.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
