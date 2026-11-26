import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { AthleteTargets } from "@/lib/domain/types";
import { user } from "./auth";
import { timestamps } from "./columns";
import { SHARE_SCOPES } from "./people";

/** `CoachLink`: a coach's read access to one athlete. */
export const coachLinks = sqliteTable(
  "coach_links",
  {
    coachId: text("coach_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    athleteId: text("athlete_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scope: text("scope", { enum: SHARE_SCOPES }).notNull(),
    targets: text("targets", { mode: "json" }).$type<AthleteTargets>(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.coachId, t.athleteId] }), index("coach_links_athlete_idx").on(t.athleteId)],
);

/** `Invite`: a code an athlete gives a coach. Only a hash of the code is stored. */
export const invites = sqliteTable(
  "invites",
  {
    codeHash: text("code_hash").primaryKey(),
    athleteId: text("athlete_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scope: text("scope", { enum: SHARE_SCOPES }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: ["pending", "redeemed", "revoked"] })
      .notNull()
      .default("pending"),
    ...timestamps,
  },
  (t) => [index("invites_athlete_idx").on(t.athleteId)],
);

/** `CoachInvite`: a coach asking an athlete to share. Only a hash of the code is stored. */
export const coachInvites = sqliteTable(
  "coach_invites",
  {
    codeHash: text("code_hash").primaryKey(),
    coachId: text("coach_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    coachName: text("coach_name").notNull(),
    athleteName: text("athlete_name").notNull(),
    contact: text("contact").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: ["pending", "accepted", "declined", "revoked"] })
      .notNull()
      .default("pending"),
    athleteId: text("athlete_id").references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("coach_invites_coach_idx").on(t.coachId)],
);
