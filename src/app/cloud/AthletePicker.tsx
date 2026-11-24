"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useBackend } from "@/lib/backend/BackendProvider";
import { initials } from "@/lib/domain/format";
import { useLoad } from "@/lib/useLoad";
import { athleteHref } from "./links";

/** The coach's "which client am I looking at" switch, in the top bar. */
export function AthletePicker({ coachId }: { coachId: string }) {
  const backend = useBackend();
  const router = useRouter();
  const current = useSearchParams().get("athlete");
  const athletes = useLoad(`athletes:${coachId}`, () => backend.data.listAthletes(coachId));

  if (athletes.status !== "ready" || athletes.data.length === 0) return null;
  const selected = athletes.data.find((a) => a.uid === current);

  return (
    <label className="picker">
      <span className="avatar" aria-hidden="true">
        {selected ? initials(selected.displayName) : "–"}
      </span>
      <span className="sr-only">Athlete</span>
      <select
        value={selected?.uid ?? ""}
        onChange={(e) => router.push(athleteHref(e.target.value))}
      >
        {!selected && (
          <option value="" disabled>
            Choose an athlete
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
