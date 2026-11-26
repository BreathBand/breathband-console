import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signInAsAthlete } from "./auth";

const DB_KEY = "breathband-console:local-db";

// One program, Foundations (J5): Calm's Home offers it, enrolling puts day 1
// one tap from the instrument, and the day done shows as progress back on
// Home. Real time: the simulated band breathes at human speed.

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

test("enrol in Foundations from Home, do day 1 on the simulated band, see 1 of 14", async ({ page }, info) => {
  test.setTimeout(300_000);
  await signInAsAthlete(page);
  const program = page.getByRole("region", { name: "Foundations" });

  // Alex trains: Foundations is there, offered quietly.
  await expect(page.locator(".home")).toHaveAttribute("data-goal", "train");
  await expect(program).toHaveAttribute("data-state", "offer");
  await expect(program).not.toHaveAttribute("data-promoted");

  // Calm promotes it.
  await chooseGoal(page, "Calm");
  await expect(program).toHaveAttribute("data-promoted", "true");
  await expect(program).toContainText("Program · 14 days");
  await snap(page, info, "program-offer-calm");

  await program.getByRole("button", { name: "Start Foundations" }).click();
  await expect(program).toHaveAttribute("data-state", "active");
  await expect(program).toContainText("0 of 14 days done");
  await expect(program).toContainText("Day 1 · Just breathe");
  await expect(program).toContainText("Open · 3 min.");
  await snap(page, info, "program-day-1");

  // One tap: the instrument with day 1's preset.
  await program.getByRole("link", { name: "Start day 1" }).click();
  await page.waitForURL(/\/cloud\/record\/live\/\?/);
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject({ mode: "open", len: "180", program: "foundations", day: "1" });

  await page.getByRole("button", { name: "Start the simulated band" }).click();
  await expect(page.getByRole("heading", { name: "Calibrated" })).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.getByRole("button", { name: /Stop early/ })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(32_000);
  await page.getByRole("button", { name: /Stop early/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();
  await page.waitForURL(/\/cloud\/session\//);

  // Back Home inside the app: day 1 done, day 2 previewed for tomorrow.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home" }).click();
  await expect(program).toContainText("1 of 14 days done");
  await expect(program).toContainText("Day 1 done. Day 2 opens tomorrow.");
  await expect(program).toContainText("Day 2 · Notice the breath");
  await expect(program.getByRole("link", { name: /Start day/ })).toHaveCount(0);
  await snap(page, info, "program-1-of-14");

  // Stored, not just on screen; and on a phone the card wraps without sideways scroll.
  await page.reload();
  await expect(program).toContainText("1 of 14 days done");
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(program).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await snap(page, info, "program-375");
});

test("a Settings change made without a reload keeps the program", async ({ page }, info) => {
  test.setTimeout(120_000);
  await signInAsAthlete(page);
  await chooseGoal(page, "Calm");
  const program = page.getByRole("region", { name: "Foundations" });
  await program.getByRole("button", { name: "Start Foundations" }).click();
  await expect(program).toContainText("0 of 14 days done");

  // Inside the app, no reload: Settings works from the profile it was handed.
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name: "Settings" }).click();
  await page.waitForURL(/\/cloud\/account\//);
  await expect(page.getByRole("radiogroup", { name: "Your goal" })).toBeVisible();
  // A milestone shown elsewhere meanwhile, written straight to storage: what the http
  // adapter's never-refreshed sign-in profile looks like to Settings.
  await page.evaluate((key) => {
    const db = JSON.parse(localStorage.getItem(key)!);
    const prefs = db.accounts[db.currentUid].profile.preferences;
    prefs.gamification = { ...prefs.gamification, awarded: { ...prefs.gamification?.awarded, "streak-30": "2026-11-26T08:00:00.000Z" } };
    localStorage.setItem(key, JSON.stringify(db));
  }, DB_KEY);

  const weekly = page.getByRole("button", { name: "6", exact: true });
  await weekly.click();
  await expect(weekly).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  // Settings stored its change and nothing it didn't make was lost.
  const stored = await page.evaluate((key) => {
    const db = JSON.parse(localStorage.getItem(key)!);
    return db.accounts[db.currentUid].profile.preferences;
  }, DB_KEY);
  expect(stored).toMatchObject({ sessionsPerWeek: 6, gamification: { program: { id: "foundations" }, awarded: { "streak-30": "2026-11-26T08:00:00.000Z" } } });

  await nav.getByRole("link", { name: "Home" }).click();
  await expect(program).toHaveAttribute("data-state", "active");
  await expect(program).toContainText("0 of 14 days done");
  await page.reload();
  await expect(program).toContainText("0 of 14 days done");
  await snap(page, info, "program-after-settings");
});
