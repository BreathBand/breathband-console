// The professional track's first onboarding steps: what kind of work, the
// practice, what they'll use Breathband for and how they refer to people.
// The options as people see them, each kind's starting answers, and the checks
// the adapter runs before storing them. Spec: planning/v1/02-onboarding-and-tailoring.md
// §4.1 steps 2–5 and §7 (`proKind`, `proProfile`).

import { MAX_SPORT_OTHER, TRAIN_SPORTS } from "./goal-questions";
import { proDefaultsProblem, scopeText, targetsText } from "./pro-defaults";
import { DEFAULT_TERMS, isPeopleTerm, PEOPLE_TERMS } from "./terminology";
import type {
  ClinicianProfession,
  ClinicianUseCase,
  CoachLevel,
  CoachUseCase,
  EducatorRole,
  EducatorUseCase,
  ProKind,
  ProProfile,
  ProUseCase,
} from "./types";

type Option<T extends string> = { id: T; label: string };

export const PRO_KINDS: (Option<ProKind> & { detail: string })[] = [
  { id: "coach", label: "Coach or trainer", detail: "Athletes and teams, from youth (16+) to pro." },
  { id: "clinician", label: "Clinician or therapist", detail: "Clients you see in a clinic or practice." },
  { id: "educator", label: "Teacher or counsellor", detail: "Students at a school or college." },
];

export const COACH_SPORTS = TRAIN_SPORTS;

export const COACH_LEVELS: Option<CoachLevel>[] = [
  { id: "youth", label: "Youth (16+)" },
  { id: "amateur", label: "Amateur" },
  { id: "collegiate", label: "Collegiate" },
  { id: "pro", label: "Pro" },
];

export const CLINICIAN_PROFESSIONS: Option<ClinicianProfession>[] = [
  { id: "physiotherapist", label: "Physiotherapist" },
  { id: "respiratory-therapist", label: "Respiratory therapist" },
  { id: "physician", label: "Physician" },
  { id: "psychologist", label: "Psychologist or therapist" },
  { id: "nurse", label: "Nurse" },
  { id: "other", label: "Other" },
];

export const EDUCATOR_ROLES: Option<EducatorRole>[] = [
  { id: "teacher", label: "Teacher" },
  { id: "counsellor", label: "Counsellor" },
  { id: "coach", label: "Coach" },
];

const COACH_USES: Option<CoachUseCase>[] = [
  { id: "pre-competition", label: "Pre-competition calm" },
  { id: "recovery", label: "Recovery" },
  { id: "control-under-effort", label: "Breath control under effort" },
  { id: "team-warm-ups", label: "Team warm-ups" },
];
const CLINICIAN_USES: Option<ClinicianUseCase>[] = [
  { id: "between-visits", label: "Breathing pattern practice between visits" },
  { id: "stress-anxiety", label: "Stress and anxiety skills" },
  { id: "injury-recovery", label: "Recovery after injury or surgery" },
  { id: "sports-medicine", label: "Performance (sports medicine)" },
];
const EDUCATOR_USES: Option<EducatorUseCase>[] = [
  { id: "exam-stress", label: "Exam stress" },
  { id: "study-focus", label: "Focus before study" },
  { id: "class-calm", label: "Class calm" },
];

export const USE_CASES: Record<ProKind, Option<ProUseCase>[]> = {
  coach: COACH_USES,
  clinician: CLINICIAN_USES,
  educator: EDUCATOR_USES,
};

export const MAX_ORGANISATION = 80;
export const MAX_COUNTRY = 60;

/** What a kind's answers look like before anything is picked. Terminology starts at the kind's default. */
export function defaultProProfile(kind: ProKind): ProProfile {
  return {
    kind,
    organisation: null,
    profession: null,
    sports: [],
    level: null,
    country: null,
    useCases: [],
    terminology: DEFAULT_TERMS[kind],
  };
}

/** Trims the typed fields; blanks become null (or are dropped, for `sportOther`). */
export function cleanProProfile(p: ProProfile): ProProfile {
  const text = (s: string | null, max: number) => {
    const t = s?.trim().slice(0, max) ?? "";
    return t ? t : null;
  };
  const next: ProProfile = { ...p, sports: [...p.sports], useCases: [...p.useCases], organisation: text(p.organisation, MAX_ORGANISATION), country: text(p.country, MAX_COUNTRY) };
  const other = p.sports.includes("other") ? text(p.sportOther ?? null, MAX_SPORT_OTHER) : null;
  if (other) next.sportOther = other;
  else delete next.sportOther;
  return next;
}

const labelOf = (options: Option<string>[], id: string | null) => options.find((o) => o.id === id)?.label ?? "";

