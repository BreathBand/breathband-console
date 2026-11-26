import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signInAsAthlete } from "./auth";

// The habit on Home (planning/v1/01 §3.8, J1–J3): Calm's daily ring, the
// streak that pauses kindly instead of being lost, and milestones shown once.
// The goal is switched in Settings, as a person would.

const DB_KEY = "breathband-console:local-db";

async function chooseGoal(page: Page, goal: "Train" | "Focus" | "Calm") {
  await page.goto("/cloud/account/");
  const radio = page.getByRole("radiogroup", { name: "Your goal" }).getByRole("radio", { name: new RegExp(goal) });
  await radio.click();
  await expect(radio).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.goto("/cloud/");
  await expect(page.getByRole("region", { name: "Last session" })).toBeVisible();
}

async function snap(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}

/** Drops the signed-in athlete's sessions from the last `days` days, so the streak has two missed days behind it. */
async function stepAway(page: Page, days: number) {
  await page.evaluate(
    ([key, days]) => {
      const db = JSON.parse(localStorage.getItem(key)!);
      const cutoff = new Date();
      cutoff.setHours(0, 0, 0, 0);
      cutoff.setDate(cutoff.getDate() - days + 1);
      const uid = db.currentUid;
      db.sessions[uid] = db.sessions[uid].filter((s: { startedAt: string }) => Date.parse(s.startedAt) < cutoff.getTime());
      localStorage.setItem(key, JSON.stringify(db));
    },
    [DB_KEY, days] as const,
  );
}

test("Calm's Home shows the daily ring, and new milestones once", async ({ page }, info) => {
  test.setTimeout(120_000);
  await signInAsAthlete(page);
  const week = page.getByRole("region", { name: "This week" });
  const milestones = page.getByRole("region", { name: /New milestones?/ });

  // Alex starts on Train: the ring and milestones are Calm's (02 §5.1).
  await expect(page.locator(".home")).toHaveAttribute("data-goal", "train");
  await expect(page.locator(".home-ring")).toHaveCount(0);
  await expect(milestones).toHaveCount(0);

  await chooseGoal(page, "Calm");
  await expect(week.locator(".home-ring")).toBeVisible();
  await expect(week.locator(".home-ring")).toContainText(/Today\s*\d+ of \d+ min/);
  // Alex's history has earned these; they show on this visit...
  await expect(milestones).toBeVisible();
  await expect(milestones).toContainText("First calibration");
  await expect(milestones).toContainText("First paced session");
  await snap(page, info, "habit-calm-ring-milestones");

  // ...and never again.
  await page.reload();
  await expect(page.getByRole("region", { name: "Last session" })).toBeVisible();
  await expect(week.locator(".home-ring")).toBeVisible();
  await expect(milestones).toHaveCount(0);
});

test("a streak pauses after two missed days, in the goal's words and without red", async ({ page }, info) => {
  test.setTimeout(120_000);
  await signInAsAthlete(page);
  await expect(page.getByRole("region", { name: "Last session" })).toBeVisible();
  await stepAway(page, 3);

  await chooseGoal(page, "Calm");
  const week = page.getByRole("region", { name: "This week" });
  await expect(week.locator(".home-paused")).toHaveText("Paused");
  await expect(week).toContainText("Your streak paused. Start today to pick it back up.");
  await expect(week).not.toContainText(/lost/i);
  // Ink, not the danger red.
  const color = await week.locator(".home-paused-line").evaluate((el) => getComputedStyle(el).color);
  const danger = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--c-danger)";
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
  expect(color).not.toBe(danger);
  await snap(page, info, "habit-calm-paused");

  await chooseGoal(page, "Train");
  await expect(week).toContainText("Streak paused. Back at it today.");
  await snap(page, info, "habit-train-paused");

  // On a phone the ring and the paused streak fit; the page never scrolls sideways.
  await chooseGoal(page, "Calm");
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(week.locator(".home-ring")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await snap(page, info, "habit-calm-375");
});
