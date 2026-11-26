import type { BandRoute, OnboardingChoices } from "./types";

/** The band step's routes, in the order the spec lists them (planning/v1/02 §3.1, step 9). */
export const BAND_ROUTES: readonly BandRoute[] = ["bluetooth", "app", "none", "simulated"];

/** Why an onboarding record can't be stored, or null when it's fine (or absent). */
export function onboardingProblem(choices: OnboardingChoices | undefined): string | null {
  if (choices === undefined) return null;
  if (typeof choices !== "object" || choices === null) return "onboarding: an object";
  if (!BAND_ROUTES.includes(choices.bandRoute)) return `onboarding.bandRoute: one of ${BAND_ROUTES.join(", ")}`;
  if (typeof choices.sampleData !== "boolean") return "onboarding.sampleData: true or false";
  if (choices.sampleData && choices.bandRoute !== "none") return 'onboarding.sampleData: only with bandRoute "none"';
  return null;
}
