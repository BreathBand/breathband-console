import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { AlertRules, AthleteTargets, ShareScope, UserPreferences } from "@/lib/domain/types";
import { PRO_KINDS, user } from "./auth";
import { id, timestamps } from "./columns";

export const SHARE_SCOPES = ["scores", "curves"] as const satisfies readonly ShareScope[];

/**
 * `UserProfile.preferences` plus the onboarding answers that have no domain
 * type yet (planning/v1/02 §7). Their exact shapes belong to the onboarding cards.
 */
export type ProfilePreferences = UserPreferences & {
  goalDetails?: Record<string, unknown>;
  dailyMinutes?: number;
  reminders?: Record<string, unknown>;
  gamification?: Record<string, boolean>;
};

/** Current step, completed and skipped steps, timestamps (planning/v1/02 §7). */
export type OnboardingState = Record<string, unknown>;

/** `UserProfile`: one per user. Email and role live on `user`. */
export const profiles = sqliteTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  preferences: text("preferences", { mode: "json" }).$type<ProfilePreferences>(),
  onboarding: text("onboarding", { mode: "json" }).$type<OnboardingState>(),
  ...timestamps,
});

/** What a professional told us in onboarding (planning/v1/02 §4). */
export const proProfiles = sqliteTable("pro_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: PRO_KINDS }).notNull(),
  organisation: text("organisation"),
  profession: text("profession"),
  sports: text("sports", { mode: "json" }).$type<string[]>().notNull().default([]),
  useCases: text("use_cases", { mode: "json" }).$type<string[]>().notNull().default([]),
  /** How they refer to people: "athletes", "clients", "students". */
  terminology: text("terminology").notNull(),
  /** Partial: a clinician starts with no score target. */
  defaultTargets: text("default_targets", { mode: "json" }).$type<Partial<AthleteTargets>>(),
  defaultFlags: text("default_flags", { mode: "json" }).$type<AlertRules>(),
  scopeRequested: text("scope_requested", { enum: SHARE_SCOPES }).notNull().default("scores"),
  ...timestamps,
});

/** The legal record: which terms, which version, when. */
export const consents = sqliteTable(
  "consents",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    version: text("version").notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (t) => [index("consents_user_id_idx").on(t.userId)],
);
