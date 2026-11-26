// What a professional agrees to at the end of onboarding (planning/v1/02 §4.1
// step 6): the professional terms, plus a clinician's wellness acknowledgement
// or an educator's 16+ acknowledgement. Each is kept as a consent record (kind,
// version, time), after sign-up's, the same way sign-up keeps its own.
//
// DRAFT, for counsel: the wording below is a draft. When counsel reviews it,
// change the copy and give the kinds a new version in lib/domain/consent.ts.

import { CONSENT_VERSIONS, PRO_CONSENT_KINDS } from "./consent";
import type { ConsentRecord, ProConsentKind, ProKind } from "./types";

/** Shown next to the terms: they are not the reviewed wording yet. */
export const PRO_TERMS_DRAFT_NOTE = "Draft for counsel's review. The final wording may change, and you'll be asked again if it does.";

/** The professional terms in brief (draft). */
export const PROFESSIONAL_TERMS_POINTS: readonly string[] = [
  "You see only what each person chooses to share with you, and they can change it or stop sharing at any time.",
  "You invite people with their knowledge. You don't make accounts for them or record them without their agreement.",
  "You keep what you see confidential and use it only to support their practice.",
  "Breathband's scores are for practice and wellbeing, not for medical decisions.",
];

/** The spec's wording (§4.1 step 6, clinicians). */
export const WELLNESS_ACKNOWLEDGEMENT =
  "Breathband is a wellness tool. It doesn't diagnose, treat or monitor any condition. Don't record diagnoses, medical history or treatment in BreathCloud.";

/** The spec's wording (§4.1 step 6, educators). */
export const STUDENT_AGE_ACKNOWLEDGEMENT = "Only invite students aged 16 or over.";

/** The standing hint on a professional's private notes (§4.3, D-G). */
export const PRIVATE_NOTES_HINT = "For practice notes only. Don't record diagnoses or medical history here.";

/** One checkbox on the terms step. */
export interface ProTermsBox {
  kind: ProConsentKind;
  label: string;
}

const BOXES: Record<ProConsentKind, ProTermsBox> = {
  "professional-terms": { kind: "professional-terms", label: "I agree to the professional terms." },
  "wellness-acknowledgement": { kind: "wellness-acknowledgement", label: WELLNESS_ACKNOWLEDGEMENT },
  "student-age-acknowledgement": { kind: "student-age-acknowledgement", label: STUDENT_AGE_ACKNOWLEDGEMENT },
};

const REQUIRED: Record<ProKind, ProConsentKind[]> = {
  coach: ["professional-terms"],
  clinician: ["professional-terms", "wellness-acknowledgement"],
  educator: ["professional-terms", "student-age-acknowledgement"],
};

/** The kinds a professional of this kind must agree to, in the order the step shows them. */
export function requiredProConsents(kind: ProKind): ProConsentKind[] {
  return [...REQUIRED[kind]];
}

/** The terms step's checkboxes for a kind; every one is required. */
export function proTermsBoxes(kind: ProKind): ProTermsBox[] {
  return REQUIRED[kind].map((k) => BOXES[k]);
}

/** What onboarding sends once every box is ticked: each required kind at its current version. */
export function proConsents(kind: ProKind): Pick<ConsentRecord, "kind" | "version">[] {
  return REQUIRED[kind].map((k) => ({ kind: k, version: CONSENT_VERSIONS[k] }));
}

const aKind = (kind: ProKind) => `${kind === "educator" ? "an" : "a"} ${kind}`;

/**
 * Why these professional consents can't be recorded for this kind, or null:
 * every required kind at its current version, nothing else, no repeats.
 */
export function proTermsProblem(kind: ProKind, given: readonly Pick<ConsentRecord, "kind" | "version">[]): string | null {
  if (!Array.isArray(given)) return "proConsents: a list";
  const required = REQUIRED[kind];
  const seen = new Set<string>();
  for (const c of given) {
    if (!PRO_CONSENT_KINDS.includes(c?.kind as ProConsentKind)) return `proConsents: unknown "${String(c?.kind)}"`;
    if (!required.includes(c.kind as ProConsentKind)) return `proConsents: ${c.kind} is not for ${aKind(kind)}`;
    if (seen.has(c.kind)) return `proConsents: ${c.kind} twice`;
    seen.add(c.kind);
    if (c.version !== CONSENT_VERSIONS[c.kind as ProConsentKind]) return `proConsents: ${c.kind} version "${String(c.version)}" is not current`;
  }
  for (const k of required) if (!seen.has(k)) return `proConsents: ${k} is required`;
  return null;
}

/** Whether these records already hold every kind this professional needs, at its current version. */
export function hasProTerms(kind: ProKind, records: readonly Pick<ConsentRecord, "kind" | "version">[] | undefined): boolean {
  return REQUIRED[kind].every((k) => records?.some((r) => r.kind === k && r.version === CONSENT_VERSIONS[k]));
}
