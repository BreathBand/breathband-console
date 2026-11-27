// /api/v1/account: the signed-in person's own account, never anyone else's.
//
//   GET  /account/delete          whether a deletion is waiting, and when it happens
//   POST /account/delete          { password }: ask for deletion. Signs out everywhere;
//                                 the data is hidden at once (data.ts) and deleted
//                                 24 h later by server/jobs/deletion.ts
//   POST /account/delete/cancel   inside those 24 h: everything back as it was
//   GET  /account/export          "download my data" (account-export.ts)
//   GET  /account/access-log      who else opened the person's sessions, newest first
//
// While a deletion waits, these are the only data routes the person can use.

import { and, desc, eq, gt, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { accessLog, account, accountDeletions, profiles, session } from "../db/schema";
import { DELETION_DELAY_MS, deleteAfter } from "../jobs/deletion";
import { exportAccount } from "./account-export";
import { fail, jsonObject, type DataApp, type DataDeps } from "./data";

/** The newest entries the access log answers with. */
const ACCESS_LOG_LIMIT = 200;

/** Better Auth's id for email-and-password accounts. */
const CREDENTIAL_PROVIDER = "credential";

type DeletionStatus = { requestedAt: string; deleteAfter: string } | null;

async function deletionStatus(db: Db, uid: string): Promise<DeletionStatus> {
  const [row] = await db.select({ requestedAt: accountDeletions.requestedAt }).from(accountDeletions).where(eq(accountDeletions.userId, uid));
  return row ? { requestedAt: row.requestedAt.toISOString(), deleteAfter: deleteAfter(row.requestedAt).toISOString() } : null;
}

export function accountRoutes(routes: DataApp, { db, auth, storage, notify }: DataDeps) {
  routes.get("/account/delete", async (c) => c.json({ deletion: await deletionStatus(db, c.get("uid")) }));

  routes.post("/account/delete", async (c) => {
    const uid = c.get("uid");
    const { password } = await jsonObject(c.req.raw);
    if (typeof password !== "string" || password.length === 0) fail("invalid-input", "password: the account's password");
    const [credential] = await db
      .select({ hash: account.password })
      .from(account)
      .where(and(eq(account.userId, uid), eq(account.providerId, CREDENTIAL_PROVIDER)));
    const context = await auth.$context;
    if (!credential?.hash || !(await context.password.verify({ hash: credential.hash, password }))) {
      fail("invalid-credentials", "That password isn't right.");
    }

    // Asking twice keeps the first request's clock, and emails once.
    const asked = await db.insert(accountDeletions).values({ userId: uid, requestedAt: new Date() }).onConflictDoNothing().returning();
    if (asked[0]) await notify.deletionRequested(uid, deleteAfter(asked[0].requestedAt));

    // Clear this browser's cookies the way sign-out does, then end every other session too.
    const { headers } = await auth.api.signOut({ headers: c.req.raw.headers, returnHeaders: true });
    for (const cookie of headers.getSetCookie()) c.header("Set-Cookie", cookie, { append: true });
    await db.delete(session).where(eq(session.userId, uid));

    return c.json({ deletion: await deletionStatus(db, uid) });
  });

  routes.post("/account/delete/cancel", async (c) => {
    const uid = c.get("uid");
    // One conditional delete: a request the job has claimed (or whose 24 h are up) stays.
    const cancelled = await db
      .delete(accountDeletions)
      .where(and(eq(accountDeletions.userId, uid), gt(accountDeletions.requestedAt, new Date(Date.now() - DELETION_DELAY_MS))))
      .returning({ userId: accountDeletions.userId });
    if (cancelled.length === 0) {
      if (await deletionStatus(db, uid)) fail("permission-denied", "The 24 hours are up: the account is being deleted.");
      fail("not-found", "No deletion is waiting.");
    }
    return c.json({ deletion: null });
  });

  routes.get("/account/export", async (c) => {
    const uid = c.get("uid");
    const data = await exportAccount(db, storage, uid);
    if (!data) fail("not-found");
    const day = data.exportedAt.slice(0, 10);
    return c.json(data, 200, {
      "Content-Disposition": `attachment; filename="breathband-data-${day}.json"`,
      "Cache-Control": "no-store",
    });
  });

  routes.get("/account/access-log", async (c) => {
    const rows = await db
      .select({ viewerId: accessLog.viewerId, viewerName: profiles.displayName, sessionId: accessLog.sessionId, at: accessLog.createdAt })
      .from(accessLog)
      .leftJoin(profiles, eq(profiles.userId, accessLog.viewerId))
      .where(eq(accessLog.athleteId, c.get("uid")))
      .orderBy(desc(accessLog.createdAt), desc(sql`${accessLog}.rowid`))
      .limit(ACCESS_LOG_LIMIT);
    return c.json(rows.map((r) => ({ ...r, viewerName: r.viewerName ?? "Someone", at: r.at.toISOString() })));
  });
}
