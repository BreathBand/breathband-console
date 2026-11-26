// /api/v1/account: the signed-in person's own account, never anyone else's.
//
//   GET  /account/delete          whether a deletion is waiting, and when it happens
//   POST /account/delete          { password }: ask for deletion. Signs out everywhere;
//                                 the data is hidden at once (data.ts) and deleted
//                                 24 h later by server/jobs/deletion.ts
//   POST /account/delete/cancel   inside those 24 h: everything back as it was
//   GET  /account/export          "download my data" (account-export.ts)
//
// While a deletion waits, these are the only data routes the person can use.

import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { account, accountDeletions, session } from "../db/schema";
import { deleteAfter } from "../jobs/deletion";
import { exportAccount } from "./account-export";
import { fail, jsonObject, type DataApp, type DataDeps } from "./data";

/** Better Auth's id for email-and-password accounts. */
const CREDENTIAL_PROVIDER = "credential";

type DeletionStatus = { requestedAt: string; deleteAfter: string } | null;

async function deletionStatus(db: Db, uid: string): Promise<DeletionStatus> {
  const [row] = await db.select({ requestedAt: accountDeletions.requestedAt }).from(accountDeletions).where(eq(accountDeletions.userId, uid));
  return row ? { requestedAt: row.requestedAt.toISOString(), deleteAfter: deleteAfter(row.requestedAt).toISOString() } : null;
}

export function accountRoutes(routes: DataApp, { db, auth, storage }: DataDeps) {
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

    // Asking twice keeps the first request's clock.
    await db.insert(accountDeletions).values({ userId: uid, requestedAt: new Date() }).onConflictDoNothing();

    // Clear this browser's cookies the way sign-out does, then end every other session too.
    const { headers } = await auth.api.signOut({ headers: c.req.raw.headers, returnHeaders: true });
    for (const cookie of headers.getSetCookie()) c.header("Set-Cookie", cookie, { append: true });
    await db.delete(session).where(eq(session.userId, uid));

    return c.json({ deletion: await deletionStatus(db, uid) });
  });

  routes.post("/account/delete/cancel", async (c) => {
    const uid = c.get("uid");
    const status = await deletionStatus(db, uid);
    if (!status) fail("not-found", "No deletion is waiting.");
    if (Date.now() >= new Date(status.deleteAfter).getTime()) {
      fail("permission-denied", "The 24 hours are up: the account is being deleted.");
    }
    await db.delete(accountDeletions).where(eq(accountDeletions.userId, uid));
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
}
