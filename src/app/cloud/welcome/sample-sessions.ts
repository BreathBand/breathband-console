import { generateSignal, OPEN_NORMAL_PATTERN, PACER_5_5, pacerPattern, toRaw, withCycle, withDepth } from "@/lib/analysis/synth";
import type { NewSession } from "@/lib/backend/types";
import { SAMPLE_RATE_HZ } from "@/lib/device/config";
import { buildSession } from "@/lib/recording";

// Sample-data mode (planning/v1/02 §2 and §6, "No band yet"): a made-up
// person's sessions, built and scored in the browser exactly as a real
// recording would be. Nothing here is stored: the samples live only on the
// screen that shows them, so leaving sample mode leaves nothing behind.

export const SAMPLE_PERSON = "Riley";
export const SAMPLE_LABEL = "Sample";

/** A sample session: what a stored session would hold, plus a short stretch of its curve to draw. */
export interface SampleSession {
  id: string;
  session: NewSession;
  /** The first minute of the breathing curve, in % of max, every fifth sample (4 Hz). */
  preview: number[];
}

/** Raw sensor scale of the samples (the simulated band's scale). */
const SCALE = { a100: 900, midline: 2050 } as const;
const PREVIEW_STEP = 5;
const DURATION_S = 180;

/** Two weeks of practice that gets steadier: days ago, hour, and the level aimed for (paced) or the rate (open). */
const PLAN: { daysAgo: number; hour: number; kind: "paced" | "open"; level: number; note: string }[] = [
  { daysAgo: 1, hour: 8, kind: "paced", level: 8.4, note: "Settled into the pacer quickly today." },
  { daysAgo: 3, hour: 21, kind: "open", level: 13, note: "Wind-down before bed." },
  { daysAgo: 5, hour: 8, kind: "paced", level: 7.6, note: "Rushed the first minute, then found it." },
  { daysAgo: 8, hour: 12, kind: "paced", level: 6.8, note: "Lunch break. A bit distracted." },
  { daysAgo: 10, hour: 21, kind: "open", level: 15, note: "First look at my resting breathing." },
  { daysAgo: 12, hour: 9, kind: "paced", level: 5.9, note: "First paced session. Hard to slow down." },
];

/** Total Breath Score aimed for → how far each turn strays, in method C's SD units. */
const spreadSd = (level: number) => Math.min(0.9, Math.max(0.02, (10.3 - level) / 7.6));

function dayAt(now: Date, daysAgo: number, hour: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** The sample person's sessions before `now`, newest first. Deterministic for a given `now`'s day. */
export function sampleSessions(now: Date): SampleSession[] {
  return PLAN.map((p, i) => {
    const seed = 7919 * (i + 1);
    const options = { sampleRateHz: SAMPLE_RATE_HZ, durationS: DURATION_S };
    let pct: number[];
    if (p.kind === "paced") {
      const sd = spreadSd(p.level);
      pct = generateSignal(pacerPattern(PACER_5_5), { ...options, noise: { seed, sampleSdPct: 0.05, amplitudeSdPct: sd * 3, timingSdS: sd * 5 } }).user;
    } else {
      const pattern = withDepth(withCycle(OPEN_NORMAL_PATTERN, 60 / p.level), 0.9);
      pct = generateSignal(pattern, { ...options, noise: { seed, sampleSdPct: 0.05, amplitudeSdPct: 0.25, timingSdS: 0.1 } }).user;
    }
    const { session } = buildSession({
      mode: p.kind,
      halfCycleS: p.kind === "paced" ? 5 : null,
      startedAt: dayAt(now, p.daysAgo, p.hour),
      raw: toRaw(pct, SCALE),
      markers: [],
      calibration: SCALE,
      skillLevel: "beginner",
      note: p.note,
      recorder: "sample",
    });
    const preview = pct.slice(0, 60 * SAMPLE_RATE_HZ).filter((_, j) => j % PREVIEW_STEP === 0);
    return { id: `sample-${i + 1}`, session, preview };
  });
}
