import { gaussian, mulberry32, OPEN_NORMAL_PATTERN, PACER_AMPLITUDE_PCT } from "../analysis/synth";
import { BAND_COMMANDS, SAMPLE_RATE_HZ, STRAP_TENSION } from "./config";
import type { Sample, SignalSource, SimPacer, SimPersona, SourceStatus } from "./types";

interface Knot {
  readonly t: number;
  readonly level: number;
  readonly kind: "peak" | "trough";
}

type Mode = { kind: "rest" } | { kind: "calibrate"; left: number } | { kind: "follow"; pacer: SimPacer };

/** Raw scale of the simulated sensor: a 12-bit-style reading with the strap at a good tension. */
export const SIM_SCALE = { a100: 900, midline: (STRAP_TENSION.min + STRAP_TENSION.max) / 2 } as const;
/** Where the reading sits before the strap is tightened. */
const SLACK_LEVEL = 1150;
const TIGHTEN_S = 3.5;
const CONNECT_MS = 900;
/** Deep breaths of ±50 % of max with little scatter, so the simulator's calibration lands on SIM_SCALE. */
const CALIBRATION = { breaths: 5, inhaleS: 3, exhaleS: 4, peakPct: 50, scatterPct: 0.4 } as const;

const PERSONAS: Record<SimPersona, { shiftS: number; depth: number; rate: number; timingSd: number; ampSd: number }> = {
  steady: { shiftS: 0, depth: 1, rate: 1, timingSd: 0.12, ampSd: 0.25 },
  early: { shiftS: -0.9, depth: 1, rate: 1, timingSd: 0.12, ampSd: 0.25 },
  shallow: { shiftS: 0, depth: 0.5, rate: 1, timingSd: 0.15, ampSd: 0.2 },
  deep: { shiftS: 0, depth: 1.8, rate: 1, timingSd: 0.15, ampSd: 0.35 },
  rushed: { shiftS: 0, depth: 1, rate: 1.25, timingSd: 0.15, ampSd: 0.3 },
  distracted: { shiftS: 0, depth: 1, rate: 1, timingSd: 0.25, ampSd: 0.4 },
};

/** Distracted: the simulated user loses the rhythm for a stretch, then finds it again. */
const LOST = { afterS: 40, forS: 18 } as const;

/**
 * A band that isn't there: a simulated user breathing, delivered as raw sensor
 * readings on the same 20 Hz clock and through the same interface as the real
 * band. It tightens its strap on connect, takes deep breaths when told to
 * calibrate, breathes normally at rest, and follows the pacer during a paced
 * session in the chosen persona, so a demo can show good and faulty breathing
 * without hardware.
 */
export class SimulatedBand implements SignalSource {
  readonly kind = "simulated" as const;
  private listeners = new Set<(s: Sample) => void>();
  private statusListeners = new Set<(s: SourceStatus) => void>();
  private current: SourceStatus = { state: "idle", deviceName: "Simulated band", battery: null };
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private emitted = 0;
  private knots: Knot[] = [];
  private mode: Mode = { kind: "rest" };
  private persona: SimPersona = "steady";
  private followFromS = 0;
  private readonly noise: () => number;
  private readonly jitter: () => number;

  constructor(seed = 7, private readonly now: () => number = () => performance.now()) {
    this.noise = gaussian(mulberry32(seed));
    this.jitter = gaussian(mulberry32(seed + 1));
  }

  status(): SourceStatus {
    return this.current;
  }

