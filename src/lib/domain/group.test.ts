import { describe, expect, it } from "vitest";
import {
  describeGroupAverage,
  describePacer,
  formatDepth,
  formatLag,
  liveRead,
  pacerAt,
  pacerCue,
  pacerPhase,
  pacerValue,
} from "./group";
import type { GroupSession } from "./types";
import type { BreathDeviation } from "./waveform";

type PacerPlan = Pick<GroupSession, "pacerHalfCycleSec" | "pacerChanges">;

const steady: PacerPlan = { pacerHalfCycleSec: 5, pacerChanges: [] };

const deviation = (lag: number, depth: number): BreathDeviation => ({
  n: 1,
  tPeak: 5,
  tTrough: 10,
  inLag: lag,
  outLag: lag,
  inDepth: depth,
  outDepth: depth,
});

describe("pacerAt", () => {
  const plan: PacerPlan = { pacerHalfCycleSec: 5, pacerChanges: [{ atSec: 30, pacerHalfCycleSec: 2 }] };

  it("keeps the starting pacer until the switch", () => {
    expect(pacerAt(plan, 0)).toBe(5);
    expect(pacerAt(plan, 29.9)).toBe(5);
  });

  it("switches at atSec inclusive", () => {
    expect(pacerAt(plan, 30)).toBe(2);
    expect(pacerAt(plan, 90)).toBe(2);
  });
});

describe("pacerPhase", () => {
  it("adds π per half cycle on a steady pacer", () => {
    expect(pacerPhase(steady, 0)).toBe(0);
    expect(pacerPhase(steady, 5)).toBeCloseTo(Math.PI);
    expect(pacerPhase(steady, 12.5)).toBeCloseTo(2.5 * Math.PI);
  });

  it("accumulates across two switches given out of order", () => {
    const plan: PacerPlan = {
      pacerHalfCycleSec: 5,
      pacerChanges: [
        { atSec: 16, pacerHalfCycleSec: 5 },
        { atSec: 10, pacerHalfCycleSec: 2 },
      ],
    };
    expect(pacerPhase(plan, 10)).toBeCloseTo((Math.PI * 10) / 5);
    expect(pacerPhase(plan, 14)).toBeCloseTo((Math.PI * 10) / 5 + (Math.PI * 4) / 2);
    expect(pacerPhase(plan, 20)).toBeCloseTo((Math.PI * 10) / 5 + (Math.PI * 6) / 2 + (Math.PI * 4) / 5);
  });
});

describe("pacerValue", () => {
  it("starts fully out and is fully in after one half cycle", () => {
    expect(pacerValue(steady, 0)).toBe(-1);
    expect(pacerValue(steady, 5)).toBeCloseTo(1);
  });
});

describe("pacerCue", () => {
  it("is 'in' with the full half cycle left at the start", () => {
    expect(pacerCue(steady, 0)).toEqual({ dir: "in", secondsLeft: 5 });
  });

  it("is 'out' just after a half cycle", () => {
    const cue = pacerCue(steady, 5.01);
    expect(cue.dir).toBe("out");
    expect(cue.secondsLeft).toBeCloseTo(4.99);
  });
});

describe("liveRead", () => {
  it("is settling with no breath yet", () => {
    expect(liveRead(undefined, 4)).toEqual({ state: "settling", text: "Settling in" });
  });

  it("is shallow when depth falls below -33", () => {
    expect(liveRead(deviation(0, -34), 4)).toEqual({ state: "shallow", text: "Shallow" });
    expect(liveRead(deviation(0, -33), 4).state).toBe("with");
  });

  it("is late or early only strictly beyond a quarter of the half cycle", () => {
    expect(liveRead(deviation(1.1, 0), 4)).toEqual({ state: "late", text: "Behind the pacer" });
    expect(liveRead(deviation(-1.1, 0), 4)).toEqual({ state: "early", text: "Ahead of the pacer" });
  });

  it("is with the pacer exactly at a quarter of the half cycle", () => {
    expect(liveRead(deviation(1, 0), 4)).toEqual({ state: "with", text: "With the pacer" });
    expect(liveRead(deviation(-1, 0), 4)).toEqual({ state: "with", text: "With the pacer" });
  });
});

describe("formatLag", () => {
  it("signs the lag with one decimal", () => {
    expect(formatLag(0.4)).toBe("+0.4 s");
    expect(formatLag(-0.2)).toBe("−0.2 s");
    expect(formatLag(0)).toBe("±0.0 s");
    expect(formatLag(-0.04)).toBe("±0.0 s");
  });
});

describe("formatDepth", () => {
  it("signs the depth as a whole percent", () => {
    expect(formatDepth(3)).toBe("+3%");
    expect(formatDepth(-8)).toBe("−8%");
    expect(formatDepth(0)).toBe("±0%");
  });
});

describe("describeGroupAverage", () => {
  it("shows a dash until there is an average", () => {
    expect(describeGroupAverage(null)).toBe("–");
  });

  it("formats the average like a score", () => {
    expect(describeGroupAverage(7.5)).toBe("7.5");
    expect(describeGroupAverage(6)).toBe("6");
  });
});

describe("describePacer", () => {
  it("names the pacer with no switch", () => {
    expect(describePacer(steady)).toBe("5-5");
  });

  it("names both pacers after one switch", () => {
    expect(describePacer({ pacerHalfCycleSec: 5, pacerChanges: [{ atSec: 60, pacerHalfCycleSec: 2 }] })).toBe("5-5 → 2-2");
  });
});
