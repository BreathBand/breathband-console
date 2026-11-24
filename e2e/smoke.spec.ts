import { expect, test } from "@playwright/test";
import { signInAsAthlete, signInAsCoach } from "./auth";

test("the coach signs in and sees the Athletes roster", async ({ page }) => {
  await signInAsCoach(page);
  await expect(page).toHaveURL((url) => url.pathname === "/cloud/");

  await page.goto("/cloud/athletes/");
  await expect(page.getByRole("heading", { level: 1, name: "Athletes" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Athletes" })).toBeVisible();
});

test("the athlete signs in and sees their latest Total Breath Score", async ({ page }) => {
  await signInAsAthlete(page);
  await expect(page).toHaveURL((url) => url.pathname === "/cloud/");

  await expect(page.getByRole("region", { name: "Latest Total Breath Score" })).toBeVisible();
});
