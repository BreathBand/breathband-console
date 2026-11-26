import { DEFAULT_TARGETS, type AthleteTargets, type CoachLink, type UserPreferences } from "./types";

/**
 * The targets an athlete works to: their coach's where the coach has set
 * them, otherwise the defaults with the athlete's own weekly goal.
 */
export function targetsFor(
  link: Pick<CoachLink, "targets"> | null | undefined,
  preferences?: Pick<UserPreferences, "sessionsPerWeek"> | null,
): AthleteTargets {
  if (link?.targets) return link.targets;
  return preferences ? { ...DEFAULT_TARGETS, sessionsPerWeek: preferences.sessionsPerWeek } : DEFAULT_TARGETS;
}
