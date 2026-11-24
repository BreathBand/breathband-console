"use client";

import type { Squad } from "@/lib/domain/types";

/** "All athletes" or one of the coach's squads. `value` is a squad id, or "" for everyone. */
export function SquadFilter({ squads, value, onChange }: { squads: Squad[]; value: string; onChange: (id: string) => void }) {
  if (squads.length === 0) return null;
  return (
    <label className="squad-filter">
      <span className="label">Squad</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All athletes</option>
        {squads.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.athleteIds.length})
          </option>
        ))}
      </select>
    </label>
  );
}

/** Members of the chosen squad, or everyone. */
export function inSquad<T extends { profile: { uid: string } }>(members: T[], squads: Squad[], squadId: string): T[] {
  const squad = squads.find((s) => s.id === squadId);
  return squad ? members.filter((m) => squad.athleteIds.includes(m.profile.uid)) : members;
}
