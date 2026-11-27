import type { ConsentKind, ConsentRecord, ProConsentKind, SignUpConsentKind } from "./types";

// DRAFT, for counsel: these versions name draft documents. When the reviewed
// terms, privacy notice and processing wording land, give each a new version;
// sign-up (or professional onboarding) then records the new one.
export const CONSENT_VERSIONS: Record<ConsentKind, string> = {
  terms: "draft-2026-11-26",
  privacy: "draft-2026-11-26",
  "breathing-data": "draft-2026-11-26",
  "professional-terms": "draft-2026-11-26",
  "wellness-acknowledgement": "draft-2026-11-26",
  "student-age-acknowledgement": "draft-2026-11-26",
};

/** What sign-up records, in this order (firebase/firestore.rules checks it). */
export const CONSENT_KINDS: SignUpConsentKind[] = ["terms", "privacy", "breathing-data"];

/** What professional onboarding can record, after sign-up's (see lib/domain/pro-terms). */
export const PRO_CONSENT_KINDS: ProConsentKind[] = ["professional-terms", "wellness-acknowledgement", "student-age-acknowledgement"];

/** What sign-up sends: the current version of every kind the person ticked. */
export function currentConsents(kinds: readonly ConsentKind[] = CONSENT_KINDS): Pick<ConsentRecord, "kind" | "version">[] {
  return kinds.map((kind) => ({ kind, version: CONSENT_VERSIONS[kind] }));
}

/** Why these consents can't open an account, or null when every sign-up kind is there at its current version. */
export function consentsProblem(consents: readonly Pick<ConsentRecord, "kind" | "version">[]): string | null {
  for (const kind of CONSENT_KINDS) {
    const given = consents.find((c) => c?.kind === kind);
    if (!given) return `consents: ${kind} is required`;
    if (given.version !== CONSENT_VERSIONS[kind]) return `consents: ${kind} version "${given.version}" is not current`;
  }
  return null;
}

export const MIN_AGE = 16;
export const UNDER_AGE_MESSAGE = "Breathband is for people 16 and over for now.";
const OLDEST_AGE = 120;

/**
 * With only a year of birth, someone counts as 16 from 1 January of the year
 * they turn 16. `null` when old enough; otherwise why not.
 */
export function ageGateProblem(birthYear: number, now: Date): { code: "invalid" | "under-age"; message: string } | null {
  const year = now.getUTCFullYear();
  if (!Number.isInteger(birthYear) || birthYear > year || birthYear < year - OLDEST_AGE) {
    return { code: "invalid", message: "Enter the year you were born, like 1990." };
  }
  if (year - birthYear < MIN_AGE) return { code: "under-age", message: UNDER_AGE_MESSAGE };
  return null;
}
