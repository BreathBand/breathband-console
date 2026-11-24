import {
  DEMO_DURATION_S,
  DEMO_FAULTS,
  generatePiecewise,
  generateProfile,
  generateSignal,
  OPEN_NORMAL_PATTERN,
  PACER_2_2,
  PACER_5_5,
  pacerPattern,
  toRaw,
  withCycle,
  withDepth,
  type DemoFaultName,
} from "@/lib/analysis/synth";
import { SAMPLE_RATE_HZ } from "@/lib/device/config";
import { defaultPreferences } from "@/lib/domain/preferences";
import { isLegacyScores } from "@/lib/domain/scores";
import { buildSession } from "@/lib/recording";
import {
  SCORING_VERSIONS,
  type PacerHalfCycle,
  type Assignment,
  type CoachInvite,
  type Squad,
  type SessionComment,
  type SessionSummary,
  type UserProfile,
  type Waveform,
} from "@/lib/domain/types";

// Deterministic demo data for local development. Nothing here ships to
// production: the Firebase adapter never imports this file.

export const DEMO_PASSWORD = "breathband";

export const DEMO_ATHLETE: UserProfile = {
  uid: "demo-athlete",
  email: "athlete@demo.local",
  displayName: "Alex Morgan",
  role: "athlete",
  createdAt: "2026-09-01T09:00:00.000Z",
  preferences: { ...defaultPreferences("train", "intermediate"), onboardedAt: "2026-09-01T09:00:00.000Z" },
};

export const DEMO_COACH: UserProfile = {
  uid: "demo-coach",
  email: "coach@demo.local",
  displayName: "Lena Vos",
  role: "coach",
  createdAt: "2026-09-01T09:00:00.000Z",
  preferences: { ...defaultPreferences("train", "intermediate"), onboardedAt: "2026-09-01T09:00:00.000Z" },
};

/** Two more athletes linked to the demo coach, so the roster has people to compare. */
export const DEMO_TEAM: UserProfile[] = [
  {
    uid: "demo-athlete-2",
    email: "sam@demo.local",
    displayName: "Sam Okafor",
    role: "athlete",
    createdAt: "2026-09-08T09:00:00.000Z",
    preferences: { ...defaultPreferences("train", "beginner"), onboardedAt: "2026-09-08T09:00:00.000Z" },
  },
  {
    uid: "demo-athlete-3",
    email: "priya@demo.local",
    displayName: "Priya Nair",
    role: "athlete",
    createdAt: "2026-09-20T09:00:00.000Z",
    preferences: { ...defaultPreferences("calm", "beginner"), onboardedAt: "2026-09-20T09:00:00.000Z" },
  },
  {
    uid: "demo-athlete-4",
    email: "maya@demo.local",
    displayName: "Maya Chen",
    role: "athlete",
    createdAt: "2026-08-24T09:00:00.000Z",
    preferences: { ...defaultPreferences("focus", "advanced"), onboardedAt: "2026-08-24T09:00:00.000Z" },
  },
  {
    uid: "demo-athlete-5",
    email: "leo@demo.local",
    displayName: "Leo Brandt",
    role: "athlete",
    createdAt: "2026-10-28T09:00:00.000Z",
    preferences: { ...defaultPreferences("train", "intermediate"), onboardedAt: "2026-10-28T09:00:00.000Z" },
  },
];

/** Small seeded PRNG so demo data is identical on every machine. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

interface SeedPlan {
  count: number;
  /** Days between the oldest session and now. */
  spanDays: number;
  /** Days since the newest session. */
  restDays: number;
  /** Paced Total Breath Score at the start and end of the span (1–10), roughly. */
  from: number;
  to: number;
  /** How many of the oldest sessions were recorded before per-transition scoring (app 1.0). */
  legacyCount: number;
  /** Points knocked off the newest session, so the roster has a "score down" flag to show. */
  dip?: number;
}

