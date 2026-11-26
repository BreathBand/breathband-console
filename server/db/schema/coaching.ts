import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { AthleteTargets } from "@/lib/domain/types";
import { ROLES, user } from "./auth";
import { id, SESSION_MODES, timestamps } from "./columns";
import { SHARE_SCOPES } from "./people";
import { breathSessions } from "./sessions";

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

/** `Assignment`: practice a coach sets for an athlete. */
export const assignments = sqliteTable(
  "assignments",
  {
    id: id(),
    coachId: text("coach_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    athleteId: text("athlete_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mode: text("mode", { enum: SESSION_MODES }).notNull(),
    pacerHalfCycleSec: integer("pacer_half_cycle_sec").$type<2 | 5>(),
    durationSec: integer("duration_sec").notNull(),
    target: integer("target").notNull(),
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    note: text("note").notNull().default(""),
    cancelled: integer("cancelled", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index("assignments_athlete_created_idx").on(t.athleteId, t.createdAt), index("assignments_coach_idx").on(t.coachId)],
);

/** Who wrote on a session, copied at write time (`SessionComment.authorName`/`authorRole`). */
const author = () => ({
  authorId: text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  authorRole: text("author_role", { enum: ROLES }).notNull(),
});

/** `SessionComment` with `kind: "comment"`. */
export const comments = sqliteTable(
  "comments",
  {
    id: id(),
    athleteId: text("athlete_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => breathSessions.id, { onDelete: "cascade" }),
    ...author(),
    text: text("text").notNull(),
    ...timestamps,
  },
  (t) => [index("comments_athlete_session_idx").on(t.athleteId, t.sessionId, t.createdAt)],
);

/** `SessionComment` with `kind: "kudos"`: one per person per session. */
export const kudos = sqliteTable(
  "kudos",
  {
    id: id(),
    athleteId: text("athlete_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => breathSessions.id, { onDelete: "cascade" }),
    ...author(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("kudos_session_author_idx").on(t.sessionId, t.authorId),
    index("kudos_athlete_idx").on(t.athleteId),
  ],
);

/** Sessions a coach has opened (`listSeenSessions`). */
export const seenSessions = sqliteTable(
  "seen_sessions",
  {
    coachId: text("coach_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    athleteId: text("athlete_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => breathSessions.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.coachId, t.sessionId] }), index("seen_sessions_athlete_idx").on(t.athleteId)],
);

/** A coach's private note about one athlete. The athlete can't read it. */
export const coachNotes = sqliteTable(
  "coach_notes",
  {
    coachId: text("coach_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    athleteId: text("athlete_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    text: text("text").notNull().default(""),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.coachId, t.athleteId] }), index("coach_notes_athlete_idx").on(t.athleteId)],
);

/** `Squad`: a coach's own grouping of athletes. Members are in `squad_members`. */
export const squads = sqliteTable(
  "squads",
  {
    id: id(),
    coachId: text("coach_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...timestamps,
  },
  (t) => [index("squads_coach_idx").on(t.coachId)],
);

/** `Squad.athleteIds`. */
export const squadMembers = sqliteTable(
  "squad_members",
  {
    squadId: text("squad_id")
      .notNull()
      .references(() => squads.id, { onDelete: "cascade" }),
    athleteId: text("athlete_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.squadId, t.athleteId] }), index("squad_members_athlete_idx").on(t.athleteId)],
);

/** `AlertRules`, one row per coach; no row means `DEFAULT_ALERTS`. Null or false switches a rule off. */
export const alertRules = sqliteTable("alert_rules", {
  coachId: text("coach_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  missedDays: integer("missed_days"),
  scoreDrop: real("score_drop"),
  belowTarget: integer("below_target"),
  trendingDown: integer("trending_down", { mode: "boolean" }).notNull(),
  rateOutOfRange: integer("rate_out_of_range", { mode: "boolean" }).notNull(),
  practiceBehind: integer("practice_behind", { mode: "boolean" }).notNull(),
  ...timestamps,
});
