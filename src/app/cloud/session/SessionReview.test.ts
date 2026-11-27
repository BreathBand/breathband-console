import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { generateSignal, PACED_NORMAL_PATTERN, toRaw } from "@/lib/analysis/synth";
import { SAMPLE_RATE_HZ } from "@/lib/device/config";
import type { SessionSummary } from "@/lib/domain/types";
import { buildSession } from "@/lib/recording";
import type { Professional } from "../home/tailor";
import { resultsEmphasis } from "../results/tone";
import { CoachingPane } from "./SessionReview";

// T-0148: the person's own review passes their professional to the coaching line, as Home does.

const SCALE = { a100: 900, midline: 2050 };
const { session: built } = buildSession({
  mode: "paced",
  halfCycleS: 5,
  startedAt: new Date("2026-11-24T19:00:00Z"),
  raw: toRaw(generateSignal(PACED_NORMAL_PATTERN, { durationS: 180, sampleRateHz: SAMPLE_RATE_HZ }).user, SCALE),
  markers: [],
  calibration: SCALE,
  skillLevel: "intermediate",
  note: "",
  recorder: "simulator",
});
// Four evenings in a row, the newest reviewed.
const sessions: SessionSummary[] = [24, 23, 22, 21].map((day) => ({
  ...built,
  id: `s-${day}`,
  athleteId: "demo-jordan",
  waveformPath: "",
  startedAt: `2026-11-${day}T19:00:00.000Z`,
}));

const line = (professional: Professional | null) => {
  const html = renderToStaticMarkup(
    createElement(CoachingPane, {
      goal: "calm",
      emphasis: resultsEmphasis("calm"),
      session: sessions[0],
      sessions,
      dailyMinutes: 3,
      professional,
      turns: null,
      rates: null,
    }),
  );
  return /<p class="mc-line">([^<]*)<\/p>/.exec(html)?.[1] ?? "";
};

describe("CoachingPane: the review's coaching line knows the person's professional", () => {
  it("a clinician's client hears that their clinician will see it, never a streak", () => {
    const said = line({ name: "Ana Ruiz", kind: "clinician" });
    expect(said).toBe("Done for today. Ana will see this before your next visit.");
  });

  it("with a coach, or nobody, Calm keeps its streak line", () => {
    expect(line({ name: "Lena Vos", kind: "coach" })).toMatch(/Four days in a row/);
    expect(line(null)).toMatch(/Four days in a row/);
  });
});