/** The done step's summary, as term and detail pairs: "Your work", "Practice", "Using it for", "People are", then the defaults when set. */
export function proSummary(p: ProProfile): [string, string][] {
  const practice =
    p.kind === "coach"
      ? [p.sports.map((s) => (s === "other" && p.sportOther ? p.sportOther : labelOf(COACH_SPORTS, s))).join(", "), labelOf(COACH_LEVELS, p.level), p.organisation]
      : p.kind === "clinician"
        ? [labelOf(CLINICIAN_PROFESSIONS, p.profession), p.organisation, p.country]
        : [labelOf(EDUCATOR_ROLES, p.profession), p.organisation];
  return [
    ["Your work", labelOf(PRO_KINDS, p.kind)],
    ["Practice", practice.filter(Boolean).join(" · ")],
    ["Using it for", p.useCases.map((u) => labelOf(USE_CASES[p.kind], u)).join(", ")],
    ["People are", labelOf(PEOPLE_TERMS, p.terminology)],
    ...(p.defaultTargets ? [["Starting targets", targetsText(p.defaultTargets)] as [string, string]] : []),
    ...(p.scopeRequested ? [["Invites ask for", scopeText(p.scopeRequested)] as [string, string]] : []),
  ];
}

// ---------------------------------------------------------------- checks

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function listProblem(field: string, value: unknown, options: Option<string>[], min: number): string | null {
  if (!Array.isArray(value)) return `${field}: a list`;
  for (const v of value) if (typeof v !== "string" || !options.some((o) => o.id === v)) return `${field}: unknown "${String(v)}"`;
  if (new Set(value).size !== value.length) return `${field}: no repeats`;
  if (value.length < min) return `${field}: at least ${min}`;
  return null;
}

function textProblem(field: string, value: unknown, max: number, required: boolean): string | null {
  if (value === null) return required ? `${field}: required` : null;
  if (typeof value !== "string" || !value.trim() || value.length > max) return `${field}: text up to ${max} characters, or null`;
  return null;
}

function oneOf(field: string, value: unknown, options: Option<string>[]): string | null {
  return options.some((o) => o.id === value) ? null : `${field}: one of ${options.map((o) => o.id).join(", ")}`;
}

const aKind = (kind: ProKind) => `${kind === "educator" ? "an" : "a"} ${kind}`;
const mustBeNull = (field: string, value: unknown, kind: ProKind) => (value === null ? null : `${field}: not for ${aKind(kind)}`);

/** Why the practice answers (step 3) can't be stored, or null. */
export function practiceProblem(p: ProProfile): string | null {
  const f = "proProfile";
  const org = textProblem(`${f}.organisation`, p.organisation, MAX_ORGANISATION, false);
  if (org) return org;
  if (p.kind === "coach") {
    const sports = listProblem(`${f}.sports`, p.sports, COACH_SPORTS, 1);
    if (sports) return sports;
    if (p.sportOther !== undefined) {
      if (!p.sports.includes("other")) return `${f}.sportOther: only with sport "other"`;
      const other = textProblem(`${f}.sportOther`, p.sportOther, MAX_SPORT_OTHER, true);
      if (other) return other;
    }
    return mustBeNull(`${f}.profession`, p.profession, p.kind) ?? oneOf(`${f}.level`, p.level, COACH_LEVELS) ?? mustBeNull(`${f}.country`, p.country, p.kind);
  }
  const noSports = Array.isArray(p.sports) && p.sports.length === 0 && p.sportOther === undefined ? null : `${f}.sports: not for ${aKind(p.kind)}`;
  if (p.kind === "clinician") {
    return (
      noSports ??
      oneOf(`${f}.profession`, p.profession, CLINICIAN_PROFESSIONS) ??
      mustBeNull(`${f}.level`, p.level, p.kind) ??
      textProblem(`${f}.country`, p.country, MAX_COUNTRY, true)
    );
  }
  return noSports ?? oneOf(`${f}.profession`, p.profession, EDUCATOR_ROLES) ?? mustBeNull(`${f}.level`, p.level, p.kind) ?? mustBeNull(`${f}.country`, p.country, p.kind);
}

/** Why the use cases (step 4) can't be stored, or null: at least one, from the kind's list. */
export function usesProblem(p: ProProfile): string | null {
  return listProblem("proProfile.useCases", p.useCases, USE_CASES[p.kind], 1);
}

/**
 * Why a `proKind` / `proProfile` pair can't be stored, or null when it's fine.
 * Both may be absent (older accounts, onboarding not reached); a profile needs
 * a kind, and its own `kind` must match.
 */
export function proProblem(proKind: unknown, proProfile: unknown): string | null {
  if (proKind !== undefined && !PRO_KINDS.some((k) => k.id === proKind)) return `proKind: one of ${PRO_KINDS.map((k) => k.id).join(", ")}`;
  if (proProfile === undefined) return null;
  if (!isObject(proProfile)) return "proProfile: an object";
  if (proKind === undefined) return "proProfile: needs proKind";
  if (proProfile.kind !== proKind) return "proProfile.kind: must match proKind";
  const p = proProfile as unknown as ProProfile;
  return (
    practiceProblem(p) ??
    usesProblem(p) ??
    (isPeopleTerm(p.terminology) ? null : "proProfile.terminology: athletes, clients or students") ??
    proDefaultsProblem(p)
  );
}
