// One-click unsubscribe (L3) from an optional email's link: no sign-in, a link
// signed for one person and one kind (server/notify.ts). GET answers a small
// page for a person who clicked it; POST is RFC 8058's one-click from the mail
// client. Both turn that kind off in `preferences.emails`, and nothing else.

import { eq } from "drizzle-orm";
import { EMAIL_KINDS, type EmailKind } from "@/lib/domain/preferences";
import type { EmailPreferences } from "@/lib/domain/types";
import { profiles } from "../db/schema";
import type { ProfilePreferences } from "../db/schema/people";
import { validUnsubscribe } from "../notify";
import { fail, type DataApp, type DataDeps } from "./data";

const ALL_ON: EmailPreferences = { practice: true, reminders: true, digest: true };

const WORDS: Record<EmailKind, string> = { practice: "practice", reminders: "reminder", digest: "weekly summary" };

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font-family: system-ui, sans-serif; line-height: 1.5; max-width: 32rem; margin: 3rem auto; padding: 0 1rem"><h1 style="font-size: 1.4rem">${title}</h1><p>${body}</p></body></html>`;
}

export function unsubscribeRoutes(routes: DataApp, { db, auth }: DataDeps) {
  const turnOff = async (query: (name: string) => string | undefined): Promise<EmailKind> => {
    const uid = query("u") ?? "";
    const kind = EMAIL_KINDS.find((k) => k === query("k"));
    if (!uid || !kind || !validUnsubscribe(auth.options.secret, uid, kind, query("s") ?? "")) fail("invalid-input", "That unsubscribe link isn't valid.");
    const [row] = await db.select({ preferences: profiles.preferences }).from(profiles).where(eq(profiles.userId, uid));
    if (!row) fail("not-found");
    // Old profiles have no preferences yet: then only the switch is stored, and the rest stays absent.
    const preferences = (row.preferences ?? {}) as ProfilePreferences & { emails?: EmailPreferences };
    const emails = { ...ALL_ON, ...preferences.emails, [kind]: false };
    await db.update(profiles).set({ preferences: { ...preferences, emails }, updatedAt: new Date() }).where(eq(profiles.userId, uid));
    return kind;
  };

  routes.get("/unsubscribe", async (c) => {
    const kind = await turnOff((name) => c.req.query(name));
    return c.html(page("You're unsubscribed", `You won't get ${WORDS[kind]} emails any more. Turn them back on in BreathCloud's Settings, under Your data.`));
  });

  routes.post("/unsubscribe", async (c) => {
    await turnOff((name) => c.req.query(name));
    return c.json({ ok: true });
  });
}
