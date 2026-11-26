import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signInAsAthlete } from "./auth";

// The athlete's Home follows their goal (planning/v1/02 §5.1): Train is dense
// with its week numbers and the rate bars, Focus keeps the score over two
// weeks, Calm is minimal with one encouraging line. The goal is switched in
// Settings, as a person would.

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
  // Panes fade in; settle them so the picture shows the page, not the transition.
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}

test("Home differs for Train, Focus and Calm", async ({ page }, info) => {
  test.setTimeout(120_000);
  await signInAsAthlete(page);
  const home = page.locator(".home");
  const week = page.getByRole("region", { name: "This week" });

  // Alex's goal is Train: the week card's numbers, the 8-week trend and the rate bars.
  await expect(page.getByRole("region", { name: "Last session" })).toBeVisible();
  await expect(home).toHaveAttribute("data-goal", "train");
  await expect(week).toContainText("Average rate");
  await expect(week).toContainText("Depth");
  await expect(week).toContainText("planned");
  await expect(page.getByRole("heading", { name: "Total Breath Score, last 8 weeks" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Breathing rate, open sessions" })).toBeVisible();
  await expect(page.locator(".home-line")).toHaveCount(0);
  await snap(page, info, "home-train");

  // Focus: the score over two weeks, no rate bars, the standard week facts.
  await chooseGoal(page, "Focus");
  await expect(home).toHaveAttribute("data-goal", "focus");
  await expect(page.getByRole("heading", { name: "Total Breath Score, last 2 weeks" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Breathing rate, open sessions" })).toHaveCount(0);
  await expect(week).toContainText("Last 5 paced");
  await expect(week).not.toContainText("Average rate");
  await snap(page, info, "home-focus");

  // Calm: minimal, one encouraging line, no trend.
  await chooseGoal(page, "Calm");
  await expect(home).toHaveAttribute("data-goal", "calm");
  await expect(page.locator(".home-line")).toHaveText(/days in a row|Done for today|Your next session takes/);
  await expect(page.getByRole("heading", { name: /Total Breath Score/ })).toHaveCount(0);
  await expect(week).toContainText("Streak");
  await expect(week).not.toContainText("Last 5 paced");
  await expect(week).not.toContainText("Average rate");
  await snap(page, info, "home-calm");
});

// Maya is linked to Lena, who hasn't set her any practice yet: Lena's card leads her Home.
test("someone linked to a professional sees their card first", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto("/cloud/login/");
  await page.getByRole("button", { name: /Sign in as Maya Chen/ }).click({ timeout: 30_000 });
  await page.waitForURL((url) => !url.pathname.startsWith("/cloud/login"), { timeout: 60_000 });

  const card = page.getByRole("region", { name: "From Lena" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Lena Vos, your coach");
  await expect(page.locator(".home")).toHaveAttribute("data-goal", "focus");
  // The side pane's "From your coach" gives way to the card.
  await expect(page.getByRole("heading", { name: "From your coach" })).toHaveCount(0);
  await snap(page, info, "home-professional");

  // On a phone the card wraps; the page never scrolls sideways.
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(card).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await snap(page, info, "home-professional-375");
});
