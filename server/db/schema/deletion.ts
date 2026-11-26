import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { timestamps } from "./columns";

/**
 * An account its owner asked to delete. While a row is here the person's data is
 * hidden; server/jobs/deletion.ts deletes the account 24 h after `requested_at`,
 * and cancelling inside that window removes the row.
 */
export const accountDeletions = sqliteTable(
  "account_deletions",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    requestedAt: integer("requested_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (t) => [index("account_deletions_requested_idx").on(t.requestedAt)],
);
