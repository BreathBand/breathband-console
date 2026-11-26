import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@/lib/domain/types";
import { ownWords, streakDays } from "./AthleteHome";

const at = (iso: string) => ({ startedAt: iso }) as SessionSummary;

describe("ownWords", () => {
  it("turns a coach's flag into the athlete's own words", () => {
    expect(ownWords("Breathing rate 16.1/min, above their 12–16 range")).toBe("Breathing rate 16.1/min, above your 12–16 range");
    expect(ownWords("5 of the last 5 under their target of 7")).toBe("5 of the last 5 under your target of 7");
  });

  it("leaves words that only contain 'their' alone", () => {
    expect(ownWords("theirs")).toBe("theirs");
  });
});

describe("streakDays", () => {
  const now = new Date("2026-11-24T15:00:00");

  it("counts consecutive days back from today", () => {
    // T-0113: one missed day is now a rest day that holds the streak, so the older session sits two missed days back.
    expect(streakDays([at("2026-11-24T08:00:00"), at("2026-11-23T08:00:00"), at("2026-11-22T20:00:00"), at("2026-11-19T08:00:00")], now)).toBe(3);
  });

  it("still counts from yesterday when there's no session yet today", () => {
    expect(streakDays([at("2026-11-23T08:00:00"), at("2026-11-22T08:00:00")], now)).toBe(2);
  });

  it("is zero after a missed day", () => {
    expect(streakDays([at("2026-11-21T08:00:00")], now)).toBe(0);
  });
});
