import { expect, test } from "@playwright/test";

// A new athlete signs up, goes through setup, and their choices shape the app:
// the goal sets New session's defaults and the home page says what it is.
test("a new athlete is set up by onboarding and their goal sets their sessions", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/cloud/signup/");
  await page.getByLabel("Name").fill("Jordan Lee");
  await page.getByLabel("Email").fill(`jordan${Date.now()}@example.com`);
  await page.getByLabel(/^Password/).first().fill("breathe-easy-123");
  await page.getByLabel("Year of birth").fill("1996");
  await page.getByLabel(/terms of use/).check();
  await page.getByLabel(/breathing data/).check();
  await page.getByRole("button", { name: /Create/ }).click();

  await page.waitForURL(/\/cloud\/welcome\//, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Welcome to Breathband." })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: /Calm/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /New to it/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Your sessions" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Go to my home" }).click();

  await page.waitForURL((url) => url.pathname === "/cloud/");
  await expect(page.getByText("Goal:")).toContainText("Calm");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Record" }).click();
  await page.waitForURL(/\/cloud\/record\/$/);
  await expect(page.getByRole("button", { name: /^Open Breathe/ })).toHaveAttribute("aria-pressed", "true");
});
