// Scheduled emails (L3, L4): the daily reminder and the professionals' Monday
// summary. A plain timer, like the deletion job; Cloud Scheduler takes it over
// later. `email_log` makes each at most once per person and day, so a restart
// or two instances never send twice.
//
// Reminder: at the person's time on their days, in their time zone, unless
// they've already breathed that day, never in quiet hours (21:00–08:00), and
// at most one a day. Open practice from a professional comes first in its line.

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { emailOn } from "@/lib/domain/preferences";
import type { ReminderPreferences, UserPreferences, Weekday } from "@/lib/domain/types";
import type { Db } from "../db/client";
import { assignments, breathSessions, coachLinks, emailLog, profiles, user } from "../db/schema";
import { digestEmail, reminderEmail, type Mailer } from "../mailer";
import { unsubscribeLink, type NotifierDeps } from "../notify";

export const EMAIL_JOB_INTERVAL_MS = 5 * 60_000;
const QUIET_FROM = 21 * 60;
const QUIET_UNTIL = 8 * 60;
const DIGEST_DAY: Weekday = "mon";
const DIGEST_AT = 8 * 60;
const WEEK_MS = 7 * 86_400_000;

const WEEKDAYS: Record<string, Weekday> = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun" };

/** The wall clock in a time zone: its date (YYYY-MM-DD), weekday, and minutes since midnight. */
export function localClock(now: Date, timeZone: string): { day: string; weekday: Weekday; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  } catch {
    return localClock(now, "UTC");
  }
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, weekday: WEEKDAYS[get("weekday")] ?? "mon", minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function minutesOf(time: string): number | null {
  const m = /^(\d\d):(\d\d)$/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** The person's date the reminder is due for, or null: on, one of their days, past their time, outside quiet hours. */
export function reminderDay(reminders: ReminderPreferences | undefined, now: Date): string | null {
  if (!reminders?.enabled) return null;
  const at = minutesOf(reminders.time);
  if (at === null) return null;
  const clock = localClock(now, reminders.timeZone);
  if (!reminders.days.includes(clock.weekday)) return null;
  if (clock.minutes < at || clock.minutes >= QUIET_FROM || clock.minutes < QUIET_UNTIL) return null;
  return clock.day;
}

/** The Monday the summary is due for, or null: Monday from 08:00 until quiet hours, in the professional's time zone. */
export function digestDay(timeZone: string, now: Date): string | null {
  const clock = localClock(now, timeZone);
  return clock.weekday === DIGEST_DAY && clock.minutes >= DIGEST_AT && clock.minutes < QUIET_FROM ? clock.day : null;
}

type Person = { uid: string; email: string; name: string; role: string; preferences: UserPreferences | null };

export type EmailJobDeps = Pick<NotifierDeps, "db" | "appUrl" | "apiUrl" | "secret"> & { mailer: Mailer };

/** Claims the day's email for this person: false when it was already sent (or claimed by another run). */
async function claim(db: Db, userId: string, kind: "reminder" | "digest", day: string): Promise<boolean> {
  const rows = await db.insert(emailLog).values({ userId, kind, day }).onConflictDoNothing().returning({ day: emailLog.day });
  return rows.length === 1;
}

export async function sendDueEmails(deps: EmailJobDeps, now: Date = new Date()): Promise<{ reminders: number; digests: number }> {
  const { db, mailer, appUrl } = deps;
  const home = `${new URL(appUrl).origin}/cloud/`;
  const people: Person[] = (
    await db
      .select({ uid: user.id, email: user.email, name: profiles.displayName, role: user.role, preferences: profiles.preferences })
      .from(user)
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(eq(user.emailVerified, true))
  ).map((p) => ({ ...p, preferences: (p.preferences as UserPreferences | null) ?? null }));

  let reminders = 0;
  let digests = 0;
  for (const person of people) {
    const prefs = person.preferences;
    const day = emailOn(prefs, "reminders") ? reminderDay(prefs?.reminders, now) : null;
    if (day && !(await breathedOn(db, person.uid, day, prefs!.reminders!.timeZone, now)) && (await claim(db, person.uid, "reminder", day))) {
      const line = await reminderLine(db, person.uid, now);
      await mailer.send(reminderEmail(person.email, person.name, line, home, unsubscribeLink(deps, person.uid, "reminders")));
      reminders++;
    }

    if (person.role !== "coach" || !emailOn(prefs, "digest")) continue;
    const monday = digestDay(prefs?.reminders?.timeZone ?? "UTC", now);
    if (!monday) continue;
    const rows = await weekOf(db, person.uid, now);
    if (rows.length === 0 || !(await claim(db, person.uid, "digest", monday))) continue;
    await mailer.send(digestEmail(person.email, person.name, rows, home, unsubscribeLink(deps, person.uid, "digest")));
    digests++;
  }
  return { reminders, digests };
}

/** Whether the person has a session on their own date `day` (looked for in the last 36 hours, then by their clock). */
async function breathedOn(db: Db, uid: string, day: string, timeZone: string, now: Date): Promise<boolean> {
  const recent = await db
    .select({ startedAt: breathSessions.startedAt })
    .from(breathSessions)
    .where(and(eq(breathSessions.athleteId, uid), gte(breathSessions.startedAt, new Date(now.getTime() - 36 * 3_600_000))));
  return recent.some((s) => localClock(s.startedAt, timeZone).day === day);
}

/** The reminder's line: open practice from a professional first, otherwise the habit. */
async function reminderLine(db: Db, uid: string, now: Date): Promise<string> {
  const [open] = await db
    .select({ coachName: profiles.displayName, target: assignments.target })
    .from(assignments)
    .leftJoin(profiles, eq(profiles.userId, assignments.coachId))
    .where(and(eq(assignments.athleteId, uid), eq(assignments.cancelled, false), gte(assignments.dueAt, now)))
    .orderBy(assignments.dueAt)
    .limit(1);
  if (open) return `${open.coachName ?? "Your coach"} set you some practice, and today's a good day for it. A few minutes is enough.`;
  return "A few minutes of breathing today keeps your habit going.";
}

/** Each linked person's sessions in the last 7 days, by name. */
async function weekOf(db: Db, coachId: string, now: Date) {
  const links = await db
    .select({ athleteId: coachLinks.athleteId, name: profiles.displayName })
    .from(coachLinks)
    .leftJoin(profiles, eq(profiles.userId, coachLinks.athleteId))
    .where(eq(coachLinks.coachId, coachId));
  if (links.length === 0) return [];
  const counts = await db
    .select({ athleteId: breathSessions.athleteId, n: sql<number>`count(*)` })
    .from(breathSessions)
    .where(and(inArray(breathSessions.athleteId, links.map((l) => l.athleteId)), gte(breathSessions.startedAt, new Date(now.getTime() - WEEK_MS))))
    .groupBy(breathSessions.athleteId);
  const byId = new Map(counts.map((c) => [c.athleteId, Number(c.n)]));
  return links.map((l) => ({ name: l.name ?? "Someone", sessions: byId.get(l.athleteId) ?? 0 })).sort((a, b) => a.name.localeCompare(b.name));
}

export type EmailJobOptions = { intervalMs?: number; now?: () => Date; log?: (message: string, error?: unknown) => void };

/** Runs sendDueEmails() now and then every `intervalMs`, never overlapping itself. Returns `stop`. */
export function startEmailJob(deps: EmailJobDeps, options: EmailJobOptions = {}): () => void {
  const { intervalMs = EMAIL_JOB_INTERVAL_MS, now = () => new Date(), log = (m, e) => (e ? console.error(m, e) : console.log(m)) } = options;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const sent = await sendDueEmails(deps, now());
      if (sent.reminders + sent.digests > 0) log(`Email job: ${sent.reminders} reminder(s), ${sent.digests} summary(ies).`);
    } catch (error) {
      log("Email job: run failed.", error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
