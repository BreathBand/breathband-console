import { expect, test } from "@playwright/test";
import { signInAsAthlete } from "./auth";

// Settings → Your data: download everything, the access log, and deletion with
// 24 hours to change your mind (C6, C7, C10). Local backend.

test("Alex downloads their data, asks for deletion, then signs back in and keeps the account", async ({ page }) => {
  await signInAsAthlete(page);
  await page.goto("/cloud/account/#data");
  const data = page.getByRole("region", { name: "Your data" });
  await expect(data.getByText(/Nobody you share with has opened a session yet|opened a session/).first()).toBeVisible({ timeout: 30_000 });

  const download = page.waitForEvent("download");
  await data.getByRole("button", { name: "Download my data" }).click();
  expect((await download).suggestedFilename()).toMatch(/^breathband-data-\d{4}-\d{2}-\d{2}\.json$/);

  await data.getByRole("button", { name: "Delete my account…" }).click();
  await data.getByLabel("Your password, to confirm").fill("wrong-password");
  await data.getByRole("button", { name: "Delete my account" }).click();
  await expect(data.getByText("That password isn't right.")).toBeVisible();

  await data.getByLabel("Your password, to confirm").fill("breathband");
  await data.getByRole("button", { name: "Delete my account" }).click();
  await page.waitForURL((u) => u.pathname === "/cloud/");
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);

  await signInAsAthlete(page);
  await expect(page.getByRole("heading", { name: "Your account is set to be deleted" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Keep my account" }).click();
  await expect(page.getByRole("heading", { name: "Your account is set to be deleted" })).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Sign out" }).first()).toBeVisible();
});
