import { describe, expect, it } from "vitest";
import { generateSignal, OPEN_NORMAL_PATTERN, PACED_NORMAL_PATTERN, withDepth } from "@/lib/analysis/synth";
import { depthText, openTurns, pacedTurn, timingText } from "./BreathLine";

const RATE = 20;

describe("pacedTurn", () => {
  const signal = generateSignal(PACED_NORMAL_PATTERN, { durationS: 60, sampleRateHz: RATE }).user;

  it("finds the top of the breath at the pacer's peak, on time and on depth", () => {
    const turn = pacedTurn(signal, 1, 5, RATE)!;
    expect(turn.kind).toBe("peak");
    expect(Math.abs(turn.dt!)).toBeLessThan(0.2);
    expect(Math.abs(turn.depth)).toBeLessThan(0.2);
  });

  it("finds the bottom of the breath at the pacer's trough", () => {
    expect(pacedTurn(signal, 2, 5, RATE)!.kind).toBe("trough");
  });

  it("waits until the turn's window has passed", () => {
    expect(pacedTurn(signal.slice(0, 5 * RATE), 1, 5, RATE)).toBeNull();
  });

  it("reports a shallow breath as shallower", () => {
    const shallow = generateSignal(withDepth(PACED_NORMAL_PATTERN, 0.5), { durationS: 30, sampleRateHz: RATE }).user;
    expect(pacedTurn(shallow, 1, 5, RATE)!.depth).toBeLessThan(-1);
  });

  it("reports turning early as a negative time", () => {
    const early = generateSignal({ ...PACED_NORMAL_PATTERN, shiftS: -1 }, { durationS: 30, sampleRateHz: RATE }).user;
    expect(pacedTurn(early, 3, 5, RATE)!.dt).toBeLessThan(-0.5);
  });
});

describe("openTurns", () => {
  it("tags each breath with its depth and length", () => {
    const signal = generateSignal(OPEN_NORMAL_PATTERN, { durationS: 30, sampleRateHz: RATE }).user;
    const turns = openTurns(signal, 0, RATE);
    expect(turns.length).toBeGreaterThanOrEqual(5);
    const later = turns.filter((t) => t.breathS !== null);
    for (const t of later) {
      expect(t.breathS).toBeCloseTo(4.5, 0);
      expect(t.depth).toBeCloseTo(6, 0);
    }
  });
});

describe("tag words", () => {
  it("says on time and on depth near zero", () => {
    expect(timingText(0.1)).toBe("on time");
    expect(depthText(-0.3)).toBe("on depth");
  });

  it("says which way and by how much otherwise", () => {
    expect(timingText(-0.42)).toBe("0.4 s early");
    expect(timingText(0.6)).toBe("0.6 s late");
    expect(depthText(1.24)).toBe("1.2% deeper");
    expect(depthText(-0.8)).toBe("0.8% shallower");
  });
});
