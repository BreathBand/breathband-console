// "Download my data": the person's rows from every table, keyed by table name,
// plus the signal of each of their sessions. Rows where they are the other side
// are in when they can already read them (a coach's comment on their session, an
// assignment set for them); a coach's private working data about them (notes,
// seen marks, squads) is the coach's, not theirs. Secrets (session tokens,
// password hashes, invite code hashes) and the method (calibration internals,
// product spec principle 7) stay out.

import { eq, getTableColumns, inArray, or, type SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Waveform } from "@/lib/domain/types";
import type { Db } from "../db/client";
import {
  accessLog,
  account,
  accountDeletions,
  alertRules,
  assignments,
  breathSessions,
  calibrations,
  coachInvites,
  coachLinks,
  coachNotes,
  comments,
  consents,
  devices,
  emailLog,
  productEvents,
  enrollments,
  groupParticipants,
  groupSessions,
  invites,
  kudos,
  milestones,
  moodCheckins,
  profiles,
  proProfiles,
  seenSessions,
  session,
  squadMembers,
  squads,
  user,
  waitlist,
} from "../db/schema";
import type { StorageService } from "../storage";

/** Bump when the shape changes, so a reader can tell exports apart. */
export const EXPORT_FORMAT = "breathband-export-v1";

/** Tables with no rows in an export, and why. Every other table in the schema is exported. */
export const NOT_EXPORTED: Record<string, string> = {
  verification: "one-time sign-in and reset tokens: credentials, not data, and gone within a day",
  programs: "program content, the same for everyone; enrollments name the program by id",
};

export type AccountExport = {
  format: typeof EXPORT_FORMAT;
  exportedAt: string;
  userId: string;
  /** SQL table name → the person's rows, with camelCase fields. */
  tables: Record<string, Record<string, unknown>[]>;
  /** Session id → its signal. Calibration keeps the lowest and highest readings only. */
  waveforms: Record<string, Waveform>;
};

/** The table's columns without `omit`. */
function columnsOf<T extends SQLiteTable>(table: T, ...omit: (keyof T["_"]["columns"])[]): Record<string, SQLiteColumn> {
  const columns: Record<string, SQLiteColumn> = { ...getTableColumns(table) };
  for (const key of omit) delete columns[key as string];
  return columns;
}

/** Everything the person `uid` can take with them, or null if there's no such person. */
export async function exportAccount(db: Db, storage: StorageService, uid: string): Promise<AccountExport | null> {
  const [person] = await db.select().from(user).where(eq(user.id, uid));
  if (!person) return null;

  const mySquads = db.select({ id: squads.id }).from(squads).where(eq(squads.coachId, uid));
  const myGroups = db.select({ id: groupSessions.id }).from(groupSessions).where(eq(groupSessions.hostId, uid));
  const groupsImIn = db.select({ id: groupParticipants.groupSessionId }).from(groupParticipants).where(eq(groupParticipants.athleteId, uid));

  const rows = <T extends SQLiteTable>(table: T, where: SQL | undefined, columns: Record<string, SQLiteColumn> = getTableColumns(table)) =>
    db.select(columns).from(table as SQLiteTable).where(where) as Promise<Record<string, unknown>[]>;

  const queries: Record<string, Promise<Record<string, unknown>[]>> = {
    user: Promise.resolve([person]),
    session: rows(session, eq(session.userId, uid), columnsOf(session, "token")),
    account: rows(account, eq(account.userId, uid), columnsOf(account, "password", "accessToken", "refreshToken", "idToken")),
    account_deletions: rows(accountDeletions, eq(accountDeletions.userId, uid)),
    profiles: rows(profiles, eq(profiles.userId, uid)),
    pro_profiles: rows(proProfiles, eq(proProfiles.userId, uid)),
    consents: rows(consents, eq(consents.userId, uid)),
    devices: rows(devices, eq(devices.userId, uid)),
    calibrations: rows(calibrations, eq(calibrations.userId, uid), columnsOf(calibrations, "a100", "midline")),
    breath_sessions: rows(breathSessions, eq(breathSessions.athleteId, uid)),
    coach_links: rows(coachLinks, or(eq(coachLinks.coachId, uid), eq(coachLinks.athleteId, uid))),
    invites: rows(invites, eq(invites.athleteId, uid), columnsOf(invites, "codeHash")),
    coach_invites: rows(coachInvites, or(eq(coachInvites.coachId, uid), eq(coachInvites.athleteId, uid)), columnsOf(coachInvites, "codeHash")),
    assignments: rows(assignments, or(eq(assignments.coachId, uid), eq(assignments.athleteId, uid))),
    comments: rows(comments, or(eq(comments.athleteId, uid), eq(comments.authorId, uid))),
    kudos: rows(kudos, or(eq(kudos.athleteId, uid), eq(kudos.authorId, uid))),
    // A coach's own working data: only when the person is that coach.
    seen_sessions: rows(seenSessions, eq(seenSessions.coachId, uid)),
    coach_notes: rows(coachNotes, eq(coachNotes.coachId, uid)),
    squads: rows(squads, eq(squads.coachId, uid)),
    squad_members: rows(squadMembers, inArray(squadMembers.squadId, mySquads)),
    alert_rules: rows(alertRules, eq(alertRules.coachId, uid)),
    group_sessions: rows(groupSessions, or(eq(groupSessions.hostId, uid), inArray(groupSessions.id, groupsImIn))),
    group_participants: rows(groupParticipants, or(inArray(groupParticipants.groupSessionId, myGroups), eq(groupParticipants.athleteId, uid))),
    waitlist: rows(waitlist, eq(waitlist.email, person.email.toLowerCase())),
    access_log: rows(accessLog, or(eq(accessLog.athleteId, uid), eq(accessLog.viewerId, uid))),
    mood_checkins: rows(moodCheckins, eq(moodCheckins.userId, uid)),
    milestones: rows(milestones, eq(milestones.userId, uid)),
    enrollments: rows(enrollments, eq(enrollments.userId, uid)),
    email_log: rows(emailLog, eq(emailLog.userId, uid)),
    product_events: rows(productEvents, eq(productEvents.userId, uid)),
  };

  const tables: AccountExport["tables"] = {};
  for (const [name, query] of Object.entries(queries)) tables[name] = await query;

  const waveforms: AccountExport["waveforms"] = {};
  for (const s of tables.breath_sessions) {
    const waveform = await storage.getJson<Waveform>(String(s.waveformPath));
    if (waveform) waveforms[String(s.id)] = withoutMethod(waveform);
  }

  return { format: EXPORT_FORMAT, exportedAt: new Date().toISOString(), userId: uid, tables, waveforms };
}

/** The signal with the calibration's lowest and highest readings, not the scoring's internals. */
function withoutMethod(waveform: Waveform): Waveform {
  const { min, max } = waveform.calibration;
  return { ...waveform, calibration: { min, max } };
}
