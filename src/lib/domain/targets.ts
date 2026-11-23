import { DEFAULT_TARGETS, type AthleteTargets, type CoachLink } from "./types";

export function targetsFor(link: Pick<CoachLink, "targets"> | null | undefined): AthleteTargets {
  return link?.targets ?? DEFAULT_TARGETS;
}
