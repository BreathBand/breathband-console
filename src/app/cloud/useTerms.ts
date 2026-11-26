"use client";

import { useAuth, type AuthState } from "@/lib/backend/BackendProvider";
import { peopleNouns, type PeopleNouns } from "@/lib/domain/terminology";
import type { ProKind } from "@/lib/domain/types";

/** The signed-in professional's words for the people they work with; "athletes" until the profile has loaded. */
export function termsOf(auth: AuthState): PeopleNouns {
  return peopleNouns(auth.status === "signed-in" ? auth.profile : null);
}

/** The signed-in professional's kind, or null (signed out, an athlete, or an account from before onboarding asked). */
export function proKindOf(auth: AuthState): ProKind | null {
  if (auth.status !== "signed-in" || auth.profile?.role !== "coach") return null;
  return auth.profile.proKind ?? auth.profile.proProfile?.kind ?? null;
}

export const useTerms = (): PeopleNouns => termsOf(useAuth());

export const useProKind = (): ProKind | null => proKindOf(useAuth());
