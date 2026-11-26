import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signInAsAthlete } from "./auth";

// The results after a session follow the person's goal (planning/v1/02 §5.1,
// "Results emphasis" and "Coaching line"): Train sees every number and a
// numbers-first line; Calm sees the headline, its word, one tip and a line
// about showing up, with the numbers folded away. Same band, same scoring.
// Real time: the simulated band breathes at human speed.

async function chooseGoal(page: Page, goal: "Train" | "Focus" | "Calm") {
  await page.goto("/cloud/account/");
  const radio = page.getByRole("radiogroup", { name: "Your goal" }).getByRole("radio", { name: new RegExp(goal) });
  await radio.click();
  await expect(radio).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
}

async function startSimulatedBand(page: Page) {
  await page.goto("/cloud/device/");
  await page.getByRole("button", { name: "Simulated band", exact: false }).first().click();
  await page.getByRole("button", { name: "Start the simulated band" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Simulated band" })).toBeVisible({ timeout: 15_000 });
}

/** A short paced session, from New session to the results. */
async function recordPaced(page: Page) {
  // Navigate inside the app: a full page load would drop the band's connection.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Record" }).click();
  await page.waitForURL(/\/cloud\/record\/$/);
  await page.getByRole("button", { name: /^Paced Follow/ }).click();
  await page.getByRole("button", { name: "2 min", exact: true }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.waitForURL(/\/cloud\/record\/live\//);
  await expect(page.getByRole("heading", { name: "Full breaths for 20 seconds" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Calibrated" })).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.getByRole("button", { name: /Stop early/ })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(32_000);
  await page.getByRole("button", { name: /Stop early/ }).click();
  await expect(page.locator(".res-total")).toBeVisible();
}

async function snap(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}

test("the results differ for Train and Calm: what leads, and the coaching line", async ({ page }, info) => {
  test.setTimeout(360_000);
  await signInAsAthlete(page);
  await expect(page.getByRole("region", { name: "Last session" })).toBeVisible();

  // Alex's goal is Train: every number open, and a numbers-first line about the weakest part.
  await startSimulatedBand(page);
  await recordPaced(page);
  const results = page.locator(".inst-results");
  await expect(results).toHaveAttribute("data-goal", "train");
  await expect(page.getByRole("cell", { name: /%$/ }).first()).toBeVisible();
  await expect(page.getByRole("row", { name: /^Timing/ })).toBeVisible();
  await expect(page.locator(".res-more")).toHaveCount(0);
  await expect(page.locator(".res-tip")).toHaveCount(0);
  const trainLine = await page.locator(".res-line").innerText();
  expect(trainLine).toMatch(/^((Inhale|Exhale) (timing|depth) \d+(\.\d)?\. .+|Total \d+(\.\d)?\. Every part at 9 or above\.)$/);
  await snap(page, info, "results-train");

  // Saved, the review keeps every number and puts the same line under the score.
  await page.getByRole("button", { name: "Save session" }).click();
  await page.waitForURL(/\/cloud\/session\//);
  await expect(page.getByRole("heading", { name: "How close you were" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Coaching" })).toContainText(/(timing|depth|Total) \d/);
  await expect(page.locator(".mc")).not.toHaveAttribute("data-folded", /.*/);
  await snap(page, info, "review-train");

  // Calm: the headline and its word, one tip, a line about showing up; the numbers folded away.
  await chooseGoal(page, "Calm");
  await startSimulatedBand(page);
  await recordPaced(page);
  await expect(results).toHaveAttribute("data-goal", "calm");
  await expect(page.locator(".res-word")).toContainText("Total Breath Score");
  const calmLine = await page.locator(".res-line").innerText();
  // "Done for today" only once the ring's minutes are met (T-0138); before that, what finishes today.
  expect(calmLine).toMatch(
    /^(Nice\. \w+ days in a row\.|Done for today\. Nice\.|Done\. \w+ days in a row\.|Done for today\.|(Good start|That's a start|\w+ days in a row)\. (\w+ more minutes|A minute or less) finishes today\.)$/,
  );
  expect(calmLine).not.toBe(trainLine);
  await expect(page.locator(".res-tip")).toHaveText(/^(Next time, .+|Same again next time\.)$/);
  await expect(page.locator(".res-more")).not.toHaveAttribute("open", /.*/);
  await expect(page.getByRole("row", { name: /^Timing/ })).toBeHidden();
  await snap(page, info, "results-calm");

  // The numbers are one click away, unchanged.
  await page.getByText("All the numbers").click();
  await expect(page.getByRole("row", { name: /^Timing/ })).toBeVisible();

  await page.getByRole("button", { name: "Save session" }).click();
  await page.waitForURL(/\/cloud\/session\//);
  await expect(page.locator(".mc")).toHaveAttribute("data-folded", "true");
  await expect(page.getByRole("region", { name: "Coaching" })).toContainText(calmLine);
  await expect(page.getByRole("heading", { name: "How close you were" })).toBeHidden();
  await snap(page, info, "review-calm");

  // On a phone the folded review never scrolls sideways.
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await snap(page, info, "review-calm-375");
});