  onStatus(listener: (s: SourceStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  subscribe(listener: (s: Sample) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(): Promise<void> {
    if (this.timer !== null) return;
    this.setStatus({ state: "connecting" });
    await new Promise((r) => setTimeout(r, CONNECT_MS));
    this.startedAt = this.now();
    this.emitted = 0;
    this.knots = [{ t: 0, level: -OPEN_NORMAL_PATTERN.peakPct, kind: "trough" }];
    this.mode = { kind: "rest" };
    this.timer = setInterval(() => this.tick(), 1000 / SAMPLE_RATE_HZ);
    this.setStatus({ state: "connected", battery: 86 });
  }

  async disconnect(): Promise<void> {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.setStatus({ state: "disconnected", battery: null, message: undefined });
  }

  async send(command: string): Promise<void> {
    if (command.trim() === BAND_COMMANDS.calibrate) {
      this.retarget({ kind: "calibrate", left: CALIBRATION.breaths });
    }
  }

  /** How the simulated user breathes from now on. */
  setPersona(persona: SimPersona): void {
    this.persona = persona;
    this.retarget(this.mode);
  }

  getPersona(): SimPersona {
    return this.persona;
  }

  /** Follow a pacer (paced session) or breathe freely (null). */
  follow(pacer: SimPacer | null): void {
    this.followFromS = this.elapsedS();
    this.retarget(pacer ? { kind: "follow", pacer } : { kind: "rest" });
  }

  /** Emits every sample due by now. Public so tests can drive the clock. */
  tick(): void {
    const due = Math.floor(((this.now() - this.startedAt) * SAMPLE_RATE_HZ) / 1000) + 1;
    for (; this.emitted < due; this.emitted++) {
      const sample = { n: this.emitted, value: this.valueAt(this.emitted / SAMPLE_RATE_HZ) };
      for (const l of this.listeners) l(sample);
    }
  }

  private elapsedS(): number {
    return this.emitted / SAMPLE_RATE_HZ;
  }

  private setStatus(patch: Partial<SourceStatus>): void {
    this.current = { ...this.current, ...patch };
    for (const l of this.statusListeners) l(this.current);
  }

  /** Keeps the breath in progress and replans everything after it. */
  private retarget(mode: Mode): void {
    this.mode = mode;
    const t = this.elapsedS();
    const next = this.knots.findIndex((k) => k.t > t);
    if (next >= 0) this.knots = this.knots.slice(0, next + 1);
  }

  private valueAt(t: number): number {
    while (this.knots[this.knots.length - 1].t <= t) this.knots.push(this.nextKnot(this.knots[this.knots.length - 1]));
    if (this.knots.length > 64) this.knots = this.knots.slice(-8);
    let j = this.knots.length - 2;
    while (j > 0 && this.knots[j].t > t) j--;
    const a = this.knots[j];
    const b = this.knots[j + 1];
    const x = (t - a.t) / (b.t - a.t);
    const pct = a.level + ((b.level - a.level) * (1 - Math.cos(Math.PI * x))) / 2 + 0.06 * this.noise();
    const tension = SLACK_LEVEL + (SIM_SCALE.midline - SLACK_LEVEL) * Math.min(1, t / TIGHTEN_S) ** 0.6;
    if (this.lost(t)) return tension + (pct + 9 * this.noise()) * (SIM_SCALE.a100 / 100);
    return tension + (pct / 100) * SIM_SCALE.a100;
  }

  private lost(t: number): boolean {
    if (this.persona !== "distracted" || this.mode.kind !== "follow") return false;
    const into = t - this.followFromS;
    return into >= LOST.afterS && into < LOST.afterS + LOST.forS;
  }

  private nextKnot(last: Knot): Knot {
    const p = PERSONAS[this.persona];
    const kind = last.kind === "peak" ? "trough" : "peak";
    const sign = kind === "peak" ? 1 : -1;
    const mode = this.mode;

    if (mode.kind === "calibrate") {
      if (kind === "trough" && mode.left <= 1) this.mode = { kind: "rest" };
      else if (kind === "trough") this.mode = { kind: "calibrate", left: mode.left - 1 };
      const half = kind === "peak" ? CALIBRATION.inhaleS : CALIBRATION.exhaleS;
      return { t: last.t + half, level: sign * (CALIBRATION.peakPct + CALIBRATION.scatterPct * this.jitter()), kind };
    }

    if (mode.kind === "follow" && p.rate === 1) {
      const { pacer } = mode;
      const cycle = pacer.inhaleS + pacer.exhaleS;
      const start = pacer.startN / SAMPLE_RATE_HZ + p.shiftS;
      const offset = kind === "peak" ? pacer.inhaleS : 0;
      let k = Math.ceil((last.t + 0.6 - start - offset) / cycle);
      if (start + offset + k * cycle <= last.t) k++;
      const t = start + offset + k * cycle + p.timingSd * this.jitter();
      const level = sign * (PACER_AMPLITUDE_PCT * p.depth + p.ampSd * this.jitter());
      return { t: Math.max(t, last.t + 0.3), level, kind };
    }

    const base =
      mode.kind === "follow"
        ? { inhaleS: mode.pacer.inhaleS, exhaleS: mode.pacer.exhaleS, peakPct: PACER_AMPLITUDE_PCT }
        : OPEN_NORMAL_PATTERN;
    const half = (kind === "peak" ? base.inhaleS : base.exhaleS) / p.rate;
    const t = last.t + Math.max(0.4, half + p.timingSd * this.jitter());
    return { t, level: sign * (base.peakPct * p.depth + p.ampSd * this.jitter()), kind };
  }
}
