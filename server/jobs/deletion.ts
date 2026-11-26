// Account deletion: 24 h after someone asks (POST /api/v1/account/delete), their
// account goes for good: every row that hangs off `user` (foreign keys cascade),
// their waveform blobs, and what isn't keyed by user id (verification rows,
// their waitlist entry). Tests call deleteDueAccounts() with their own clock;
// main.ts runs it every few minutes with startDeletionJob().

import { eq, inArray, lte, or } from "drizzle-orm";
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
    .where(lte(accountDeletions.requestedAt, new Date(now.getTime() - DELETION_DELAY_MS)));
  const run: DeletionRun = { deleted: [], failed: [] };
  for (const { userId } of due) {
    try {
      await deleteAccount(deps, userId);
      run.deleted.push(userId);
    } catch (error) {
      run.failed.push({ userId, error });
    }
  }
  return run;
}

/**
 * Deletes the account now. Blobs first: deleting one is idempotent, so a run that
 * fails half way leaves the rows (and the request) for the next run to finish.
 */
export async function deleteAccount({ db, storage }: DeletionDeps, uid: string): Promise<void> {
  const [person] = await db.select({ email: user.email }).from(user).where(eq(user.id, uid));
  const blobs = await db.select({ path: breathSessions.waveformPath }).from(breathSessions).where(eq(breathSessions.athleteId, uid));
  for (const { path } of blobs) await storage.delete(path);

  const email = person?.email.toLowerCase();
  // Better Auth keys a verification row by a token and keeps the user id (reset password,
  // delete account) or the email in it; older flows key it by the email itself.
  const theirs = email
    ? or(eq(verification.value, uid), eq(verification.identifier, email), eq(verification.value, email))
    : eq(verification.value, uid);
  await db.batch([
    db.delete(verification).where(theirs),
    db.delete(accountDeletions).where(eq(accountDeletions.userId, uid)),
    // Everything else that names the user goes with the row (foreign keys cascade).
    db.delete(user).where(eq(user.id, uid)),
    ...(email ? [db.delete(waitlist).where(eq(waitlist.email, email))] : []),
  ]);
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
