import { describe, expect, it } from "vitest";
import {
  defaultDetails,
  goalPlanProblem,
  planDefaults,
  withOnboardingAnswers,
  type Plan,
} from "./goal-questions";
import { defaultPreferences, preferencesProblem } from "./preferences";
import type { CalmDetails, FocusDetails, TrainDetails, UserPreferences } from "./types";

const TZ = "Europe/Amsterdam";
const EVERY_DAY = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const valid = (p: UserPreferences) => {
  expect(preferencesProblem(p)).toBeNull();
  expect(goalPlanProblem(p)).toBeNull();
};

describe("Train questions and plan", () => {
  const answers: TrainDetails = { sport: "running", wants: ["recovery", "control"], trainingDays: ["tue", "thu", "sat"], trainingTime: "evening" };

  it("stores the answers under goalDetails.train, and the training days set the week and reminders", () => {
    const prefs = withOnboardingAnswers(defaultPreferences("train"), answers, null);
    expect(prefs.goalDetails).toEqual({ train: answers });
    expect(prefs.sessionsPerWeek).toBe(3);
    expect(prefs.dailyMinutes).toBe(10);
    expect(prefs.reminders).toMatchObject({ enabled: true, time: "18:30", days: ["tue", "thu", "sat"] });
    valid(prefs);
  });

  it("keeps a custom sport as free text", () => {
    const prefs = withOnboardingAnswers(defaultPreferences("train"), { ...answers, sport: "other", sportOther: "Rowing" }, null);
    expect(prefs.goalDetails?.train).toMatchObject({ sport: "other", sportOther: "Rowing" });
    valid(prefs);
  });
});

describe("Focus questions and plan", () => {
  const answers: FocusDetails = {
    stressors: ["exams", "sleep"],
    examDates: ["2027-01-12", "2027-01-19"],
    studyTimes: ["midday", "evening"],
    classTimes: ["morning", "midday"],
    moodCheckins: false,
  };

  it("stores the answers under goalDetails.focus and reminds outside class", () => {
    const prefs = withOnboardingAnswers(defaultPreferences("focus"), answers, null);
    expect(prefs.goalDetails).toEqual({ focus: answers });
    expect(prefs.sessionsPerWeek).toBe(4);
    expect(prefs.dailyMinutes).toBe(3);
    expect(prefs.reminders).toMatchObject({ enabled: true, time: "18:30", days: EVERY_DAY });
    valid(prefs);
  });
});

describe("Calm questions and plan", () => {
  const answers: CalmDetails = { hopes: ["sleep", "habit"], bestTime: "bedtime" };

  it("stores the answers under goalDetails.calm and reminds at the best time", () => {
    const prefs = withOnboardingAnswers(defaultPreferences("calm"), answers, null);
    expect(prefs.goalDetails).toEqual({ calm: answers });
    expect(prefs.sessionsPerWeek).toBe(7);
    expect(prefs.dailyMinutes).toBe(3);
    expect(prefs.reminders).toMatchObject({ enabled: true, time: "21:30", days: EVERY_DAY });
    valid(prefs);
  });
});

describe("the plan step", () => {
  it("stores what was chosen, over the defaults", () => {
    const plan: Plan = { sessionsPerWeek: 6, dailyMinutes: 15, reminders: { enabled: false, time: "07:15", days: [], timeZone: TZ } };
    const prefs = withOnboardingAnswers(defaultPreferences("calm"), null, plan);
    expect(prefs).toMatchObject({ sessionsPerWeek: 6, dailyMinutes: 15, reminders: plan.reminders });
    valid(prefs);
  });

  it("keeps everything else in the preferences as it was", () => {
    const before = { ...defaultPreferences("focus", "advanced"), onboardedAt: "2026-11-26T20:00:00.000Z" };
    const after = withOnboardingAnswers(before, null, null);
    expect(after).toMatchObject({ goal: "focus", skillLevel: "advanced", session: before.session, onboardedAt: before.onboardedAt });
  });
});

