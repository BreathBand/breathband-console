import type { UserPreferences } from "@/lib/domain/types";

/**
 * A Settings change laid over the stored preferences: only the fields the
 * change touched (`before` → `after`) replace the stored ones, so what other
 * screens wrote since Settings loaded (a program started, milestones shown)
 * is kept.
 */
export function withChanges(stored: UserPreferences, before: UserPreferences, after: UserPreferences): UserPreferences {
  const changed = Object.fromEntries(Object.entries(after).filter(([key, value]) => value !== before[key as keyof UserPreferences]));
  return { ...stored, ...changed };
}
