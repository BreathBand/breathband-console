import type { Waveform } from "./types";

// Display geometry for a recorded signal. These are measurements for the
// chart and the breath table, not scores: scores come from the app.

export interface WaveFrame {
  /** Samples per second. */
  hz: number;
  /** Seconds. */
  duration: number;
  /** The zero line: the pacer's centre in paced sessions, the signal's mean in open ones. */
  midline: number;
  /** Half the visible height, in signal units, so the trace fills the chart without clipping. */
  range: number;
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / (values.length || 1);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function waveFrame(waveform: Waveform): WaveFrame {
  const hz = 1000 / waveform.sampleIntervalMs;
  const midline = mean(waveform.pacer ?? waveform.user);
  // A high percentile rather than the maximum, so one spike doesn't flatten the trace.
  const spread = waveform.user.map((v) => Math.abs(v - midline)).sort((a, b) => a - b);
  let range = spread[Math.floor(spread.length * 0.98)] ?? 0;
  if (waveform.pacer) {
    range = Math.max(range, ...waveform.pacer.map((v) => Math.abs(v - midline)));
  }
  return { hz, duration: waveform.user.length / hz, midline, range: range * 1.15 || 1 };
}

/** How one breath differed from the pacer. */
export interface BreathDeviation {
  /** 1-based, counted from the first pacer peak. */
  n: number;
  /** Seconds into the session of the pacer's peak (end of the inhale) and trough (end of the exhale). */
  tPeak: number;
  tTrough: number;
  /** Seconds between the user's turning point and the pacer's. Positive = late, negative = early. */
  inLag: number;
  outLag: number;
  /** How far the user's peak (trough) reached compared with the pacer's, in %. Positive = deeper. */
  inDepth: number;
  outDepth: number;
}

/**
 * Pairs each pacer peak with the next trough and finds the user's matching
 * turning points within a quarter cycle either side. Empty for open sessions.
 */
export function breathDeviations(waveform: Waveform, frame: WaveFrame = waveFrame(waveform)): BreathDeviation[] {
  const { pacer, user } = waveform;
  if (!pacer || pacer.length < 3) return [];
  const { hz, midline } = frame;

  const turns: { i: number; peak: boolean }[] = [];
  for (let i = 1; i < pacer.length - 1; i++) {
    if (pacer[i] > pacer[i - 1] && pacer[i] >= pacer[i + 1]) turns.push({ i, peak: true });
    else if (pacer[i] < pacer[i - 1] && pacer[i] <= pacer[i + 1]) turns.push({ i, peak: false });
  }
  if (turns.length < 2) return [];

  const gaps = turns.slice(1).map((t, k) => t.i - turns[k].i).sort((a, b) => a - b);
  const reach = Math.max(1, Math.floor(gaps[Math.floor(gaps.length / 2)] / 2));

  const userTurn = (at: number, peak: boolean) => {
    let best = at;
    for (let j = Math.max(0, at - reach); j <= Math.min(user.length - 1, at + reach); j++) {
      if (peak ? user[j] > user[best] : user[j] < user[best]) best = j;
    }
    return best;
  };

  const out: BreathDeviation[] = [];
  for (let k = 0; k < turns.length - 1; k++) {
    const top = turns[k];
    const bottom = turns[k + 1];
    if (!top.peak || bottom.peak) continue;
    const pacerUp = pacer[top.i] - midline;
    const pacerDown = midline - pacer[bottom.i];
    if (pacerUp <= 0 || pacerDown <= 0) continue;

    const ui = userTurn(top.i, true);
    const uo = userTurn(bottom.i, false);
    out.push({
      n: out.length + 1,
      tPeak: top.i / hz,
      tTrough: bottom.i / hz,
      inLag: round1((ui - top.i) / hz),
      outLag: round1((uo - bottom.i) / hz),
      inDepth: Math.round(((user[ui] - midline) / pacerUp - 1) * 100),
      outDepth: Math.round(((midline - user[uo]) / pacerDown - 1) * 100),
    });
  }
  return out;
}
