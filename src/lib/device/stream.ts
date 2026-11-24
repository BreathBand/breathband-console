import { SAMPLE_RATE_HZ } from "./config";
import type { Sample } from "./types";

/**
 * The numbers in one notification. The app reads each notification as one
 * trimmed number; this also accepts several separated by newlines, commas or
 * semicolons, in case the firmware batches them. Anything that isn't a finite
 * number is dropped, as the app does.
 */
export function parseNotification(text: string): number[] {
  return text
    .split(/[\r\n,;]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

/**
 * Samples the latest reading at a fixed rate, the way the app does with its
 * 50 ms timer, so a sample exists every tick however the band batches its
 * notifications. Missed ticks (a busy or backgrounded tab) are caught up from
 * the wall clock, holding the last value.
 */
export class SampleClock {
  private latest: number | null = null;
  private emitted = 0;
  private startedAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly emit: (sample: Sample) => void,
    private readonly now: () => number = () => performance.now(),
    private readonly rateHz = SAMPLE_RATE_HZ,
  ) {}

  /** The newest reading from the band. Nothing is emitted until the first one arrives. */
  hold(value: number): void {
    if (this.latest === null && this.timer === null) return;
    if (this.latest === null) this.startedAt = this.now();
    this.latest = value;
  }

  start(): void {
    if (this.timer !== null) return;
    this.latest = null;
    this.emitted = 0;
    this.timer = setInterval(() => this.tick(), 1000 / this.rateHz);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.latest = null;
  }

  /** Emits every sample that is due by now. Public so tests can drive the clock. */
  tick(): void {
    if (this.latest === null) return;
    const due = Math.floor(((this.now() - this.startedAt) * this.rateHz) / 1000) + 1;
    for (; this.emitted < due; this.emitted++) this.emit({ n: this.emitted, value: this.latest });
  }
}
