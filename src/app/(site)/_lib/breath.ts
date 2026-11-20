// Illustrative breathing signals for the public site's visuals. Nothing here
// is the app's scoring or signal processing: it draws a pacer and a plausible
// "user" line that follows it, so the site can show what a session looks like.
//
// Values run from -1 (all the way out) to +1 (all the way in).

/** Pacer position at time t (s) for `half` seconds in, `half` seconds out. Sine-eased, starts at the bottom. */
export function pacer(t: number, half: number): number {
  const period = half * 2;
  const ph = ((t % period) + period) % period;
  return -Math.cos((Math.PI * ph) / half);
}

/** Where the pacer is in its cycle: breathing in or out, and how far through that phase (0–1). */
export function pacerPhase(t: number, half: number): { inhale: boolean; progress: number; remaining: number } {
  const period = half * 2;
  const ph = ((t % period) + period) % period;
  const inhale = ph < half;
  const into = inhale ? ph : ph - half;
  return { inhale, progress: into / half, remaining: half - into };
}

export type Breather = {
  /** Seconds behind the pacer. */
  lag: number;
  /** Depth relative to the pacer (1 = as deep as asked). */
  amp: number;
  /** Fraction of the exhale phase actually used (1 = full exhale, 0.7 = cut short, then held out). */
  exhale?: number;
  /** Phase offset for the slow depth wander, so several breathers don't move in lockstep. */
  seed?: number;
  /** Small high-frequency wobble, like a real sensor line. */
  wobble?: number;
  /** Seconds of slow drift in timing, for natural, uneven breathing (keep under ~3). */
  warp?: number;
};

/** A user's line following a `half`-second pacer, and whether they're breathing in at that moment. */
export function breather(t: number, half: number, b: Breather): { y: number; inhale: boolean } {
  const seed = b.seed ?? 0;
  const period = half * 2;
  const tt = t - b.lag + (b.warp ?? 0) * Math.sin(0.29 * t + seed);
  const ph = ((tt % period) + period) % period;
  const exhaleLen = half * (b.exhale ?? 1);
  let base: number;
  let inhale: boolean;
  if (ph < half) {
    base = -Math.cos((Math.PI * ph) / half);
    inhale = true;
  } else if (ph < half + exhaleLen) {
    base = Math.cos((Math.PI * (ph - half)) / exhaleLen);
    inhale = false;
  } else {
    base = -1;
    inhale = false;
  }
  const depth = b.amp * (1 + 0.05 * Math.sin(0.43 * t + seed) + 0.035 * Math.sin(1.27 * t + seed * 2.1));
  const w = b.wobble ?? 0.018;
  const noise = w * (Math.sin(11.3 * t + seed) + 0.7 * Math.sin(17.9 * t + seed * 3.3) + 0.5 * Math.sin(29.1 * t));
  return { y: Math.max(-1.08, Math.min(1.08, base * depth + noise)), inhale };
}

export type Frame = { x0: number; x1: number; yMid: number; yAmp: number };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** SVG path for the pacer across [t0, t1]. */
export function pacerPath(t0: number, t1: number, half: number, f: Frame, step = 0.1): string {
  const span = t1 - t0;
  let d = "";
  for (let t = t0; t <= t1 + 1e-9; t += step) {
    const x = f.x0 + ((t - t0) / span) * (f.x1 - f.x0);
    const y = f.yMid - pacer(t, half) * f.yAmp;
    d += (d ? "L" : "M") + r1(x) + " " + r1(y);
  }
  return d;
}

/**
 * The user's line across [from, to], split into inhale and exhale paths so
 * they can carry their own colour. `t0`–`t1` is the full window the x axis spans.
 */
export function breatherPaths(
  from: number,
  to: number,
  t0: number,
  t1: number,
  half: number,
  b: Breather,
  f: Frame,
  step = 0.1,
): { inhale: string; exhale: string } {
  const span = t1 - t0;
  let inhale = "";
  let exhale = "";
  let prev: { x: number; y: number; inhale: boolean } | null = null;
  for (let t = from; t <= to + 1e-9; t += step) {
    const s = breather(t, half, b);
    const x = r1(f.x0 + ((t - t0) / span) * (f.x1 - f.x0));
    const y = r1(f.yMid - s.y * f.yAmp);
    if (s.inhale) {
      inhale += (prev && prev.inhale ? "L" : prev ? `M${prev.x} ${prev.y}L` : "M") + x + " " + y;
    } else {
      exhale += (prev && !prev.inhale ? "L" : prev ? `M${prev.x} ${prev.y}L` : "M") + x + " " + y;
    }
    prev = { x, y, inhale: s.inhale };
  }
  return { inhale, exhale };
}

/** Vertical grid lines every `every` seconds across a scrolling window. */
export function gridPath(t0: number, t1: number, every: number, f: Frame, top: number, bottom: number): string {
  const span = t1 - t0;
  let d = "";
  const first = Math.ceil(t0 / every) * every;
  for (let t = first; t <= t1 + 1e-9; t += every) {
    const x = r1(f.x0 + ((t - t0) / span) * (f.x1 - f.x0));
    d += `M${x} ${top}V${bottom}`;
  }
  return d;
}

export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
