"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { award, earnedMilestones, MILESTONES, newMilestones } from "@/lib/domain/habit";
import type { SessionSummary } from "@/lib/domain/types";
import { useLoad } from "@/lib/useLoad";
import { changeGamification } from "./gamification";

/**
 * Milestones earned since the last visit (J3), each shown once: what's new is
 * taken when Home opens and marked as shown in `preferences.gamification`
 * straight away, so it stays on screen for this visit and never comes back.
 * The profile is read afresh: milestones shown or a program finished since
 * sign-in aren't in the one the app signed in with.
 * No sounds, no confetti.
 */
export function NewMilestones({ sessions, now }: { sessions: SessionSummary[]; now: Date }) {
  const auth = useAuth();
  const backend = useBackend();
  const uid = auth.status === "signed-in" ? auth.user.uid : null;
  const stored = useLoad(uid ? `milestones:${uid}` : null, () => backend.data.getProfile(uid!));
  const prefs = stored.status === "ready" ? (stored.data?.preferences ?? null) : null;
  const fresh = useMemo(() => (prefs ? newMilestones(earnedMilestones(sessions, now, prefs.gamification), prefs.gamification) : []), [prefs, sessions, now]);
  const [open, setOpen] = useState(true);
  const saved = useRef(false);

  useEffect(() => {
    if (saved.current || !uid || fresh.length === 0) return;
    saved.current = true;
    // Not shown again even if this fails: it's a nicety, and the next visit tries again.
    changeGamification(backend, uid, (g) => award(g, fresh, now)).catch(() => {
      saved.current = false;
    });
  }, [backend, uid, fresh, now]);

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
