import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signInAsCalm, signInAsClient, signInAsClinician, signInAsEducator, signInAsFocus } from "./auth";

// The demo plan's people (planning/v1/05, "The people in the demo"; T-0127):
// each signs in from the login page's demo buttons and lands on the Home or
// dashboard the script points at.

async function snap(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}

test("the login page offers a demo button for each of the plan's people", async ({ page }) => {
  await page.goto("/cloud/login/");
  for (const name of ["Lena Vos", "Alex Morgan", "Maya Brooks", "Sam Okafor", "Ana Ruiz", "Jordan Lee", "Chris Park"]) {
    await expect(page.getByRole("button", { name: new RegExp(`Sign in as ${name}`) })).toBeVisible({ timeout: 30_000 });
  }
});

test("Maya (Calm): her streak, Foundations under way and one milestone waiting", async ({ page }, info) => {
  await signInAsCalm(page);
  await expect(page.locator(".home")).toHaveAttribute("data-goal", "calm", { timeout: 30_000 });
  await expect(page.locator(".home-line")).toContainText(/days in a row/);
  const program = page.getByRole("region", { name: "Foundations" });
  await expect(program).toHaveAttribute("data-state", "active");
  await expect(program).toContainText("10 of 14 days done");
  await expect(program).toContainText("Day 11");
  const milestone = page.getByRole("region", { name: "New milestone" });
  await expect(milestone.locator('li[data-key="streak-7"]')).toBeVisible();
  await snap(page, info, "demo-maya");
});

test("Sam (Focus): the exam countdown and his mood check-ins", async ({ page }, info) => {
  await signInAsFocus(page);
  await expect(page.locator(".home")).toHaveAttribute("data-goal", "focus", { timeout: 30_000 });
  const week = page.getByRole("region", { name: "This week" });
  await expect(week).toContainText(/Exam (today|tomorrow|in \d+ days)\./);
  await expect(week).toContainText(/Your mood (rises|dips|holds steady)/);
  await snap(page, info, "demo-sam");
});

test("Ana (clinician): her dashboard speaks of clients, and both are there", async ({ page }, info) => {
  await signInAsClinician(page);
  await expect(page.getByRole("heading", { level: 2, name: "From your clients" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".title-row span").first()).toContainText(/2 clients$/);
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Clients" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Jordan Lee");
  await snap(page, info, "demo-ana");
});

test("Jordan (Ana's client): the From Ana card with her assigned practice", async ({ page }, info) => {
  await signInAsClient(page);
  const card = page.getByRole("region", { name: "From Ana" });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("Ana Ruiz, your clinician");
  await expect(card).toContainText("Ana has set your practice");
  await expect(page.locator(".home")).toHaveAttribute("data-goal", "calm");
  // A clinician's client is offered no program of their own.
  await expect(page.getByRole("region", { name: "Foundations" })).toHaveCount(0);
  await snap(page, info, "demo-jordan");
});

test("Chris (educator): his class of six students", async ({ page }, info) => {
  await signInAsEducator(page);
  await expect(page.getByRole("heading", { level: 2, name: "From your students" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".title-row span").first()).toContainText(/6 students$/);
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Students" })).toBeVisible();
  await snap(page, info, "demo-chris");
});
