import { sql } from "drizzle-orm";
import { integer, text } from "drizzle-orm/sqlite-core";
import type { SessionMode } from "@/lib/domain/types";

/** Milliseconds since the epoch, set by the database. */
const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/** Every table has these. */
export const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(nowMs)
    .$onUpdate(() => new Date()),
};

/** A random text id, for tables whose rows are created by the API. */
export const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/** Used by breath_sessions and assignments. Kept here because sessions.ts and coaching.ts import each other. */
export const SESSION_MODES = ["paced", "open"] as const satisfies readonly SessionMode[];
