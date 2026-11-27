import { expect, test } from "@playwright/test";
import { signInAsCoach } from "./auth";

// The in-room multi-person session holds two to six people: six lanes on one
// pacer, and a score card each at the end.

test("six people calibrate, breathe in six lanes, and get six cards", async ({ page }) => {
  test.setTimeout(180_000);
  await signInAsCoach(page);
  await page.goto("/cloud/record/duo/");
  await expect(page.getByRole("heading", { name: "Breathe together" })).toBeVisible();

  // Two to start, and two can't be removed.
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  const add = page.getByRole("button", { name: "Add a person" });
  for (let i = 0; i < 4; i++) await add.click();
  await expect(add).toHaveCount(0);
  await expect(page.locator(".duo-person")).toHaveCount(6);

  // Removing one brings the button back; adding again makes six.
  await page.getByRole("button", { name: "Remove User 6" }).click();
  await expect(page.locator(".duo-person")).toHaveCount(5);
  await add.click();
  await expect(page.locator(".duo-person")).toHaveCount(6);

  await page.getByRole("button", { name: "Connect all bands" }).click();
  await page.getByRole("button", { name: "Calibrate everyone" }).click();
  await expect(page.getByRole("heading", { name: "Everyone calibrated" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".duo-lane")).toHaveCount(6);
  await page.waitForTimeout(40_000);
  await page.getByRole("button", { name: "Stop" }).click();

  await expect(page.getByRole("heading", { name: "Side by side" })).toBeVisible();
  const cards = page.locator(".duo-card");
  await expect(cards).toHaveCount(6);
  await expect(cards.nth(5).getByRole("heading", { name: "User 6" })).toBeVisible();
  await expect(cards.filter({ hasText: "/10" })).toHaveCount(6);
});
