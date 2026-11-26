"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useBackend } from "@/lib/backend/BackendProvider";
import { initials } from "@/lib/domain/format";
import { aPerson } from "@/lib/domain/terminology";
import { useLoad } from "@/lib/useLoad";
import { athleteHref } from "./links";
import { useTerms } from "./useTerms";

/** The coach's "which client am I looking at" switch, in the top bar. */
export function AthletePicker({ coachId }: { coachId: string }) {
  const backend = useBackend();
  const router = useRouter();
  const t = useTerms();
  const current = useSearchParams().get("athlete");
  const athletes = useLoad(`athletes:${coachId}`, () => backend.data.listAthletes(coachId));

  if (athletes.status !== "ready" || athletes.data.length === 0) return null;
  const selected = athletes.data.find((a) => a.uid === current);

  return (
    <label className="picker">
      <span className="avatar" aria-hidden="true">
        {selected ? initials(selected.displayName) : "–"}
      </span>
      <span className="sr-only">{t.One}</span>
      <select
        value={selected?.uid ?? ""}
        onChange={(e) => router.push(athleteHref(e.target.value))}
      >
        {!selected && (
          <option value="" disabled>
            Choose {aPerson(t)}
          </option>
        )}
        {athletes.data.map((a) => (
          <option key={a.uid} value={a.uid}>
            {a.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}
