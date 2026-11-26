import type { Backend } from "@/lib/backend/types";
import type { UserPreferences } from "@/lib/domain/types";

let queue: Promise<unknown> = Promise.resolve();

/**
 * Changes the signed-in person's stored preferences: read afresh, changed,
 * written back. Home's writes (milestones shown, a program started) and
 * Settings' saves all go through here one at a time, so none of them reads a
 * profile another is about to replace. `change` gets null when nothing is
 * stored yet, and returning null writes nothing.
 */
export function changePreferences(
  backend: Backend,
  uid: string,
  change: (stored: UserPreferences | null) => UserPreferences | null,
): Promise<void> {
  const run = queue.then(async () => {
    const next = change((await backend.data.getProfile(uid))?.preferences ?? null);
    if (next) await backend.data.updateProfile(uid, { preferences: next });
  });
  queue = run.catch(() => undefined);
  return run;
}
