import type { SkillLevel } from "@/lib/analysis/config";
import type { PacerHalfCycle } from "@/lib/domain/types";

/** How a session is set up. Remembered in this browser as the next session's defaults. */
export interface SessionSetup {
  mode: "paced" | "open";
  pacer: PacerHalfCycle;
  /** Seconds; 0 means "until I stop". */
  lengthSec: number;
  view: "circle" | "line";
  sound: boolean;
  skill: SkillLevel;
}

export const DEFAULT_SETUP: SessionSetup = {
  mode: "paced",
  pacer: 5,
  lengthSec: 300,
  view: "circle",
  sound: true,
  skill: "intermediate",
};

export const LENGTHS = [
  { sec: 120, label: "2 min" },
  { sec: 300, label: "5 min" },
  { sec: 600, label: "10 min" },
  { sec: 0, label: "Until I stop" },
] as const;

export const SKILLS: { id: SkillLevel; label: string; detail: string }[] = [
  { id: "beginner", label: "Beginner", detail: "Widest on-target band" },
  { id: "intermediate", label: "Intermediate", detail: "The default" },
  { id: "advanced", label: "Advanced", detail: "Tighter band" },
  { id: "expert", label: "Expert", detail: "Tightest band" },
];

const KEY = "breathband:session-setup";

export function readSetup(): SessionSetup {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULT_SETUP;
    return parseSetup(new URLSearchParams(raw));
  } catch {
    return DEFAULT_SETUP;
  }
}

export function saveSetup(setup: SessionSetup): void {
  try {
    localStorage.setItem(KEY, setupQuery(setup));
  } catch {
    // Storage refused: the setup still applies to this session.
  }
}

/** The setup as a query string, which is also how the instrument page receives it. */
export function setupQuery(s: SessionSetup): string {
  return new URLSearchParams({
    mode: s.mode,
    pacer: String(s.pacer),
    len: String(s.lengthSec),
    view: s.view,
    sound: s.sound ? "1" : "0",
    skill: s.skill,
  }).toString();
}

export function parseSetup(q: URLSearchParams): SessionSetup {
  const pick = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T => allowed.find((a) => a === v) ?? fallback;
  const len = q.get("len") === null ? NaN : Number(q.get("len"));
  const mode = pick(q.get("mode"), ["paced", "open"], DEFAULT_SETUP.mode);
  // A paced session always has a length: "until I stop" is for open sessions.
  const valid = Number.isFinite(len) && len >= 0 && len <= 3600 && !(mode === "paced" && len === 0);
  return {
    mode,
    pacer: q.get("pacer") === "2" ? 2 : 5,
    lengthSec: valid ? Math.round(len) : DEFAULT_SETUP.lengthSec,
    view: pick(q.get("view"), ["circle", "line"], DEFAULT_SETUP.view),
    sound: q.get("sound") !== "0",
    skill: pick(q.get("skill"), ["beginner", "intermediate", "advanced", "expert"], DEFAULT_SETUP.skill),
  };
}
