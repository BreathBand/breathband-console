import { expect, test, type Page } from "@playwright/test";

// T-0106: each track asks its own questions after the goal, then the plan
// step; the answers are stored in the profile's preferences.

const DB_KEY = "breathband-console:local-db";

async function signUp(page: Page, name: string): Promise<string> {
  const email = `${name.toLowerCase()}${Date.now()}@example.com`;
  await page.goto("/cloud/signup/");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).first().fill("breathe-easy-123");
  await page.getByLabel("Year of birth").fill("1999");
  await page.getByLabel(/terms of use/).check();
  await page.getByLabel(/breathing data/).check();
  await page.getByRole("button", { name: /Create/ }).click();
  await page.waitForURL(/\/cloud\/welcome\//, { timeout: 60_000 });
  await page.getByRole("button", { name: "Continue" }).click();
  return email;
}

const next = (page: Page) => page.getByRole("button", { name: "Continue" }).click();
const pick = (page: Page, question: string, option: string) =>
  page.getByRole("group", { name: question, exact: true }).getByRole("button", { name: option, exact: true }).click();

/** Experience, sessions and band, unchanged by this card. */
async function throughToDone(page: Page) {
  await page.getByRole("radio", { name: /Some practice/ }).click();
  await next(page);
  await expect(page.getByRole("heading", { name: "Your sessions" })).toBeVisible();
  await next(page);
}

async function finish(page: Page, email: string) {
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: /You're ready/ })).toBeVisible();
  await page.getByRole("button", { name: "Go to my home" }).click();
  await page.waitForURL((url) => url.pathname === "/cloud/");
  return page.evaluate(
    ([key, address]) => {
      const db = JSON.parse(globalThis.localStorage.getItem(key) ?? "{}");
      return Object.values(db.accounts as Record<string, { profile: { email: string; preferences: unknown } }>).find(
        (a) => a.profile.email === address,
      )?.profile.preferences;
    },
    [DB_KEY, email] as const,
  );
}

test("Train: sport, wants and training days shape the plan and are stored", async ({ page }) => {
  test.setTimeout(120_000);
  const email = await signUp(page, "Kai");
  await page.getByRole("radio", { name: /Train/ }).click();
  await next(page);

  await expect(page.getByRole("heading", { name: "Your training" })).toBeVisible();
  await pick(page, "What's your sport or activity?", "Something else");
  await page.getByLabel("Your sport or activity").fill("Rowing");
  await pick(page, "What do you want from your breathing?", "Recovery after training");
  await pick(page, "What do you want from your breathing?", "Control under effort");
  await expect(page.getByRole("button", { name: "Calm before competition" })).toBeDisabled();
  for (const day of ["Tue", "Thu", "Sat"]) await pick(page, "Days", day);
  await pick(page, "Time of day", "Evening");
  await next(page);

  await throughToDone(page);
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Sessions a week" }).getByRole("button", { name: "3" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Minutes a day" }).getByRole("button", { name: "10 min" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Reminder time")).toHaveValue("18:30");
  await page.getByRole("group", { name: "Minutes a day" }).getByRole("button", { name: "15 min" }).click();
  await page.getByLabel("Reminder time").fill("17:45");
  await next(page);

  const prefs = await finish(page, email);
  expect(prefs).toMatchObject({
    goal: "train",
    goalDetails: { train: { sport: "other", sportOther: "Rowing", wants: ["recovery", "control"], trainingDays: ["tue", "thu", "sat"], trainingTime: "evening" } },
    sessionsPerWeek: 3,
    dailyMinutes: 15,
    reminders: { enabled: true, time: "17:45", days: ["tue", "thu", "sat"] },
  });
});

test("Focus: exam dates, study and class times and the mood check-in are stored", async ({ page }) => {
  test.setTimeout(120_000);
  const email = await signUp(page, "Noor");
  await page.getByRole("radio", { name: /Focus/ }).click();
  await next(page);

  await expect(page.getByRole("heading", { name: "Your studies" })).toBeVisible();
  await pick(page, "When does stress get in the way?", "Exams and tests");
  await pick(page, "When does stress get in the way?", "Falling asleep");
  const year = new Date().getFullYear() + 1;
  for (const date of [`${year}-01-19`, `${year}-01-12`]) {
    await page.getByLabel("Exam date", { exact: true }).fill(date);
    await page.getByRole("button", { name: "Add date" }).click();
  }
  await expect(page.getByRole("list", { name: "Exams added" }).getByRole("listitem")).toHaveCount(2);
  await pick(page, "Study", "Evening");
  await pick(page, "In class", "Morning");
  await pick(page, "In class", "Midday");
  await pick(page, "Mood check-in", "No");
  await next(page);

  await throughToDone(page);
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await page.getByRole("group", { name: "Reminders" }).getByRole("button", { name: "Off" }).click();
  await expect(page.getByLabel("Reminder time")).toHaveCount(0);
  await next(page);

  const prefs = await finish(page, email);
  expect(prefs).toMatchObject({
    goal: "focus",
    goalDetails: {
      focus: { stressors: ["exams", "sleep"], examDates: [`${year}-01-12`, `${year}-01-19`], studyTimes: ["evening"], classTimes: ["morning", "midday"], moodCheckins: false },
    },
    sessionsPerWeek: 4,
    dailyMinutes: 3,
    reminders: { enabled: false, time: "18:30" },
  });
});

test("Calm, skipping both steps: the track's defaults are stored", async ({ page }) => {
  test.setTimeout(120_000);
  const email = await signUp(page, "Ada");
  await page.getByRole("radio", { name: /Calm/ }).click();
  await next(page);

  await pick(page, "What are you hoping for?", "Better sleep");
  await page.getByRole("button", { name: "Skip these" }).click();
  await throughToDone(page);
  await page.getByRole("group", { name: "Minutes a day" }).getByRole("button", { name: "20 min" }).click();
  await page.getByRole("button", { name: "Use the defaults" }).click();

  const prefs = await finish(page, email);
  expect(prefs).toMatchObject({
    goal: "calm",
    goalDetails: { calm: { hopes: [], bestTime: null } },
    sessionsPerWeek: 7,
    dailyMinutes: 3,
    reminders: { enabled: true, time: "08:00", days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] },
  });
});