const PLANS: Record<string, SeedPlan> = {
  // Improving steadily; the oldest sessions predate the 1–10 scores.
  "demo-athlete": { count: 24, spanDays: 56, restDays: 1, from: 6, to: 8.6, legacyCount: 5 },
  // Slipping over the last few weeks, and a poor latest session.
  "demo-athlete-2": { count: 18, spanDays: 42, restDays: 2, from: 7.6, to: 6.4, legacyCount: 0, dip: 2.6 },
  // Newer, and hasn't recorded for over a week.
  "demo-athlete-3": { count: 9, spanDays: 40, restDays: 9, from: 4.6, to: 6.2, legacyCount: 0 },
  // Experienced and consistent: trains most days.
  "demo-athlete-4": { count: 34, spanDays: 63, restDays: 0, from: 7.4, to: 8.6, legacyCount: 0 },
  // Started three weeks ago and improving fast.
  "demo-athlete-5": { count: 11, spanDays: 21, restDays: 1, from: 3.8, to: 6.4, legacyCount: 0 },
};

const NOTES = [
  "Calm start. Lost the rhythm on a few exhales around minute 3, then found it again.",
  "Felt tight in the chest at the start.",
  "Evening session after training. Legs heavy, breathing easy.",
  "Rushed the inhales. Need to let them fill the whole 5 seconds.",
  "Phone buzzed halfway through and I lost focus for a while.",
];

/** The app build the seeded method-C sessions claim to come from. */
export const SEED_APP_VERSION = "1.2.0+60";
const LEGACY_APP_VERSION = "1.0.0+43";
/** Raw sensor scale of the seeded recordings (the simulated band's scale). */
const SEED_SCALE = { a100: 900, midline: 2050 } as const;

type ExtraRecipe = { kind: "fault"; fault: DemoFaultName } | { kind: "markers" };

/**
 * Alex's recent sessions that show what method C does with typical faults,
 * plus two open sessions split by markers: days ago, and what the athlete wrote.
 */
const ALEX_EXTRAS: { id: string; daysAgo: number; hour: number; recipe: ExtraRecipe; note: string }[] = [
  { id: "f-early", daysAgo: 3, hour: 7, recipe: { kind: "fault", fault: "early" }, note: "Kept jumping ahead of the pacer. Turned every breath too soon." },
  { id: "m-001", daysAgo: 4, hour: 18, recipe: { kind: "markers" }, note: "Marked the start and end of the hard set on the bike. Breathing ran fast in between." },
  { id: "f-shallow", daysAgo: 5, hour: 21, recipe: { kind: "fault", fault: "shallow" }, note: "Tired. Only half filled each breath." },
  { id: "f-deep", daysAgo: 6, hour: 8, recipe: { kind: "fault", fault: "tooDeep" }, note: "Overdid it with huge breaths. Felt a bit light-headed." },
  { id: "f-fast", daysAgo: 8, hour: 12, recipe: { kind: "fault", fault: "tooFast" }, note: "Rushed it. Couldn't slow down to the pacer." },
  { id: "f-lost", daysAgo: 9, hour: 17, recipe: { kind: "fault", fault: "lostThenRecovered" }, note: "Band slipped after a minute. Tightened it and carried on." },
  { id: "m-002", daysAgo: 10, hour: 9, recipe: { kind: "markers" }, note: "Marked when the call started and ended. Breathing sped up on the call." },
];

/** Everything needed to regenerate a seeded session's signal: derived from the session, never stored. */
type Recipe =
  | { kind: "plan"; mode: "paced" | "open"; half: PacerHalfCycle | null; durationSec: number; level: number; seed: number }
  | { kind: "fault"; fault: DemoFaultName; seed: number }
  | { kind: "markers"; durationSec: number; seed: number };

type SeedFields = Pick<SessionSummary, "athleteId" | "id" | "mode" | "pacerHalfCycleSec" | "durationSec" | "startedAt" | "note">;

/** Total Breath Score aimed for → how far each turn strays, in method C's SD units (tuned against the scorer). */
function spreadSd(level: number): number {
  return clamp((10.3 - level) / 7.6, 0.02, 0.9);
}

const OPEN_RATES = [12, 13, 14, 15, 16] as const;
/** The level Alex's fault sessions would score without the fault. */
const FAULT_BASE_LEVEL = 8.2;

function planLevel(plan: SeedPlan, i: number): number {
  const newest = i === plan.count - 1;
  return plan.from + (plan.to - plan.from) * (i / (plan.count - 1)) - (newest ? (plan.dip ?? 0) : 0);
}

