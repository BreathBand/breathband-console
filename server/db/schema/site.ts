import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { id, timestamps } from "./columns";

/** `WaitlistEntry`. */
export const waitlist = sqliteTable("waitlist", {
  id: id(),
  email: text("email").notNull().unique(),
  /** Where the sign-up came from, e.g. "hero" or "footer". */
  source: text("source").notNull(),
  ...timestamps,
});
