// The scheduled emails (reminders, Monday summaries), the event emails in
// server/notify.ts, and one-click unsubscribe.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defaultPreferences } from "@/lib/domain/preferences";
import type { ReminderPreferences, UserPreferences, Weekday } from "@/lib/domain/types";
import { authSecret, createAuth } from "../auth";
import { createDb, type Db } from "../db/client";
import { MIGRATIONS_DIR } from "../db/env";
import { assertLocalDatabaseUrl } from "../db/guard";
import { breathSessions, coachLinks, emailLog, profiles, user } from "../db/schema";
import type { ProfilePreferences } from "../db/schema/people";
import { createApp } from "../index";
import type { Email, Mailer } from "../mailer";
import { createNotifier, unsubscribeLink, validUnsubscribe } from "../notify";
import { createFsStorage } from "../storage";
import { digestDay, localClock, reminderDay, sendDueEmails } from "./email";

const APP = "http://localhost:3000";
const API = "http://localhost:8787";
const SECRET = authSecret("test", undefined);
const ALL_DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
/** A Monday, 10:00 UTC. */
const MONDAY_10 = new Date("2026-11-30T10:00:00.000Z");

const reminders = (over: Partial<ReminderPreferences> = {}): ReminderPreferences => ({ enabled: true, time: "09:00", days: ALL_DAYS, timeZone: "UTC", ...over });

describe("when a reminder or summary is due", () => {
  it("reads the clock in the person's time zone", () => {
    expect(localClock(MONDAY_10, "UTC")).toEqual({ day: "2026-11-30", weekday: "mon", minutes: 600 });
    expect(localClock(MONDAY_10, "Asia/Tokyo")).toEqual({ day: "2026-11-30", weekday: "mon", minutes: 19 * 60 });
    expect(localClock(MONDAY_10, "America/Los_Angeles")).toMatchObject({ day: "2026-11-30", minutes: 2 * 60 });
    expect(localClock(MONDAY_10, "Not/AZone")).toMatchObject({ minutes: 600 });
  });

  it("is due from the person's time on their days, until quiet hours", () => {
    expect(reminderDay(reminders(), MONDAY_10)).toBe("2026-11-30");
    expect(reminderDay(reminders({ time: "10:30" }), MONDAY_10)).toBeNull();
    expect(reminderDay(reminders({ days: ["tue"] }), MONDAY_10)).toBeNull();
    expect(reminderDay(reminders({ enabled: false }), MONDAY_10)).toBeNull();
    expect(reminderDay(reminders(), new Date("2026-11-30T21:30:00.000Z"))).toBeNull();
    expect(reminderDay(reminders({ time: "06:00" }), new Date("2026-11-30T07:00:00.000Z"))).toBeNull();
    expect(reminderDay(undefined, MONDAY_10)).toBeNull();
  });

  it("sends the summary on Monday from 08:00 in the professional's time zone", () => {
    expect(digestDay("UTC", MONDAY_10)).toBe("2026-11-30");
    expect(digestDay("UTC", new Date("2026-11-30T07:00:00.000Z"))).toBeNull();
    expect(digestDay("UTC", new Date("2026-12-01T10:00:00.000Z"))).toBeNull();
  });
});

const dir = mkdtempSync(join(tmpdir(), "breathband-email-"));
const url = `file:${join(dir, "data.db").replaceAll("\\", "/")}`;
let handle: ReturnType<typeof createDb>;
let db: Db;
const outbox: Email[] = [];
const mailer: Mailer = {
  async send(email) {
    outbox.push(email);
  },
};
const deps = () => ({ db, mailer, appUrl: APP, apiUrl: API, secret: SECRET });

beforeAll(async () => {
  assertLocalDatabaseUrl(url, "the email job test's database");
  handle = createDb(url);
  db = handle.db;
  await migrate(db, { migrationsFolder: resolve(MIGRATIONS_DIR) });
});

afterAll(() => {
  handle?.client.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // On Windows libSQL keeps the file open until the process exits; the OS temp folder gets it.
  }
});

beforeEach(async () => {
  outbox.length = 0;
  await db.delete(user);
});

let n = 0;
async function person(name: string, preferences: Partial<UserPreferences> | null, role: "athlete" | "coach" = "athlete") {
  const id = `u${++n}`;
  await db.insert(user).values({ id, name, email: `${id}@example.test`, emailVerified: true, role });
  const stored = preferences ? ({ ...defaultPreferences(), ...preferences } as ProfilePreferences) : null;
  await db.insert(profiles).values({ userId: id, displayName: name, preferences: stored });
  return { id, email: `${id}@example.test` };
}

