import { pacerAt, pacerPhase, pacerValue } from "@/lib/domain/group";
import { combineTransitionScores, isTransitionScores } from "@/lib/domain/scores";
import {
  SCORING_VERSIONS,
  type GroupSession,
  type InhaleExhale,
  type PacerHalfCycle,
  type SessionSummary,
  type Waveform,
} from "@/lib/domain/types";
import { breathDeviations } from "@/lib/domain/waveform";
import type { Presence } from "../types";

// Stand-in for the live channel and for each athlete's app during a group
// session. Nothing here ships: in production every athlete's phone streams
// its band over a realtime channel (Firebase Realtime Database) and scores
// its own recording when the session ends.
//
// Everything is a pure function of time, so the host's screen can reload
// mid-session and the recording at the end still matches what was shown.

export const LIVE_HZ = 10;

/** How one simulated athlete breathes: follows the pacer about as well as their recent scores say. */
export interface LiveProfile {
  athleteId: string;
  /** Typical lag behind the pacer, as a share of a half cycle. */
  lagShare: number;
  reachIn: number;
  reachOut: number;
  noise: number;
  seed: number;
  /** Seconds after the lobby opens that this athlete taps Join. */
  joinAfterSec: number;
  /** Seconds after the start during which their connection drops, if it does. */
  drop: [number, number] | null;
}

const JOIN_AFTER = [1.4, 2.8, 6.5, 3.6, 4.4, 2.1, 5.2, 7.4];

export function liveProfile(group: GroupSession, athleteId: string, sessions: SessionSummary[]): LiveProfile {
  const index = group.athleteIds.indexOf(athleteId);
  const totals = sessions.flatMap((s) => (isTransitionScores(s.scores) ? [s.scores.total] : [])).slice(0, 5);
  const level = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 6.5;
  const miss = 1 - Math.min(0.95, Math.max(0.3, level / 10));
  return {
    athleteId,
    lagShare: miss * 0.7,
    reachIn: 1 - miss * 0.55,
    reachOut: 1 - miss * 0.7,
    noise: 0.03 + miss * 0.08,
    seed: (hash(group.id + athleteId) % 1000) / 160,
    joinAfterSec: JOIN_AFTER[index % JOIN_AFTER.length] + Math.floor(index / JOIN_AFTER.length),
    // The second athlete's signal drops for a few seconds, so the host sees a reconnect.
    drop: index === 1 && group.durationSec >= 120 ? [group.durationSec * 0.4, group.durationSec * 0.4 + 5] : null,
  };
}

/** Seconds from the lobby opening to the start (0 before it starts). */
function lobbySeconds(group: GroupSession): number {
  return group.startedAt ? (Date.parse(group.startedAt) - Date.parse(group.createdAt)) / 1000 : 0;
}

/** Seconds after the start at which the athlete joined; negative if they were waiting in the lobby. */
export function joinOffset(profile: LiveProfile, group: GroupSession): number {
  return profile.joinAfterSec - lobbySeconds(group);
}

/** Presence at wall-clock time `nowMs`. */
export function presenceAt(profile: LiveProfile, group: GroupSession, nowMs: number): Presence {
  if (group.status === "cancelled" || group.status === "ended") return "left";
  if (nowMs < Date.parse(group.createdAt) + profile.joinAfterSec * 1000) return "invited";
  if (group.status === "live" && group.startedAt && profile.drop) {
    const t = (nowMs - Date.parse(group.startedAt)) / 1000;
    if (t >= profile.drop[0] && t < profile.drop[1]) return "reconnecting";
  }
  return "joined";
}

/** The athlete's breath at `t` seconds after the start, on the pacer's scale (−1 out, 1 in). */
export function liveSample(profile: LiveProfile, group: GroupSession, t: number): number {
  const s = profile.seed;
  const lag = profile.lagShare * pacerAt(group, t) * (0.6 + 0.8 * (0.5 + 0.5 * Math.sin(t / 13 + s)));
  const v = -Math.cos(pacerPhase(group, Math.max(0, t - lag)));
  const reach = (v >= 0 ? profile.reachIn : profile.reachOut) * (1 + 0.08 * Math.sin(t / 7 + 2 * s));
  const jitter = ((hash(`${profile.athleteId}:${Math.round(t * LIVE_HZ)}`) % 1000) / 1000 - 0.5) * 2 * profile.noise;
  return v * reach + jitter + 0.04 * Math.sin(t / 5.3 + s);
}

// Illustrative signal units for the saved waveform (as in seed.ts): not the app's calibration.
const MIDLINE = 2.3;
const SWING = 0.275;

const toScore = (offPercent: number) => Math.min(10, Math.max(1, 10 - Math.floor(Math.abs(offPercent) / 10)));
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / (values.length || 1);

/**
 * What the athlete's app saves when the session ends: the recording from the
 * moment they joined, scored 1–10 the way the review screen explains it
 * (within 10% of the pacer is a 10, each further 10% off costs a point).
 */
export function recordGroupSession(
  profile: LiveProfile,
  group: GroupSession,
  elapsedSec: number,
  sessionId: string,
): { summary: SessionSummary; waveform: Waveform } | null {
  const from = Math.max(0, joinOffset(profile, group));
  const length = elapsedSec - from;
  if (length < 30) return null;

  const n = Math.floor(length * LIVE_HZ);
  const user: number[] = [];
  const pacer: number[] = [];
  const time: Record<PacerHalfCycle, number> = { 2: 0, 5: 0 };
  for (let i = 0; i < n; i++) {
    const t = from + i / LIVE_HZ;
    user.push(MIDLINE + SWING * liveSample(profile, group, t));
    pacer.push(MIDLINE + SWING * pacerValue(group, t));
    time[pacerAt(group, t)]++;
  }
  const markers = group.markers.map((m) => Math.round((m - from) * LIVE_HZ)).filter((i) => i >= 0 && i < n);
  const waveformPath = `waveforms/${profile.athleteId}/${sessionId}.json.gz`;
  const waveform: Waveform = {
    sampleIntervalMs: 1000 / LIVE_HZ,
    user,
    pacer,
    markers,
    calibration: { min: MIDLINE - 4 * SWING, max: MIDLINE + 4 * SWING },
  };

  const breaths = breathDeviations(waveform);
  const half = (b: { tPeak: number }) => pacerAt(group, from + b.tPeak);
  const pair = (inOff: number[], outOff: number[]): InhaleExhale => ({
    inhale: Math.round(mean(inOff.map(toScore))),
    exhale: Math.round(mean(outOff.map(toScore))),
  });
  const timing = pair(
    breaths.map((b) => (b.inLag / half(b)) * 100),
    breaths.map((b) => (b.outLag / half(b)) * 100),
  );
  const depth = pair(
    breaths.map((b) => b.inDepth),
    breaths.map((b) => b.outDepth),
  );
  const main: PacerHalfCycle = time[5] >= time[2] ? 5 : 2;

  const summary: SessionSummary = {
    id: sessionId,
    athleteId: profile.athleteId,
    startedAt: new Date(Date.parse(group.startedAt!) + from * 1000).toISOString(),
    durationSec: Math.round(length),
    mode: "paced",
    pacerHalfCycleSec: main,
    scores: breaths.length ? { total: combineTransitionScores(timing, depth), timing, depth, smoothness: null } : null,
    scoringVersion: SCORING_VERSIONS.transition,
    respirationRateBpm: 60 / (2 * main),
    note: "",
    waveformPath,
    appVersion: "1.1.0+52",
    groupSessionId: group.id,
  };
  return { summary, waveform };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
