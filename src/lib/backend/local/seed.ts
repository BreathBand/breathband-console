import {
  SCORING_VERSION,
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
  displayName: "Demo Athlete",
  role: "athlete",
  createdAt: "2026-09-01T09:00:00.000Z",
};

export const DEMO_COACH: UserProfile = {
  uid: "demo-coach",
  email: "coach@demo.local",
  displayName: "Demo Coach",
  role: "coach",
  createdAt: "2026-09-01T09:00:00.000Z",
};

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

/** ~24 sessions over the 8 weeks before `now`, scores trending upward. */
export function seedSessions(athleteId: string, now: Date): SessionSummary[] {
  const rand = mulberry32(hashString(athleteId));
  const sessions: SessionSummary[] = [];
  const count = 24;

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.round(((count - i) / count) * 56);
    const startedAt = new Date(now.getTime() - daysAgo * 86_400_000);
    startedAt.setUTCHours(7 + Math.floor(rand() * 12), Math.floor(rand() * 60), 0, 0);

    const mode = rand() < 0.75 ? "paced" : "open";
    const pacerHalfCycleSec = mode === "paced" ? (rand() < 0.5 ? 2 : 5) : null;
    const progress = i / (count - 1);
    const depth = round1(Math.min(100, 55 + progress * 30 + (rand() - 0.5) * 16));
    const timing = round1(Math.min(100, 50 + progress * 35 + (rand() - 0.5) * 18));
    const id = `s${String(i + 1).padStart(3, "0")}`;

    sessions.push({
      id,
      athleteId,
      startedAt: startedAt.toISOString(),
      durationSec: 120 + Math.floor(rand() * 8) * 30,
      mode,
      pacerHalfCycleSec,
      scores: mode === "paced" ? { depth, timing, overall: round1((depth + timing) / 2) } : null,
      scoringVersion: SCORING_VERSION,
      respirationRateBpm:
        mode === "paced" ? 60 / (2 * pacerHalfCycleSec!) : 11 + Math.floor(rand() * 6),
      note: i % 5 === 0 ? "Felt tight in the chest at the start." : "",
      waveformPath: `waveforms/${athleteId}/${id}.json.gz`,
      appVersion: "1.0.0+43",
    });
  }

  return sessions.reverse();
}

/** Builds a plausible signal for a session, mirroring the app's pacer formula shape. */
export function generateWaveform(session: SessionSummary): Waveform {
  const rand = mulberry32(hashString(session.waveformPath));
  const sampleIntervalMs = 50;
  const samples = Math.round((session.durationSec * 1000) / sampleIntervalMs);
  const calibration = { min: 1.2, max: 3.4 };
  const amplitude = calibration.max - calibration.min;
  const midline = (calibration.max + calibration.min) / 2;

  const halfCycle = session.pacerHalfCycleSec ?? 2.5 + rand() * 2;
  const step = Math.PI / ((halfCycle * 1000) / sampleIntervalMs);
  const depthFactor = session.scores ? session.scores.depth / 100 : 0.8 + rand() * 0.3;
  const lag = session.scores ? (1 - session.scores.timing / 100) * 1.2 : 0;

  const user: number[] = [];
  const pacer: number[] | null = session.mode === "paced" ? [] : null;
  let wander = 0;

  for (let i = 0; i < samples; i++) {
    const x = i * step;
    wander += (rand() - 0.5) * 0.004;
    const noise = (rand() - 0.5) * amplitude * 0.03;
    user.push(-(midline + 0.2 * amplitude * depthFactor * Math.cos(x - lag) + wander + noise));
    pacer?.push(0.2 * amplitude * Math.cos(x) - (midline + amplitude / 12));
  }

  const markers = session.note ? [Math.floor(samples * 0.3)] : [];
  return { sampleIntervalMs, user, pacer, markers, calibration };
}
