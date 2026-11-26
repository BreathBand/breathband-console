import type { Backend } from "@/lib/backend/types";
import type { GamificationPreferences } from "@/lib/domain/types";

/** Home's gamification writes, one at a time, so a milestone shown and a program started can't overwrite each other. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Changes the stored `preferences.gamification`, read afresh first: the
 * profile from sign-in can be older than what Home has written since (a
 * milestone shown, a program started), and writing over it would undo that.
 */
export function changeGamification(
  backend: Backend,
  uid: string,
  change: (g: GamificationPreferences | undefined) => GamificationPreferences,
): Promise<void> {
  const run = queue.then(async () => {
    const prefs = (await backend.data.getProfile(uid))?.preferences;
    if (!prefs) return;
    await backend.data.updateProfile(uid, { preferences: { ...prefs, gamification: change(prefs.gamification) } });
  });
  queue = run.catch(() => undefined);
  return run;
}
