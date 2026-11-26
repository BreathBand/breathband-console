import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signInAsAthlete } from "./auth";

// Focus's mood check-in (J6): five faces before Begin and on the results; the
// change joins Focus's results line and the trend sits in Home's Focus slot.
// Maya's goal is Focus and her check-in is on (the default); Alex trains and
// is never asked. Real time: the simulated band breathes at human speed.

const DB_KEY = "breathband-console:local-db";
const MAYA = "demo-athlete-4";

async function signInAsMaya(page: Page) {
  await page.goto("/cloud/login/");
  await page.getByRole("button", { name: /Sign in as Maya Chen/ }).click({ timeout: 30_000 });
  await page.waitForURL((url) => !url.pathname.startsWith("/cloud/login"), { timeout: 60_000 });
}

async function startSimulatedBand(page: Page) {
  await page.goto("/cloud/device/");
  await page.getByRole("button", { name: "Simulated band", exact: false }).first().click();
  await page.getByRole("button", { name: "Start the simulated band" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Simulated band" })).toBeVisible({ timeout: 15_000 });
}

/** New session to the Calibrated step, inside the app so the band stays connected. */
async function toCalibrated(page: Page) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Record" }).click();
  await page.waitForURL(/\/cloud\/record\/$/);
  await page.getByRole("button", { name: /^Paced Follow/ }).click();
  await page.getByRole("button", { name: "2 min", exact: true }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.waitForURL(/\/cloud\/record\/live\//);
  await expect(page.getByRole("heading", { name: "Calibrated" })).toBeVisible({ timeout: 120_000 });
}

async function snap(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}

test("a Focus session asks the mood before and after, and the change shows on the results and Home", async ({ page }, info) => {
  test.setTimeout(360_000);
  await signInAsMaya(page);

  // Home's Focus slot: the trend from Maya's check-ins of the last two weeks.
  const week = page.getByRole("region", { name: "This week" });
  await expect(week).toContainText(/Your mood (rises|dips|holds steady)/, { timeout: 30_000 });
  await expect(week.getByRole("img", { name: /^Before and after, oldest first/ })).toBeVisible();

  // An exam ahead puts the countdown beside it (exam dates come from onboarding; set here directly).
  const exam = new Date(Date.now() + 10 * 86_400_000);
  const examDate = `${exam.getFullYear()}-${String(exam.getMonth() + 1).padStart(2, "0")}-${String(exam.getDate()).padStart(2, "0")}`;
  await page.evaluate(
    ([key, uid, date]) => {
      const db = JSON.parse(localStorage.getItem(key)!);
      db.accounts[uid].profile.preferences.goalDetails = {
        focus: { stressors: ["exams"], examDates: [date], studyTimes: [], classTimes: [], moodCheckins: true },
      };
      localStorage.setItem(key, JSON.stringify(db));
    },
    [DB_KEY, MAYA, examDate] as const,
  );
  await page.reload();
  await expect(week).toContainText(/Exam in 1[01] days\./, { timeout: 30_000 });
  await snap(page, info, "home-focus-mood");

  // Before: five faces on the Calibrated step; Begin works with or without one.
  await startSimulatedBand(page);
  await toCalibrated(page);
  const before = page.getByRole("group", { name: "Before you begin, how do you feel?" });
  await expect(before.getByRole("button")).toHaveCount(5);
  await before.getByRole("button", { name: "low, 2 of 5" }).click();
  await expect(before.getByRole("button", { name: "low, 2 of 5" })).toHaveAttribute("aria-pressed", "true");
  await snap(page, info, "mood-before");
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.getByRole("button", { name: /Stop early/ })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(32_000);
  await page.getByRole("button", { name: /Stop early/ }).click();

  // After: the line names no change until both moods exist, then names it.
  await expect(page.locator(".inst-results")).toHaveAttribute("data-goal", "focus");
  const line = page.locator(".res-line");
  await expect(line).not.toContainText("Mood");
  const after = page.getByRole("group", { name: "And now, how do you feel?" });
  await after.getByRole("button", { name: "good, 4 of 5" }).click();
  await expect(line).toContainText("Mood up from low to good.");
  await snap(page, info, "mood-after-results");

  // Saved with the session: both check-ins carry the new session's id.
  await page.getByRole("button", { name: "Save session" }).click();
  await page.waitForURL(/\/cloud\/session\//);
  const sessionId = new URL(page.url()).searchParams.get("id");
  expect(sessionId).toBeTruthy();
  const stored = await page.evaluate(
    ([key, uid]) => JSON.parse(localStorage.getItem(key)!).moodCheckins[uid] as { sessionId: string | null; phase: string; mood: number }[],
    [DB_KEY, MAYA] as const,
  );
  const mine = stored.filter((c) => c.sessionId === sessionId);
  expect(mine.map((c) => [c.phase, c.mood]).sort()).toEqual([
    ["after", 4],
    ["before", 2],
  ]);
});

test("a Train session never asks the mood", async ({ page }, info) => {
  test.setTimeout(240_000);
  await signInAsAthlete(page);
  await expect(page.getByRole("region", { name: "This week" })).not.toContainText(/mood/i, { timeout: 30_000 });
  await startSimulatedBand(page);
  await toCalibrated(page);
  await expect(page.getByRole("group", { name: /how do you feel/ })).toHaveCount(0);
  await snap(page, info, "train-calibrated");
});
