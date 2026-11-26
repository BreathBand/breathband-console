// Account deletion: 24 h after someone asks (POST /api/v1/account/delete), their
// account goes for good: every row that hangs off `user` (foreign keys cascade),
// their waveform blobs, and what isn't keyed by user id (verification rows,
// their waitlist entry). Tests call deleteDueAccounts() with their own clock;
// main.ts runs it every few minutes with startDeletionJob().

import { and, eq, exists, inArray, lte, notExists, or } from "drizzle-orm";
import type { Db } from "../db/client";
import { accountDeletions, breathSessions, user, verification, waitlist } from "../db/schema";
import type { StorageService } from "../storage";

/** How long a person has to change their mind. */
export const DELETION_DELAY_MS = 24 * 60 * 60 * 1000;

/** How often main.ts looks for accounts whose 24 h are up. */
const DELETION_JOB_INTERVAL_MS = 10 * 60 * 1000;

export type DeletionDeps = { db: Db; storage: StorageService };

/** When the account may be deleted: 24 h after it was asked for. */
export function deleteAfter(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + DELETION_DELAY_MS);
}

/** The people among `uids` whose accounts are waiting to be deleted. */
export async function pendingDeletions(db: Db, uids: readonly string[]): Promise<Set<string>> {
  if (uids.length === 0) return new Set();
  const rows = await db
    .select({ userId: accountDeletions.userId })
    .from(accountDeletions)
    .where(inArray(accountDeletions.userId, [...new Set(uids)]));
  return new Set(rows.map((r) => r.userId));
}

export type DeletionRun = { deleted: string[]; failed: { userId: string; error: unknown }[] };

/** Deletes every account asked for at least 24 h before `now`. One failure doesn't stop the others. */
export async function deleteDueAccounts(deps: DeletionDeps, now: Date = new Date()): Promise<DeletionRun> {
  const due = await deps.db
    .select({ userId: accountDeletions.userId })
    .from(accountDeletions)
    .where(lte(accountDeletions.requestedAt, dueBefore(now)));
  const run: DeletionRun = { deleted: [], failed: [] };
  for (const { userId } of due) {
    try {
      if (await deleteAccount(deps, userId, now)) run.deleted.push(userId);
    } catch (error) {
      run.failed.push({ userId, error });
    }
  }
  return run;
}

/** Requests made at or before this are due at `now`. */
function dueBefore(now: Date): Date {
  return new Date(now.getTime() - DELETION_DELAY_MS);
}

/**
 * A claimed request's `requested_at`: due for every clock, so no cancel (routes/account.ts
 * deletes only a request newer than 24 h) can remove it once the job has started on it,
 * and a run that fails half way is claimed again and finished by the next.
 */
const CLAIMED = new Date(0);

/**
 * Deletes the account if its request is still due at `now`; false if it was cancelled
 * meanwhile. The request is claimed before anything is deleted. Blobs next: deleting one
 * is idempotent, so a run that fails there leaves the claimed request for the next run.
 * Then one batch, which deletes nothing unless the claimed request is still there.
 */
export async function deleteAccount({ db, storage }: DeletionDeps, uid: string, now: Date = new Date()): Promise<boolean> {
  const claimed = await db
    .update(accountDeletions)
    .set({ requestedAt: CLAIMED })
    .where(and(eq(accountDeletions.userId, uid), lte(accountDeletions.requestedAt, dueBefore(now))))
    .returning({ userId: accountDeletions.userId });
  if (claimed.length !== 1) return false;

  const [person] = await db.select({ email: user.email }).from(user).where(eq(user.id, uid));
  const blobs = await db.select({ path: breathSessions.waveformPath }).from(breathSessions).where(eq(breathSessions.athleteId, uid));
  for (const { path } of blobs) await storage.delete(path);

  const email = person?.email.toLowerCase();
  // Better Auth keys a verification row by a token and keeps the user id (reset password,
  // delete account) or the email in it; older flows key it by the email itself.
  const theirs = email
    ? or(eq(verification.value, uid), eq(verification.identifier, email), eq(verification.value, email))
    : eq(verification.value, uid);
  const stillClaimed = exists(
    db.select({ userId: accountDeletions.userId }).from(accountDeletions).where(and(eq(accountDeletions.userId, uid), eq(accountDeletions.requestedAt, CLAIMED))),
  );
  const userGone = notExists(db.select({ id: user.id }).from(user).where(eq(user.id, uid)));
  await db.batch([
    // Everything that names the user goes with the row (foreign keys cascade), the request included.
    db.delete(user).where(and(eq(user.id, uid), stillClaimed)),
    db.delete(verification).where(and(theirs, userGone)),
    ...(email ? [db.delete(waitlist).where(and(eq(waitlist.email, email), userGone))] : []),
  ]);
  return true;
}

export type DeletionJobOptions = {
  intervalMs?: number;
  now?: () => Date;
  log?: (message: string, error?: unknown) => void;
};

/**
 * Runs deleteDueAccounts() now and then every `intervalMs` (no cron library: a plain
 * timer that never overlaps itself and doesn't keep the process alive). Returns `stop`.
 */
export function startDeletionJob(deps: DeletionDeps, options: DeletionJobOptions = {}): () => void {
  const { intervalMs = DELETION_JOB_INTERVAL_MS, now = () => new Date(), log = logToConsole } = options;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const run = await deleteDueAccounts(deps, now());
      if (run.deleted.length > 0) log(`Deletion job: deleted ${run.deleted.length} account(s).`);
      for (const { userId, error } of run.failed) log(`Deletion job: account ${userId} failed; retrying next run.`, error);
    } catch (error) {
      log("Deletion job: run failed.", error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}

function logToConsole(message: string, error?: unknown): void {
  if (error === undefined) console.log(message);
  else console.error(message, error);
}
