import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { SkillLevel } from "@/lib/analysis/config";
import type { OpenDetails, PacedDetails, SessionScores, TransitionScores } from "@/lib/domain/types";
import { user } from "./auth";
import { assignments } from "./coaching";
import { id, SESSION_MODES, timestamps } from "./columns";
import { calibrations, devices } from "./devices";
import { groupSessions } from "./group";

const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const satisfies readonly SkillLevel[];

/**
 * `SessionSummary`: scalar columns for listing and filtering, JSON for the
 * nested score details. The signal itself is a blob at `waveform_path`.
 */
export const breathSessions = sqliteTable(
  "breath_sessions",
  {
    id: id(),
    athleteId: text("athlete_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    durationSec: integer("duration_sec").notNull(),
    mode: text("mode", { enum: SESSION_MODES }).notNull(),
    pacerHalfCycleSec: integer("pacer_half_cycle_sec").$type<2 | 5>(),
    scoringVersion: text("scoring_version").notNull(),
    respirationRateBpm: real("respiration_rate_bpm"),
    /** Total Breath Score (or the legacy overall), copied out of `scores` for sorting and filtering. */
    total: real("total"),
    source: text("source", { enum: ["app", "web"] }),
    skillLevel: text("skill_level", { enum: SKILL_LEVELS }),
    scores: text("scores", { mode: "json" }).$type<SessionScores | TransitionScores>(),
    paced: text("paced", { mode: "json" }).$type<PacedDetails>(),
    open: text("open", { mode: "json" }).$type<OpenDetails>(),
    note: text("note").notNull().default(""),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    calibrationId: text("calibration_id").references(() => calibrations.id, { onDelete: "set null" }),
    deviceId: text("device_id").references(() => devices.id, { onDelete: "set null" }),
    groupSessionId: text("group_session_id").references(() => groupSessions.id, { onDelete: "set null" }),
    assignmentId: text("assignment_id").references(() => assignments.id, { onDelete: "set null" }),
    waveformPath: text("waveform_path").notNull(),
    appVersion: text("app_version").notNull(),
    ...timestamps,
  },
  (t) => [index("breath_sessions_athlete_started_idx").on(t.athleteId, t.startedAt)],
);
