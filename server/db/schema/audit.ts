import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { id, timestamps } from "./columns";
import { breathSessions } from "./sessions";

/** Who opened which person's session, and when (`created_at`). The person can read their own. */
export const accessLog = sqliteTable(
  "access_log",
  {
    id: id(),
    viewerId: text("viewer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    athleteId: text("athlete_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null once the person deletes the session; the entry stays. */
    sessionId: text("session_id").references(() => breathSessions.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("access_log_athlete_created_idx").on(t.athleteId, t.createdAt)],
);

/** Product events (D15, R1): a name from `PRODUCT_EVENTS` and a few flat properties; never breathing data. */
export const productEvents = sqliteTable(
  "product_events",
  {
    id: id(),
    /** Deleted with the account, like everything else of theirs. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    props: text("props", { mode: "json" }).$type<Record<string, string | number | boolean>>(),
    /** When it happened in the browser; `created_at` is when the API got it. */
    at: integer("at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (t) => [index("product_events_name_at_idx").on(t.name, t.at)],
);
