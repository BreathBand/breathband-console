import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@/lib/domain/types";
import { calmLine, homeLayout, leadsWithProfessional, professionalOf, trainWeek, trendPeriod, type Professional } from "./tailor";

const coach: Professional = { name: "Lena Vos", kind: "coach" };
const clinician: Professional = { name: "Dr Ada Shaw", kind: "clinician" };

describe("homeLayout per goal", () => {
  it("Train is dense: its week card, the 8-week trend and the rate bars", () => {
    const l = homeLayout({ goal: "train", professional: null, plans: [] });
    expect(l).toMatchObject({
      density: "dense",
      week: "train",
      trendDays: 56,
      rate: true,
      streak: true,
      line: false,
      slots: [],
    });
  });

  it("Focus keeps the score and a two-week trend, drops the rate bars, and leaves room for mood and exams", () => {
    const l = homeLayout({ goal: "focus", professional: null, plans: [] });
    expect(l).toMatchObject({
      density: "standard",
      week: "standard",
      trendDays: 14,
      rate: false,
      line: false,
    });
    expect(l.slots).toEqual(["focus-mood", "focus-exams"]);
  });

  it("Calm is minimal: the habit week, one encouraging line, no trend, room for the daily ring", () => {
    const l = homeLayout({ goal: "calm", professional: null, plans: [] });
    expect(l).toMatchObject({
      density: "minimal",
      week: "habit",
      trendDays: null,
      rate: false,
      streak: true,
      line: true,
    });
    expect(l.slots).toEqual(["calm-ring"]);
  });

  it("without a goal, Home stays as it was", () => {
    expect(homeLayout({ goal: null, professional: null, plans: [] })).toMatchObject({
      density: "standard",
      week: "standard",
      trendDays: 56,
      rate: true,
      line: false,
    });
  });

  it("the three goals give three different pages", () => {
    const [t, f, c] = (["train", "focus", "calm"] as const).map((goal) => JSON.stringify(homeLayout({ goal, professional: null, plans: [] })));
    expect(new Set([t, f, c]).size).toBe(3);
  });
});

describe("the professional's card", () => {
  it("is not shown without a linked professional", () => {
    for (const goal of ["train", "focus", "calm", null] as const) {
      expect(homeLayout({ goal, professional: null, plans: [] }).professional).toBeNull();
    }
    expect(leadsWithProfessional(null, [])).toBe(false);
  });

  it("leads with the coach until the first practice they set is done", () => {
    expect(homeLayout({ goal: "train", professional: coach, plans: [] }).professional).toEqual(coach);
    expect(
      homeLayout({
        goal: "train",
        professional: coach,
        plans: [{ status: "active" }, { status: "missed" }],
      }).professional,
    ).toEqual(coach);
    expect(
      homeLayout({
        goal: "train",
        professional: coach,
        plans: [{ status: "active" }, { status: "done" }],
      }).professional,
    ).toBeNull();
  });

  it("always leads with a clinician, and turns the streak off", () => {
    const l = homeLayout({
      goal: "calm",
      professional: clinician,
      plans: [{ status: "done" }],
    });
    expect(l.professional).toEqual(clinician);
    expect(l.streak).toBe(false);
  });

  it("a coach doesn't turn the streak off, even after their card stops leading", () => {
    expect(
      homeLayout({
        goal: "calm",
        professional: coach,
        plans: [{ status: "done" }],
      }).streak,
    ).toBe(true);
  });

  it("comes from the linked coach's name", () => {
    expect(professionalOf("Lena Vos")).toEqual(coach);
    expect(professionalOf(undefined)).toBeNull();
    expect(professionalOf("")).toBeNull();
  });

  it("reads the linked professional's kind when their profile has one", () => {
    expect(professionalOf("Niamh Byrne", "clinician")).toEqual({ name: "Niamh Byrne", kind: "clinician" });
    expect(professionalOf("Owen Hart", "educator")).toEqual({ name: "Owen Hart", kind: "educator" });
    expect(professionalOf("Lena Vos", null)).toEqual(coach);
    expect(professionalOf(undefined, "clinician")).toBeNull();
  });
});

describe("trendPeriod", () => {
  it("names the trend's window", () => {
    expect(trendPeriod(56)).toBe("last 8 weeks");
    expect(trendPeriod(14)).toBe("last 2 weeks");
    expect(trendPeriod(7)).toBe("last 1 week");
    expect(trendPeriod(10)).toBe("last 10 days");
  });
});

