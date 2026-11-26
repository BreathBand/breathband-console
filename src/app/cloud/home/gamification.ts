import type { Backend } from "@/lib/backend/types";
import type { GamificationPreferences } from "@/lib/domain/types";

/**
 * Changes the stored `preferences.gamification`, read afresh first: the
 * profile from sign-in can be older than what Home has written since (a
 * milestone shown, a program started), and writing over it would undo that.
 */
export async function changeGamification(
  backend: Backend,
  uid: string,
  change: (g: GamificationPreferences | undefined) => GamificationPreferences,
): Promise<void> {
  const prefs = (await backend.data.getProfile(uid))?.preferences;
  if (!prefs) return;
  await backend.data.updateProfile(uid, { preferences: { ...prefs, gamification: change(prefs.gamification) } });
}
