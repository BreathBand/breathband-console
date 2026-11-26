import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
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
