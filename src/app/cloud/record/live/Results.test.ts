import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { generateSignal, PACED_NORMAL_PATTERN, toRaw } from "@/lib/analysis/synth";
import { SAMPLE_RATE_HZ } from "@/lib/device/config";
import { buildSession } from "@/lib/recording";
import { Results } from "./Results";

// T-0148: the results after Stop pass the person's professional to the coaching line, as Home does.

const SCALE = { a100: 900, midline: 2050 };
const built = buildSession({
  mode: "paced",
  halfCycleS: 5,
  startedAt: new Date("2026-11-24T10:00:00Z"),
  raw: toRaw(generateSignal(PACED_NORMAL_PATTERN, { durationS: 180, sampleRateHz: SAMPLE_RATE_HZ }).user, SCALE),
  markers: [],
  calibration: SCALE,
  skillLevel: "intermediate",
  note: "",
  recorder: "simulator",
});

const line = (professional?: { name: string; kind: "coach" | "clinician" | "educator" } | null) => {
  const html = renderToStaticMarkup(
    createElement(Results, {
      built,
      tooShort: false,
      title: "Paced 5-5",
      goal: "calm",
      streakDays: 4,
      professional,
      onSave: async () => {},
      onDiscard: () => {},
      onRestart: () => {},
    }),
  );
  return /<p class="res-line">([^<]*)<\/p>/.exec(html)?.[1] ?? "";
};

describe("Results: the coaching line knows the person's professional", () => {
  it("a clinician's client hears that their clinician will see it, never a streak", () => {
    const said = line({ name: "Ana Ruiz", kind: "clinician" });
    expect(said).toContain("Ana will see this before your next visit.");
    expect(said).not.toMatch(/days in a row/);
  });

  it("a coach's athlete and someone with nobody linked keep Calm's streak line", () => {
    expect(line({ name: "Lena Vos", kind: "coach" })).toMatch(/Four days in a row/);
    expect(line(null)).toMatch(/Four days in a row/);
  });
});