function recipeFor(session: Omit<SeedFields, "startedAt" | "note"> & { waveformPath: string }): Recipe {
  const seed = hashString(session.waveformPath);
  const extra = session.athleteId === DEMO_ATHLETE.uid ? ALEX_EXTRAS.find((e) => e.id === session.id) : undefined;
  if (extra?.recipe.kind === "fault") return { kind: "fault", fault: extra.recipe.fault, seed };
  if (extra) return { kind: "markers", durationSec: session.durationSec, seed };
  const plan = PLANS[session.athleteId] ?? PLANS[DEMO_ATHLETE.uid];
  const level = planLevel(plan, Number(session.id.slice(1)) - 1);
  return { kind: "plan", mode: session.mode, half: session.pacerHalfCycleSec, durationSec: session.durationSec, level, seed };
}

/** The breathing signal for a recipe, in % of max at 20 Hz, with marker sample indices. */
function signalFor(recipe: Recipe): { pct: number[]; markers: number[] } {
  const options = { sampleRateHz: SAMPLE_RATE_HZ };
  const noiseSeed = recipe.seed % 100_000;
  if (recipe.kind === "fault") {
    // On top of the fault, the same scatter as Alex's recent good sessions (5-5 pacer: 1 SD of timing is 5 s).
    const sd = spreadSd(FAULT_BASE_LEVEL);
    const noise = { seed: noiseSeed, sampleSdPct: 0.05, amplitudeSdPct: sd * 3, timingSdS: sd * 5 };
    return { pct: generateProfile(DEMO_FAULTS.paced[recipe.fault], { ...options, noise }).user, markers: [] };
  }
  const r = mulberry32(recipe.seed);
  if (recipe.kind === "markers") {
    const d = recipe.durationSec;
    const m1 = Math.round(d * (0.3 + r() * 0.08));
    const m2 = Math.round(d * (0.62 + r() * 0.08));
    const noise = { seed: noiseSeed, sampleSdPct: 0.05, amplitudeSdPct: 0.25, timingSdS: 0.08 };
    const signal = generatePiecewise(
      [
        { fromS: 0, pattern: withCycle(OPEN_NORMAL_PATTERN, 60 / 13) },
        { fromS: m1, pattern: withDepth(withCycle(OPEN_NORMAL_PATTERN, 60 / 20), 0.75) },
        { fromS: m2, pattern: withCycle(OPEN_NORMAL_PATTERN, 60 / 14.5) },
      ],
      { ...options, durationS: d, noise },
    );
    return { pct: signal.user, markers: [m1 * SAMPLE_RATE_HZ, m2 * SAMPLE_RATE_HZ] };
  }
  if (recipe.mode === "paced" && recipe.half) {
    const sd = spreadSd(recipe.level);
    const pattern = pacerPattern(recipe.half === 2 ? PACER_2_2 : PACER_5_5);
    const noise = { seed: noiseSeed, sampleSdPct: 0.05, amplitudeSdPct: sd * 3, timingSdS: sd * recipe.half };
    return { pct: generateSignal(pattern, { ...options, durationS: recipe.durationSec, noise }).user, markers: [] };
  }
  const rate = OPEN_RATES[Math.floor(r() * OPEN_RATES.length)] + (r() - 0.5);
  const pattern = withDepth(withCycle(OPEN_NORMAL_PATTERN, 60 / rate), 0.8 + r() * 0.4);
  const noise = { seed: noiseSeed, sampleSdPct: 0.05, amplitudeSdPct: 0.25, timingSdS: 0.1 };
  return { pct: generateSignal(pattern, { ...options, durationS: recipe.durationSec, noise }).user, markers: [] };
}

/** Records and scores a seeded session exactly as BreathCloud scores a browser recording. */
function built(session: SeedFields & { waveformPath: string }) {
  const { pct, markers } = signalFor(recipeFor(session));
  return buildSession({
    mode: session.mode,
    halfCycleS: session.mode === "paced" ? session.pacerHalfCycleSec : null,
    startedAt: new Date(session.startedAt),
    raw: toRaw(pct, SEED_SCALE),
    markers,
    calibration: SEED_SCALE,
    skillLevel: "intermediate",
    note: session.note,
    recorder: SEED_APP_VERSION,
  });
}

