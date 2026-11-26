// The first suggested session for each track, the one onboarding hands a person
// with a band straight into after fit and calibration (planning/v1/02 §3.1
// steps 10–12 and the order rule; the sessions are named in §3.2–3.4).

import { DEFAULT_SETUP, setupQuery, type SessionSetup } from "@/lib/prefs";
import type { UserPreferences } from "./types";

export type FirstSessionId = "breath-control" | "post-training-downshift" | "focus-sprint" | "just-breathe" | "first-session";

export interface FirstSession {
  id: FirstSessionId;
  /** What it's called on the done step and the instrument. */
  name: string;
  setup: SessionSetup;
}

/** Every first session is three minutes, so the first win is quick (§3.2). */
export const FIRST_SESSION_SEC = 180;

/** The query-string key that marks a recording as the onboarding's first session. */
export const FIRST_SESSION_PARAM = "first";

const NAMES: Record<FirstSessionId, string> = {
  "breath-control": "Breath Control",
  "post-training-downshift": "Post-training Downshift",
  "focus-sprint": "Focus Sprint",
  "just-breathe": "Just breathe",
  "first-session": "Your first session",
};

const paced55 = (skill: SessionSetup["skill"], sound: boolean): SessionSetup => ({
  mode: "paced",
  pacer: 5,
  lengthSec: FIRST_SESSION_SEC,
  view: "circle",
  sound,
  skill,
});

const make = (id: FirstSessionId, setup: SessionSetup): FirstSession => ({ id, name: NAMES[id], setup });

/**
 * The one suggested session for the person's track: Train gets Post-training
 * Downshift if they want recovery, else Breath Control (both paced 5-5); Focus
 * gets Focus Sprint (paced 5-5); Calm gets "Just breathe" (open, tones off).
 * All three minutes, at the person's level. Without a goal, a paced 5-5.
 */
export function firstSession(prefs: Partial<Pick<UserPreferences, "goal" | "goalDetails" | "skillLevel" | "session">> | null | undefined): FirstSession {
  const skill = prefs?.skillLevel ?? DEFAULT_SETUP.skill;
  const sound = prefs?.session?.sound ?? DEFAULT_SETUP.sound;
  switch (prefs?.goal) {
    case "train":
      return make(prefs.goalDetails?.train?.wants.includes("recovery") ? "post-training-downshift" : "breath-control", paced55(skill, sound));
    case "focus":
      return make("focus-sprint", paced55(skill, sound));
    case "calm":
      return make("just-breathe", { mode: "open", pacer: 5, lengthSec: FIRST_SESSION_SEC, view: "line", sound: false, skill });
    default:
      return make("first-session", paced55(skill, sound));
  }
}

/** The instrument's address for a first session: its settings, plus the flag that names it. */
export function firstSessionHref(session: FirstSession): string {
  return `/cloud/record/live/?${setupQuery(session.setup)}&${FIRST_SESSION_PARAM}=${session.id}`;
}

/** The first session's name from the instrument's query string, or null when this isn't one. */
export function firstSessionName(q: URLSearchParams): string | null {
  const id = q.get(FIRST_SESSION_PARAM);
  return id !== null && Object.hasOwn(NAMES, id) ? NAMES[id as FirstSessionId] : null;
}
