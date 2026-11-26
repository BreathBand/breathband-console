"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { award, earnedMilestones, MILESTONES, newMilestones } from "@/lib/domain/habit";
import type { MilestoneKey, SessionSummary } from "@/lib/domain/types";

/**
 * Milestones earned since the last visit (J3), each shown once: what's new is
 * taken when Home opens and marked as shown in `preferences.gamification`
 * straight away, so it stays on screen for this visit and never comes back.
 * No sounds, no confetti.
 */
export function NewMilestones({ sessions, now }: { sessions: SessionSummary[]; now: Date }) {
  const auth = useAuth();
  const backend = useBackend();
  const profile = auth.status === "signed-in" ? auth.profile : null;
  const [fresh] = useState<MilestoneKey[]>(() =>
    profile?.preferences ? newMilestones(earnedMilestones(sessions, now), profile.preferences.gamification) : [],
  );
  const [open, setOpen] = useState(true);
  const saved = useRef(false);

  useEffect(() => {
    const prefs = profile?.preferences;
    if (saved.current || !profile || !prefs || fresh.length === 0) return;
    saved.current = true;
    // Not shown again even if this fails: it's a nicety, and the next visit tries again.
    backend.data.updateProfile(profile.uid, { preferences: { ...prefs, gamification: award(prefs.gamification, fresh, now) } }).catch(() => {
      saved.current = false;
    });
  }, [backend, profile, fresh, now]);

  if (!open || fresh.length === 0) return null;
  const shown = MILESTONES.filter((m) => fresh.includes(m.key));
  return (
    <section className="pane home-milestones" aria-labelledby="milestones-h">
      <div className="pane-h">
        <h2 id="milestones-h">{shown.length === 1 ? "New milestone" : "New milestones"}</h2>
        <button type="button" className="link small" onClick={() => setOpen(false)}>
          Got it
        </button>
      </div>
      <ul>
        {shown.map((m) => (
          <li key={m.key} data-key={m.key}>
            <b>{m.title}</b>
            <span>{m.line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
