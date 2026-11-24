import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calibrate, toPctOfMax } from "../analysis/calibration";
import { analyzeOpenRecording, analyzePacedRecording } from "../analysis/session";
import { BAND_COMMANDS, SAMPLE_RATE_HZ, STRAP_TENSION } from "./config";
import { SIM_SCALE, SimulatedBand } from "./simulated";
import { parseNotification, SampleClock } from "./stream";
import type { SimPersona } from "./types";

describe("parseNotification", () => {
  it("reads one number per notification, as the app does", () => {
    expect(parseNotification(" 2048.5 ")).toEqual([2048.5]);
    expect(parseNotification("2048\n")).toEqual([2048]);
  });

  it("reads several numbers when the firmware batches them", () => {
    expect(parseNotification("2040\r\n2051\n2060")).toEqual([2040, 2051, 2060]);
    expect(parseNotification("1;2,3")).toEqual([1, 2, 3]);
  });

  it("drops anything that isn't a finite number", () => {
    expect(parseNotification("ready\nNaN\n12\nInfinity")).toEqual([12]);
    expect(parseNotification("")).toEqual([]);
  });
});

describe("SampleClock", () => {
  it("emits nothing until the first reading, then holds the latest value at 20 Hz", () => {
    let now = 0;
    const out: number[] = [];
    const clock = new SampleClock((s) => out.push(s.value), () => now);
    clock.start();
    clock.tick();
    expect(out).toEqual([]);
    clock.hold(5);
    clock.tick();
    expect(out).toEqual([5]);
    now = 100;
    clock.hold(7);
    clock.tick();
    expect(out).toEqual([5, 7, 7]);
    clock.stop();
  });

  it("catches up missed ticks from the wall clock", () => {
    let now = 0;
    const ns: number[] = [];
    const clock = new SampleClock((s) => ns.push(s.n), () => now);
    clock.start();
    clock.hold(1);
    now = 1000;
    clock.tick();
    expect(ns).toHaveLength(SAMPLE_RATE_HZ + 1);
    expect(ns[ns.length - 1]).toBe(SAMPLE_RATE_HZ);
    clock.stop();
  });

  it("ignores readings while stopped", () => {
    const out: number[] = [];
    const clock = new SampleClock((s) => out.push(s.value), () => 0);
    clock.hold(3);
    clock.tick();
    expect(out).toEqual([]);
  });
});

describe("SimulatedBand", () => {
  let now = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    now = 0;
  });
  afterEach(() => vi.useRealTimers());

  async function connected(persona: SimPersona = "steady") {
    const band = new SimulatedBand(11, () => now);
    band.setPersona(persona);
    const samples: number[] = [];
    band.subscribe((s) => samples.push(s.value));
    const ready = band.connect();
    await vi.advanceTimersByTimeAsync(1000);
    await ready;
    const run = (seconds: number) => {
      now += seconds * 1000;
      band.tick();
    };
    return { band, samples, run };
  }

  it("connects, reports a battery level and streams at 20 Hz", async () => {
    const { band, samples, run } = await connected();
    expect(band.status().state).toBe("connected");
    expect(band.status().battery).toBeGreaterThan(0);
    run(10);
    expect(samples).toHaveLength(10 * SAMPLE_RATE_HZ + 1);
    await band.disconnect();
    expect(band.status().state).toBe("disconnected");
  });

  it("settles inside the strap-tension band once the strap is tightened", async () => {
    const { samples, run } = await connected();
    run(12);
    const settled = samples.slice(-4 * SAMPLE_RATE_HZ);
    const mean = settled.reduce((a, b) => a + b, 0) / settled.length;
    expect(samples[0]).toBeLessThan(STRAP_TENSION.min);
    expect(mean).toBeGreaterThan(STRAP_TENSION.min);
    expect(mean).toBeLessThan(STRAP_TENSION.max);
  });

  it("takes deep breaths on the calibration command, which calibrate() turns into the sensor's scale", async () => {
    const { band, samples, run } = await connected();
    run(6);
    const from = samples.length;
    await band.send(BAND_COMMANDS.calibrate);
    run(40);
    const result = calibrate(samples.slice(from), SAMPLE_RATE_HZ);
    expect(result).not.toBeNull();
    expect(result!.a100).toBeGreaterThan(SIM_SCALE.a100 * 0.85);
    expect(result!.a100).toBeLessThan(SIM_SCALE.a100 * 1.1);
    expect(Math.abs(result!.midline - SIM_SCALE.midline)).toBeLessThan(SIM_SCALE.a100 * 0.05);
  });

  async function pacedSession(persona: SimPersona) {
    const { band, samples, run } = await connected(persona);
    run(6);
    const start = samples.length;
    band.follow({ inhaleS: 5, exhaleS: 5, startN: start });
    run(180);
    const pct = toPctOfMax(samples.slice(start, start + 180 * SAMPLE_RATE_HZ), SIM_SCALE);
    return analyzePacedRecording(pct, SAMPLE_RATE_HZ, { halfCycleS: 5, skillLevel: "intermediate" });
  }

  it("following a 5-5 pacer steadily scores well with method C", async () => {
    const result = await pacedSession("steady");
    expect(result.scores.total).toBeGreaterThanOrEqual(8);
    expect(result.counts.missed).toBeLessThanOrEqual(1);
  });

  it("a shallow persona loses depth points but keeps timing", async () => {
    const steady = await pacedSession("steady");
    const shallow = await pacedSession("shallow");
    const depth = (r: typeof steady) => (r.scores.depth.inhale + r.scores.depth.exhale) / 2;
    const timing = (r: typeof steady) => (r.scores.timing.inhale + r.scores.timing.exhale) / 2;
    expect(depth(shallow)).toBeLessThan(depth(steady) - 2);
    expect(timing(shallow)).toBeGreaterThanOrEqual(timing(steady) - 1);
  });

  it("breathes at a normal open-session rate at rest", async () => {
    const { samples, run } = await connected();
    run(6);
    const start = samples.length;
    run(120);
    const pct = toPctOfMax(samples.slice(start), SIM_SCALE);
    const result = analyzeOpenRecording(pct, SAMPLE_RATE_HZ);
    expect(result.whole.metrics?.rateBpm).toBeGreaterThan(11);
    expect(result.whole.metrics?.rateBpm).toBeLessThan(17);
  });
});
