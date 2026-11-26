// Seeds the demo people (the local adapter's: Lena Vos, Alex Morgan, Sam, Priya,
// Maya, Leo; password "breathband") with their sessions, signals, coaching and
// mood check-ins. Idempotent and insert-only: run it again and nothing changes.
// Run the migrations first (`npm run db:migrate`, or `npm run db:reset`).
//
//   npm run db:seed                                      the local file DB
//   TURSO_DATABASE_URL=file:./data/other.db npm run db:seed
//   npm run db:seed -- --refresh                         remove the demo people first, then seed afresh
//   node --env-file=.env.local --import tsx server/db/seed.ts   Turso (the lead only)
//
// Signals go to STORAGE_DIR (default ./data/blobs), as the API stores them.
// The coach invite's code is derived under AUTH_SECRET, as the API does: seed with
// the same AUTH_SECRET the API runs with (unset outside production: the dev-only one).

import { authSecret } from "../auth";
import { createDb } from "./client";
import { databaseUrl } from "./env";
import { createFsStorage } from "../storage";
import { seedDemo, SEED_TABLES } from "./seed/write";

async function main(): Promise<void> {
  const url = databaseUrl();
  const refresh = process.argv.includes("--refresh");
  const secret = authSecret(process.env.NODE_ENV === "production" ? "production" : "development", process.env.AUTH_SECRET || undefined);
  const { client, db } = createDb(url);
  try {
    const result = await seedDemo({ db, storage: createFsStorage(process.env.STORAGE_DIR || "./data/blobs"), refresh, secret });
    const total = SEED_TABLES.reduce((sum, table) => sum + result.inserted[table], 0);
    const where = url.startsWith("file:") ? url : "the remote database";
    if (refresh) console.log(`Removed ${result.removed} demo people first.`);
    for (const email of result.skipped) console.warn(`Skipped ${email}: another account already uses it.`);
    console.log(`Seeded ${where}: ${total} new rows, ${result.waveformsWritten} signals written.`);
    for (const table of SEED_TABLES) console.log(`  ${table.padEnd(16)} ${result.inserted[table]}`);
  } finally {
    client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
