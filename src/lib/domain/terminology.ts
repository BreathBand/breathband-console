// What a professional calls the people they work with: athletes, clients or
// students (planning/v1/02 §4.1 step 5, §5.2). Stored on the profile as
// `proProfile.terminology`; this turns it into the words the coach UI and
// emails use. Pure, so every screen and the server can share it.

import type { PeopleTerm, ProKind, UserProfile } from "./types";

/** Each kind's default; "patients" is not offered in v1 (D-G). */
export const DEFAULT_TERMS: Record<ProKind, PeopleTerm> = {
  coach: "athletes",
  clinician: "clients",
  educator: "students",
};

/** The choices, in the order onboarding shows them. */
export const PEOPLE_TERMS: { id: PeopleTerm; label: string }[] = [
  { id: "athletes", label: "Athletes" },
  { id: "clients", label: "Clients" },
  { id: "students", label: "Students" },
];

/** The nouns for one choice: "athlete" / "athletes", and capitalised for headings and buttons. */
export interface PeopleNouns {
  term: PeopleTerm;
  one: string;
  many: string;
  One: string;
  Many: string;
}

const ONE: Record<PeopleTerm, string> = { athletes: "athlete", clients: "client", students: "student" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function isPeopleTerm(value: unknown): value is PeopleTerm {
  return PEOPLE_TERMS.some((t) => t.id === value);
}

/** The kind's default; "athletes" when the kind isn't known (accounts from before onboarding asked). */
export function defaultTerm(kind: ProKind | null | undefined): PeopleTerm {
  return kind ? DEFAULT_TERMS[kind] : "athletes";
}

export function nounsFor(term: PeopleTerm): PeopleNouns {
  const one = ONE[term];
  return { term, one, many: term, One: cap(one), Many: cap(term) };
}

/**
 * The words for a professional: their own choice wins, then their kind's
 * default, then "athletes" (older coach accounts have neither).
 */
export function peopleNouns(who: Pick<UserProfile, "proKind" | "proProfile"> | null | undefined): PeopleNouns {
  const chosen = who?.proProfile?.terminology;
  return nounsFor(isPeopleTerm(chosen) ? chosen : defaultTerm(who?.proKind ?? who?.proProfile?.kind));
}

/** "1 client", "3 clients", "no clients". */
export function countPeople(n: number, nouns: PeopleNouns): string {
  if (n === 0) return `no ${nouns.many}`;
  return `${n} ${n === 1 ? nouns.one : nouns.many}`;
}