describe("trainWeek", () => {
  // Thursday 26 November 2026, mid-afternoon; the week started Monday the 23rd.
  const now = new Date("2026-11-26T15:00:00");
  let n = 0;
  const paced = (iso: string, depthIn: number, depthOut: number) =>
    ({
      id: `p${++n}`,
      startedAt: new Date(iso).toISOString(),
      mode: "paced",
      respirationRateBpm: 6,
      scores: {
        total: 7,
        timing: { inhale: 7, exhale: 7 },
        depth: { inhale: depthIn, exhale: depthOut },
        smoothness: null,
      },
    }) as SessionSummary;
  const open = (iso: string, rate: number | null) =>
    ({
      id: `o${++n}`,
      startedAt: new Date(iso).toISOString(),
      mode: "open",
      respirationRateBpm: rate,
      scores: null,
    }) as SessionSummary;

  it("counts sessions since Monday against the plan", () => {
    const w = trainWeek([paced("2026-11-26T08:00:00", 7, 7), open("2026-11-24T08:00:00", 14), paced("2026-11-22T08:00:00", 7, 7)], now, 5);
    expect(w.done).toBe(2);
    expect(w.planned).toBe(5);
  });

  it("averages open sessions' rate over the last 7 days, ignoring paced ones and missing rates", () => {
    const w = trainWeek(
      [
        open("2026-11-26T08:00:00", 13),
        open("2026-11-22T08:00:00", 14.4),
        open("2026-11-21T08:00:00", null),
        open("2026-11-10T08:00:00", 20),
        paced("2026-11-25T08:00:00", 7, 7),
      ],
      now,
      4,
    );
    expect(w.avgRate).toBe(13.7);
  });

  it("has no average rate without an open session this week", () => {
    expect(trainWeek([paced("2026-11-25T08:00:00", 7, 7)], now, 4).avgRate).toBeNull();
  });

  it("gives this week's depth and its change on the week before", () => {
    const w = trainWeek(
      [paced("2026-11-26T08:00:00", 8, 7), paced("2026-11-23T08:00:00", 7, 8), paced("2026-11-17T08:00:00", 6, 7), paced("2026-11-14T08:00:00", 7, 6)],
      now,
      4,
    );
    expect(w.depth).toBe(7.5);
    expect(w.depthChange).toBe(1);
  });

  it("has no depth change when the week before has no paced session", () => {
    const w = trainWeek([paced("2026-11-26T08:00:00", 8, 7)], now, 4);
    expect(w.depth).toBe(7.5);
    expect(w.depthChange).toBeNull();
  });
});

describe("calmLine", () => {
  it("praises a run of days once today's session is done", () => {
    expect(calmLine({ streakDays: 3, doneToday: true, minutes: 3, streak: true })).toBe("Nice. Three days in a row.");
    expect(calmLine({ streakDays: 12, doneToday: true, minutes: 3, streak: true })).toBe("Nice. 12 days in a row.");
  });

  it("says done for a first day", () => {
    expect(calmLine({ streakDays: 1, doneToday: true, minutes: 3, streak: true })).toBe("Done for today. Nice.");
  });

  it("encourages keeping a run going when today is still to do", () => {
    expect(calmLine({ streakDays: 2, doneToday: false, minutes: 3, streak: true })).toBe("Two days in a row. Three minutes today keeps it going.");
    expect(calmLine({ streakDays: 1, doneToday: false, minutes: 5, streak: true })).toBe("Yesterday's done. Five minutes today makes two days in a row.");
  });

  it("is gentle after a gap", () => {
    expect(calmLine({ streakDays: 0, doneToday: false, minutes: 3, streak: true })).toBe("Your next session takes three minutes.");
    expect(calmLine({ streakDays: 0, doneToday: false, minutes: 0, streak: true })).toBe("Your next session takes a few minutes.");
  });

  it("never counts days in a row when the streak is off", () => {
    expect(calmLine({ streakDays: 5, doneToday: true, minutes: 3, streak: false })).toBe("Done for today. Nice.");
    expect(calmLine({ streakDays: 5, doneToday: false, minutes: 3, streak: false })).toBe("Your next session takes three minutes.");
  });
});
