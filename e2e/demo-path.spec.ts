import { expect, test, type Page } from "@playwright/test";
import { signInAsAthlete, signInAsCoach } from "./auth";

// The investor demo path (docs/DEMO.md) against the running app, with the
// simulated band: record, score, save and review a paced and an open session
// as the athlete, then see the same numbers as their coach. Real time: the
// simulator breathes at human speed, so each recording takes about a minute.

test.describe.configure({ mode: "serial" });

async function startSimulatedBand(page: Page) {
  await page.goto("/cloud/device/");
  await page.getByRole("button", { name: "Simulated band", exact: false }).first().click();
  await page.getByRole("button", { name: "Start the simulated band" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Simulated band" })).toBeVisible({ timeout: 15_000 });
}

/** From New session through calibration to a running session. */
async function startSession(page: Page, mode: "Paced" | "Open") {
  // Navigate inside the app: a full page load would drop the band's connection, as it would for a real band.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Record" }).click();
  await page.waitForURL(/\/cloud\/record\/$/);
  await page.getByRole("button", { name: new RegExp(`^${mode} (Follow|Breathe)`) }).click();
  await page.getByRole("button", { name: "2 min", exact: true }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.waitForURL(/\/cloud\/record\/live\//);
  await expect(page.getByRole("heading", { name: "Full breaths for 20 seconds" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Calibrated" })).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.getByRole("button", { name: /Stop early/ })).toBeVisible({ timeout: 10_000 });
}

test("athlete records, saves and reviews a paced session; the coach sees the same score", async ({ page }) => {
  test.setTimeout(240_000);
  await signInAsAthlete(page);
  await expect(page.getByRole("region", { name: "Last session" })).toBeVisible();

  await startSimulatedBand(page);
  await startSession(page, "Paced");
  await page.waitForTimeout(32_000);
  await page.getByRole("button", { name: /Stop early/ }).click();

  const total = page.locator(".res-total");
  await expect(total).toBeVisible();
  const score = (await total.innerText()).replace("/10", "").trim();
  expect(Number(score)).toBeGreaterThanOrEqual(1);
  expect(Number(score)).toBeLessThanOrEqual(10);
  await expect(page.getByRole("cell", { name: /%$/ }).first()).toBeVisible();

  await page.getByLabel(/Note/).fill("Demo path: paced session recorded in the browser.");
  await page.getByRole("button", { name: "Save session" }).click();
  await page.waitForURL(/\/cloud\/session\//);
  const reviewUrl = new URL(page.url());
  await expect(page.locator(".mc-total")).toContainText(score);
  await expect(page.getByRole("heading", { name: "How close you were" })).toBeVisible();
  await expect(page.getByText("Demo path: paced session recorded in the browser.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await signInAsCoach(page);
  await page.goto(`/cloud/session/${reviewUrl.search.replace("&new=1", "")}`);
  await expect(page.locator(".mc-total")).toContainText(score);
  await expect(page.getByText("Demo path: paced session recorded in the browser.")).toBeVisible();
});

test("athlete records an open session with two markers and gets the segment metrics", async ({ page }) => {
  test.setTimeout(240_000);
  await signInAsAthlete(page);
  await startSimulatedBand(page);
  await startSession(page, "Open");
  await page.waitForTimeout(10_000);
  await page.getByRole("button", { name: /Mark a moment/ }).click();
  await page.waitForTimeout(12_000);
  await page.getByRole("button", { name: /Mark a moment/ }).click();
  await expect(page.getByRole("button", { name: /Mark a moment/ })).toBeDisabled();
  await page.waitForTimeout(12_000);
  await page.getByRole("button", { name: /Stop early/ }).click();

  await expect(page.locator(".res-total")).toContainText("br/min");
  await page.getByRole("button", { name: "Save session" }).click();
  await page.waitForURL(/\/cloud\/session\//);
  await expect(page.getByRole("heading", { name: "Around your markers" })).toBeVisible();
  for (const part of ["Before", "Between", "After"]) {
    await expect(page.getByRole("cell", { name: new RegExp(`^${part}`) })).toBeVisible();
  }
});
