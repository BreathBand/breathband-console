import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { GroupSession, PacerHalfCycle } from "@/lib/domain/types";
import { user } from "./auth";
import { id, timestamps } from "./columns";
import { breathSessions } from "./sessions";

const GROUP_STATUSES = ["lobby", "live", "ended", "cancelled"] as const satisfies readonly GroupSession["status"][];

/** `GroupSession`: its state only. The live signal goes over a realtime channel and isn't stored. */
export const groupSessions = sqliteTable(
  "group_sessions",
  {
    id: id(),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    hostName: text("host_name").notNull(),
    title: text("title").notNull(),
    pacerHalfCycleSec: integer("pacer_half_cycle_sec").$type<PacerHalfCycle>().notNull(),
    durationSec: integer("duration_sec").notNull(),
    status: text("status", { enum: GROUP_STATUSES }).notNull().default("lobby"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    pacerChanges: text("pacer_changes", { mode: "json" })
      .$type<GroupSession["pacerChanges"]>()
      .notNull()
      .default([]),
    markers: text("markers", { mode: "json" }).$type<number[]>().notNull().default([]),
    groupAverage: real("group_average"),
    ...timestamps,
  },
  (t) => [index("group_sessions_host_created_idx").on(t.hostId, t.createdAt)],
);

/** `GroupSession.athleteIds` and `results`: one row per invited athlete. */
export const groupParticipants = sqliteTable(
  "group_participants",
  {
    groupSessionId: text("group_session_id")
      .notNull()
      .references(() => groupSessions.id, { onDelete: "cascade" }),
    athleteId: text("athlete_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The session this athlete saved when the group session ended; null until then. */
    sessionId: text("session_id").references(() => breathSessions.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.groupSessionId, t.athleteId] }),
    index("group_participants_athlete_idx").on(t.athleteId),
  ],
);
