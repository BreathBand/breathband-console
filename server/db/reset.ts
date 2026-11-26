// Drops the file database and re-applies the migrations. Refuses anything but a
// file: URL, so it can never reach Turso.
//
//   npm run db:reset                                     the local file DB (data/breathband.db)
//   TURSO_DATABASE_URL=file:./data/other.db npm run db:reset
//
// Signals under STORAGE_DIR are left where they are; `npm run db:seed` rewrites the demo's.

import { databaseUrl } from "./env";
import { resetFileDatabase } from "./seed/reset";

async function main(): Promise<void> {
  const url = databaseUrl();
  await resetFileDatabase(url);
  console.log(`Reset ${url} and applied the migrations.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
