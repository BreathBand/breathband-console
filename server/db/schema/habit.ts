// Created now, filled by later cards (programs, milestones, mood check-in).
// Shapes with no domain type yet are loose JSON until those cards define them.

import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { BreathGoal } from "@/lib/domain/types";
import { user } from "./auth";
import { id, timestamps } from "./columns";
import { breathSessions } from "./sessions";

const GOALS = ["train", "focus", "calm"] as const satisfies readonly BreathGoal[];

/** One mood check-in around a session: five faces, 1 (worst) to 5 (best). */
export const moodCheckins = sqliteTable(
  "mood_checkins",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null before the session is saved, or after it is deleted. */
    sessionId: text("session_id").references(() => breathSessions.id, { onDelete: "set null" }),
    phase: text("phase", { enum: ["before", "after"] }).notNull(),
    mood: integer("mood").notNull(),
    ...timestamps,
  },
  (t) => [index("mood_checkins_user_created_idx").on(t.userId, t.createdAt)],
);

/** A milestone reached, once per kind ("first-calibration", "streak-7", ...). */
export const milestones = sqliteTable(
  "milestones",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    achievedAt: integer("achieved_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("milestones_user_kind_idx").on(t.userId, t.kind)],
);

/** A self-serve program ("Exam Week", "Foundations"). Content, not user data. */
export const programs = sqliteTable("programs", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  goal: text("goal", { enum: GOALS }),
  days: integer("days").notNull(),
  steps: text("steps", { mode: "json" }).$type<Record<string, unknown>[]>().notNull().default([]),
  ...timestamps,
});

/** A person following a program. */
export const enrollments = sqliteTable(
  "enrollments",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    status: text("status", { enum: ["active", "finished", "left"] })
      .notNull()
      .default("active"),
    progress: text("progress", { mode: "json" }).$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [index("enrollments_user_idx").on(t.userId)],
);