describe("defaults when skipped", () => {
  it.each([
    ["train", { train: { sport: null, wants: [], trainingDays: [], trainingTime: null } }, 5, 10, "08:00"],
    ["focus", { focus: { stressors: [], examDates: [], studyTimes: [], classTimes: [], moodCheckins: true } }, 4, 3, "18:30"],
    ["calm", { calm: { hopes: [], bestTime: null } }, 7, 3, "08:00"],
  ] as const)("%s: the track's defaults for the questions and the plan", (goal, goalDetails, perWeek, minutes, time) => {
    const prefs = withOnboardingAnswers(defaultPreferences(goal), null, null);
    expect(prefs.goalDetails).toEqual(goalDetails);
    expect(prefs.sessionsPerWeek).toBe(perWeek);
    expect(prefs.dailyMinutes).toBe(minutes);
    expect(prefs.reminders).toMatchObject({ enabled: true, time, days: EVERY_DAY });
    expect(typeof prefs.reminders?.timeZone).toBe("string");
    valid(prefs);
  });

  it("planDefaults follows the answers given so far", () => {
    expect(planDefaults("calm", { hopes: [], bestTime: "lunch" }, TZ).reminders).toEqual({ enabled: true, time: "12:30", days: EVERY_DAY, timeZone: TZ });
    expect(planDefaults("train", { ...defaultDetails("train"), trainingDays: ["mon"] }, TZ).sessionsPerWeek).toBe(2);
    expect(planDefaults("focus", { ...defaultDetails("focus"), classTimes: ["morning", "midday", "evening"] }, TZ).reminders.time).toBe("18:30");
  });
});

describe("goalPlanProblem", () => {
  const ok = withOnboardingAnswers(defaultPreferences("train"), null, null);

  it("passes preferences without any of the new fields (older profiles)", () => {
    expect(goalPlanProblem(defaultPreferences("calm"))).toBeNull();
  });

  it("refuses unknown tracks, options and repeats", () => {
    expect(goalPlanProblem({ goalDetails: { sleep: {} } as never })).toMatch(/unknown track/);
    expect(goalPlanProblem({ goalDetails: { train: { ...defaultDetails("train"), sport: "golf" as never } } })).toMatch(/sport/);
    expect(goalPlanProblem({ goalDetails: { calm: { hopes: ["sleep", "sleep"], bestTime: null } } })).toMatch(/no repeats/);
    expect(goalPlanProblem({ goalDetails: { calm: { hopes: [], bestTime: "noon" as never } } })).toMatch(/bestTime/);
  });

  it("allows at most two Train wants, and free text only with sport other", () => {
    const wants = ["recovery", "control", "calm-before"] as TrainDetails["wants"];
    expect(goalPlanProblem({ goalDetails: { train: { ...defaultDetails("train"), wants } } })).toMatch(/at most 2/);
    expect(goalPlanProblem({ goalDetails: { train: { ...defaultDetails("train"), sport: "running", sportOther: "x" } } })).toMatch(/sportOther/);
    expect(goalPlanProblem({ goalDetails: { train: { ...defaultDetails("train"), sport: "other", sportOther: "x".repeat(61) } } })).toMatch(/sportOther/);
  });

  it("checks Focus exam dates and the mood check-in", () => {
    const focus = defaultDetails("focus");
    expect(goalPlanProblem({ goalDetails: { focus: { ...focus, examDates: ["2027-02-30"] } } })).toMatch(/examDates/);
    expect(goalPlanProblem({ goalDetails: { focus: { ...focus, examDates: ["2027-01-01", "2027-01-02", "2027-01-03", "2027-01-04", "2027-01-05", "2027-01-06"] } } })).toMatch(/at most 5/);
    expect(goalPlanProblem({ goalDetails: { focus: { ...focus, moodCheckins: "yes" as never } } })).toMatch(/moodCheckins/);
  });

  it("checks daily minutes and the reminder", () => {
    expect(goalPlanProblem({ ...ok, dailyMinutes: 0 })).toMatch(/dailyMinutes/);
    expect(goalPlanProblem({ ...ok, dailyMinutes: 2.5 })).toMatch(/dailyMinutes/);
    expect(goalPlanProblem({ ...ok, reminders: { ...ok.reminders!, time: "25:00" } })).toMatch(/reminders.time/);
    expect(goalPlanProblem({ ...ok, reminders: { ...ok.reminders!, days: ["someday" as never] } })).toMatch(/reminders.days/);
    expect(goalPlanProblem({ ...ok, reminders: { ...ok.reminders!, days: [] } })).toMatch(/at least one day/);
    expect(goalPlanProblem({ ...ok, reminders: { ...ok.reminders!, enabled: false, days: [] } })).toBeNull();
    expect(goalPlanProblem({ ...ok, reminders: { ...ok.reminders!, timeZone: "" } })).toMatch(/timeZone/);
  });
});