/** A scored method-C (paced) or Appendix-metrics (open) session, as the app would upload it. */
function seededSession(base: SeedFields): SessionSummary {
  const waveformPath = `waveforms/${base.athleteId}/${base.id}.json.gz`;
  const { session } = built({ ...base, waveformPath });
  return { ...session, ...base, waveformPath, source: "app" };
}

/** A few weeks of sessions before `now`, newest first, following the athlete's plan. */
export function seedSessions(athleteId: string, now: Date): SessionSummary[] {
  const plan = PLANS[athleteId] ?? PLANS[DEMO_ATHLETE.uid];
  const rand = mulberry32(hashString(athleteId));
  const sessions: SessionSummary[] = [];

  for (let i = 0; i < plan.count; i++) {
    const progress = i / (plan.count - 1);
    const daysAgo = plan.restDays + Math.round((1 - progress) * (plan.spanDays - plan.restDays));
    const startedAt = new Date(now.getTime() - daysAgo * 86_400_000);
    // Local hours, so demo sessions fall in the daytime wherever the console is opened.
    startedAt.setHours(6 + Math.floor(rand() * 14), Math.floor(rand() * 60), 0, 0);

    const newest = i === plan.count - 1;
    // Alex's newest is a good 5-5, so the home screen opens on a healthy session.
    const alexNewest = newest && athleteId === DEMO_ATHLETE.uid;
    const mode = alexNewest || (newest && plan.dip) || rand() < 0.72 ? "paced" : "open";
    const pacerHalfCycleSec = mode === "paced" ? (alexNewest || rand() >= 0.35 ? 5 : 2) : null;
    const id = `s${String(i + 1).padStart(3, "0")}`;
    const durationSec = mode === "paced" ? (alexNewest || rand() < 0.7 ? 300 : 180) : 240 + Math.floor(rand() * 3) * 30;
    const note = rand() < 0.3 ? NOTES[Math.floor(rand() * NOTES.length)] : "";
    const base: SeedFields = { athleteId, id, mode, pacerHalfCycleSec, durationSec, startedAt: startedAt.toISOString(), note };

    if (i < plan.legacyCount) {
      const level = planLevel(plan, i);
      const depth = round1(clamp(level * 10 + (rand() - 0.5) * 14, 0, 100));
      const timing = round1(clamp(level * 10 + (rand() - 0.5) * 14, 0, 100));
      sessions.push({
        ...base,
        scores: mode === "paced" ? { depth, timing, overall: round1((depth + timing) / 2) } : null,
        scoringVersion: SCORING_VERSIONS.legacy,
        respirationRateBpm: mode === "paced" ? 60 / (2 * pacerHalfCycleSec!) : 11 + Math.floor(rand() * 7),
        waveformPath: `waveforms/${athleteId}/${id}.json.gz`,
        appVersion: LEGACY_APP_VERSION,
      });
    } else {
      sessions.push(seededSession(base));
    }
  }

  if (athleteId === DEMO_ATHLETE.uid) {
    for (const extra of ALEX_EXTRAS) {
      const startedAt = new Date(now.getTime() - extra.daysAgo * 86_400_000);
      startedAt.setHours(extra.hour, 20, 0, 0);
      const paced = extra.recipe.kind === "fault";
      sessions.push(
        seededSession({
          athleteId,
          id: extra.id,
          mode: paced ? "paced" : "open",
          pacerHalfCycleSec: paced ? 5 : null,
          durationSec: paced ? DEMO_DURATION_S : 240,
          startedAt: startedAt.toISOString(),
          note: extra.note,
        }),
      );
    }
  }

  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** Seeded sessions that show a fault or markers on purpose; the coaching seed keeps its comments off them. */
export function isDemoExtra(session: Pick<SessionSummary, "id">): boolean {
  return ALEX_EXTRAS.some((e) => e.id === session.id);
}

const DAY = 86_400_000;

/** A day boundary `days` from `now`, at the given local hour. */
function dayAt(now: Date, days: number, hour: number): string {
  const d = new Date(now.getTime() + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/**
 * The coaching layer on top of the seeded sessions: practice the demo coach
 * has set, a few comment threads, which sessions the coach has already opened,
 * and their private notes. Each athlete shows a different state on the
 * dashboard: on track, overdue, and not started.
 */
export function seedCoaching(
  sessions: Record<string, SessionSummary[]>,
  now: Date,
): {
  assignments: Record<string, Assignment[]>;
  comments: Record<string, SessionComment[]>;
  seen: Record<string, string[]>;
  coachNotes: Record<string, string>;
  squads: Record<string, Squad[]>;
  coachInvites: CoachInvite[];
} {
  const coach = DEMO_COACH;
  const assignment = (
    athleteId: string,
    n: number,
    fields: Omit<Assignment, "id" | "coachId" | "athleteId" | "cancelled">,
  ): Assignment => ({ id: `a${String(n).padStart(3, "0")}`, coachId: coach.uid, athleteId, cancelled: false, ...fields });

  const [alex, sam, priya] = [DEMO_ATHLETE, ...DEMO_TEAM].map((a) => a.uid);
  const assignments: Record<string, Assignment[]> = {
    [alex]: [
      assignment(alex, 2, {
        createdAt: dayAt(now, -5, 9),
        mode: "paced",
        pacerHalfCycleSec: 5,
        durationSec: 300,
        target: 4,
        dueAt: dayAt(now, 2, 23),
        note: "Build the 5-5 base before we add 2-2 again. Let each exhale finish before the ring turns.",
      }),
      assignment(alex, 1, {
        createdAt: dayAt(now, -24, 9),
        mode: "paced",
        pacerHalfCycleSec: 2,
        durationSec: 180,
        target: 2,
        dueAt: dayAt(now, -14, 23),
        note: "Two short 2-2 sessions to see where your timing is at.",
      }),
    ],
    [sam]: [
      assignment(sam, 3, {
        createdAt: dayAt(now, -10, 9),
        mode: "paced",
        pacerHalfCycleSec: 5,
        durationSec: 300,
        target: 5,
        dueAt: dayAt(now, -1, 23),
        note: "Five full 5-5 sessions this block. Morning if you can, before training.",
      }),
    ],
    [priya]: [
      assignment(priya, 4, {
        createdAt: dayAt(now, -6, 9),
        mode: "open",
        pacerHalfCycleSec: null,
        durationSec: 240,
        target: 2,
        dueAt: dayAt(now, 1, 23),
        note: "Two open sessions so we have a fresh baseline for your resting rate.",
      }),
    ],
  };

  const at = (s: SessionSummary, hours: number) => new Date(Date.parse(s.startedAt) + hours * 3_600_000).toISOString();
  let n = 0;
  const comment = (
    s: SessionSummary,
    hours: number,
    author: UserProfile,
    kind: SessionComment["kind"],
    text = "",
  ): SessionComment => ({
    id: `c${String(++n).padStart(3, "0")}`,
    athleteId: s.athleteId,
    sessionId: s.id,
    authorId: author.uid,
    authorName: author.displayName,
    authorRole: author.role,
    kind,
    text,
    createdAt: at(s, hours),
  });

  const alexPaced = sessions[alex].filter((s) => s.mode === "paced" && !isDemoExtra(s));
  const samLatest = sessions[sam][0];
  const comments: Record<string, SessionComment[]> = {
    [alex]: [
      comment(alexPaced[2], 3, coach, "comment", "Steady exhales from minute 2 on. Keep the inhales just as long and this is an 8."),
      comment(alexPaced[2], 5, DEMO_ATHLETE, "comment", "Thanks! It felt calmer once I stopped watching the clock."),
      comment(alexPaced[2], 7, coach, "kudos"),
      comment(alexPaced[1], 2, coach, "kudos"),
    ],
    [sam]: [comment(samLatest, 1, DEMO_TEAM[0], "comment", "Rough one. Slept badly and rushed it before the gym.")],
    [priya]: [],
  };

  // The coach has opened everything older than three days, so "To review" holds the latest few.
  const cutoff = now.getTime() - 3 * DAY;
  const seen = {
    [coach.uid]: Object.values(sessions)
      .flat()
      .filter((s) => Date.parse(s.startedAt) < cutoff)
      .map((s) => `${s.athleteId}/${s.id}`),
  };

  const coachNotes = {
    [`${coach.uid}_${alex}`]:
      "Goal: a steady 8+ on 5-5 before the regional meet on 12 Dec.\nRushes the inhale when tired; evening sessions score lower.",
    [`${coach.uid}_${sam}`]: "Back from a hamstring injury. Keep sessions short and frequent; don't push 2-2 yet.",
  };

  // Squads: the coach's own grouping, like a clinic's locations.
  const squads: Record<string, Squad[]> = {
    [coach.uid]: [
      { id: "q-sprint", name: "Sprint squad", athleteIds: [alex, sam, "demo-athlete-4"], createdAt: dayAt(now, -30, 9) },
      { id: "q-juniors", name: "Juniors", athleteIds: [priya, "demo-athlete-5"], createdAt: dayAt(now, -20, 9) },
    ],
  };

  // One invite the coach sent by text that hasn't been answered yet.
  const coachInvites: CoachInvite[] = [
    {
      code: "JRDN7K2Q",
      coachId: coach.uid,
      coachName: coach.displayName,
      athleteName: "Jordan Lee",
      contact: "+1 555 0142",
      createdAt: dayAt(now, -2, 10),
      expiresAt: dayAt(now, 12, 10),
      status: "pending",
      athleteId: null,
    },
  ];

  return { assignments, comments, seen, coachNotes, squads, coachInvites };
}

/**
 * The signal behind a seeded session. Method-C sessions are regenerated from
 * their recipe through the same recording path that scored them, so the
 * waveform always matches the stored scores. Legacy sessions keep the old
 * illustrative generator.
 */
export function generateWaveform(session: SessionSummary): Waveform {
  if (session.scoringVersion === SCORING_VERSIONS.legacy) return legacyWaveform(session);
  return built(session).waveform;
}

/**
 * Illustrative pacer depth for legacy demo signals, as a share of the
 * calibrated range. Deliberately not the app's calibration factor.
 */
const DEMO_PACER_SHARE = 0.25;

/** A plausible legacy signal: the user follows the pacer about as well as their 0–100 % scores say. */
function legacyWaveform(session: SessionSummary): Waveform {
  const rand = mulberry32(hashString(session.waveformPath));
  const sampleIntervalMs = 50;
  const hz = 1000 / sampleIntervalMs;
  const samples = Math.round(session.durationSec * hz);
  const calibration = { min: 1.2, max: 3.4 };
  const midline = (calibration.max + calibration.min) / 2;
  const swing = (DEMO_PACER_SHARE * (calibration.max - calibration.min)) / 2;

  const paced = session.mode === "paced";
  const halfCycle = session.pacerHalfCycleSec ?? 30 / (session.respirationRateBpm ?? 14);
  const q = isLegacyScores(session.scores)
    ? { timing: session.scores.timing / 10, depthIn: session.scores.depth / 10, depthOut: session.scores.depth / 10 }
    : { timing: 10, depthIn: 8.5, depthOut: 8.5 };
  // Lower timing scores trail the pacer by more; lower depth scores fall short of it.
  const meanLag = (10 - q.timing) * 0.04 * halfCycle;
  const reachIn = 1 - (10 - q.depthIn) * 0.07;
  const reachOut = 1 - (10 - q.depthOut) * 0.07;
  const phaseA = rand() * 6;
  const phaseB = rand() * 6;

  const user: number[] = [];
  const pacer: number[] | null = paced ? [] : null;
  let wander = 0;
  let openPhase = 0;

  for (let i = 0; i < samples; i++) {
    const t = i / hz;
    let v: number;
    if (paced) {
      const lag = meanLag * (0.4 + 1.2 * (0.5 + 0.5 * Math.sin(t / 17 + phaseA)));
      v = -Math.cos((Math.PI * (t - lag)) / halfCycle);
      pacer!.push(midline - swing * Math.cos((Math.PI * t) / halfCycle));
    } else {
      openPhase += (Math.PI / (halfCycle * hz)) * (1 + 0.15 * Math.sin(t / 9 + phaseA));
      v = -Math.cos(openPhase);
    }
    const reach = (v >= 0 ? reachIn : reachOut) * (1 + 0.1 * Math.sin(t / 7 + phaseB));
    wander = wander * 0.998 + (rand() - 0.5) * swing * 0.01;
    const noise = (rand() - 0.5) * swing * 0.06;
    user.push(midline + swing * reach * v + wander + noise);
  }

  const markers = !paced && session.note ? [Math.floor(samples * 0.4)] : [];
  return { sampleIntervalMs, user, pacer, markers, calibration };
}