describe("sendDueEmails", () => {
  it("reminds once a day, and not someone who already breathed today or turned reminders off", async () => {
    const maya = await person("Maya", { reminders: reminders() });
    const sam = await person("Sam", { reminders: reminders() });
    await person("Lee", { reminders: reminders(), emails: { practice: true, reminders: false, digest: true } });
    await db.insert(breathSessions).values({
      id: "s1",
      athleteId: sam.id,
      startedAt: new Date("2026-11-30T08:00:00.000Z"),
      durationSec: 180,
      mode: "open",
      scoringVersion: "transition-v1",
      appVersion: "web",
      source: "web",
      waveformPath: "x",
    } as typeof breathSessions.$inferInsert);

    expect(await sendDueEmails(deps(), MONDAY_10)).toEqual({ reminders: 1, digests: 0 });
    expect(outbox.map((e) => e.to)).toEqual([maya.email]);
    expect(outbox[0].text).toContain("A few minutes of breathing today");
    expect(outbox[0].headers?.["List-Unsubscribe"]).toContain("/api/v1/unsubscribe?");

    expect(await sendDueEmails(deps(), new Date(MONDAY_10.getTime() + 3_600_000))).toEqual({ reminders: 0, digests: 0 });
  });

  it("sends a professional their Monday summary of the people they work with, once", async () => {
    const lena = await person("Lena", { reminders: { ...reminders(), enabled: false } }, "coach");
    const alex = await person("Alex", null);
    await db.insert(coachLinks).values({ coachId: lena.id, athleteId: alex.id, scope: "scores" });

    expect(await sendDueEmails(deps(), MONDAY_10)).toEqual({ reminders: 0, digests: 1 });
    expect(outbox[0]).toMatchObject({ to: lena.email, subject: "Your week on Breathband" });
    expect(outbox[0].text).toContain("Alex: no sessions");
    expect(await sendDueEmails(deps(), MONDAY_10)).toEqual({ reminders: 0, digests: 0 });
    expect(await db.select().from(emailLog).where(eq(emailLog.userId, lena.id))).toHaveLength(1);
  });
});

describe("the event emails", () => {
  it("invites by email only, and tells the person about practice unless they turned it off", async () => {
    const notify = createNotifier(deps());
    const ana = await person("Ana", null, "coach");
    const jordan = await person("Jordan", null);
    const tom = await person("Tom", { emails: { practice: false, reminders: true, digest: true } });

    await notify.coachInvite({ contact: "+353 1 234 5678", athleteName: "Phone", coachName: "Ana", code: "ABCD2345" });
    await notify.coachInvite({ contact: "new@example.test", athleteName: "New", coachName: "Ana", code: "ABCD2345" });
    expect(outbox.map((e) => e.to)).toEqual(["new@example.test"]);
    expect(outbox[0].text).toContain(`${APP}/cloud/join/?code=ABCD2345`);

    await notify.practiceSet(ana.id, jordan.id, { mode: "paced", durationSec: 300, target: 3 });
    await notify.practiceSet(ana.id, tom.id, { mode: "paced", durationSec: 300, target: 3 });
    expect(outbox.slice(1).map((e) => [e.to, e.subject])).toEqual([[jordan.email, "New practice from Ana"]]);
    expect(outbox[1].text).toContain("3 paced sessions of 5 min");
  });
});

describe("unsubscribe", () => {
  it("turns off only that kind for that person, from a signed link", async () => {
    const maya = await person("Maya", { reminders: reminders() });
    const link = unsubscribeLink({ apiUrl: API, secret: SECRET }, maya.id, "reminders");
    expect(validUnsubscribe(SECRET, maya.id, "reminders", new URL(link.url).searchParams.get("s")!)).toBe(true);
    expect(validUnsubscribe(SECRET, "someone-else", "reminders", new URL(link.url).searchParams.get("s")!)).toBe(false);

    const app = createApp({
      db,
      mode: "test",
      appUrl: APP,
      auth: createAuth({ db, mode: "test", secret: SECRET, baseUrl: API, appUrl: APP, mailer }),
      storage: createFsStorage(join(dir, "blobs")),
    });
    const forged = new URL(link.url);
    forged.searchParams.set("k", "digest");
    expect((await app.request(forged.toString())).status).toBe(400);

    const response = await app.request(link.url);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("You won't get reminder emails any more.");
    const [row] = await db.select({ preferences: profiles.preferences }).from(profiles).where(eq(profiles.userId, maya.id));
    expect(row.preferences?.emails).toEqual({ practice: true, reminders: false, digest: true });
    expect(row.preferences?.reminders).toEqual(reminders());
  });
});
