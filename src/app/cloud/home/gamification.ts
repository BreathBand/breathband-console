import type { Backend } from "@/lib/backend/types";
import type { GamificationPreferences } from "@/lib/domain/types";
import { changePreferences } from "../profile-writes";

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
  return changePreferences(backend, uid, (prefs) => prefs && { ...prefs, gamification: change(prefs.gamification) });
}
