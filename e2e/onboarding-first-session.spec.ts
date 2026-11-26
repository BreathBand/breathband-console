import { expect, test, type Page } from "@playwright/test";

// T-0115: with a band in hand, onboarding ends in the ritual: strap fit →
// calibration → the track's first suggested session → its score, back to back,
// never via Home or the New session page (planning/v1/02 §3.1, order rule).
// Real time: the simulated band breathes at human speed.

const next = (page: Page) => page.getByRole("button", { name: "Continue" }).click();

/** Sign up and answer onboarding up to the band step, on the given track. */
async function toBandStep(page: Page, name: string, track: "Train" | "Calm", answer?: () => Promise<void>) {
  const email = `${name.toLowerCase()}${Date.now()}@example.com`;
  await page.goto("/cloud/signup/");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).first().fill("breathe-easy-123");
  await page.getByLabel("Year of birth").fill("1996");
  await page.getByLabel(/terms of use/).check();
  await page.getByLabel(/breathing data/).check();
  await page.getByRole("button", { name: /Create/ }).click();
  await page.waitForURL(/\/cloud\/welcome\//, { timeout: 60_000 });

  await next(page);
  await page.getByRole("radio", { name: new RegExp(track) }).click();
  await next(page);
  if (answer) {
    await answer();
    await next(page);
  } else {
    await page.getByRole("button", { name: "Skip these" }).click();
  }
  await next(page); // experience
  await expect(page.getByRole("heading", { name: "Your sessions" })).toBeVisible();
  await next(page);
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await next(page);
  await expect(page.getByRole("heading", { name: "Your band" })).toBeVisible();
}

/** Choose the simulated band, connect it in the band step and reach the done step. */
async function simulatedBandToDone(page: Page) {
  const routes = page.getByRole("radiogroup", { name: "How you'll breathe with Breathband" });
  await routes.getByRole("radio", { name: /Simulated band/ }).click();
  await page.getByRole("button", { name: "Start the simulated band" }).click();
  await expect(page.getByText(/Simulated band connected/)).toBeVisible({ timeout: 15_000 });
  await next(page);
  await expect(page.getByRole("heading", { name: /You're ready/ })).toBeVisible();
}

/** Every address the tab shows, client-side navigations included. */
function trackPaths(page: Page): string[] {
  const paths: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) paths.push(new URL(frame.url()).pathname);
  });
  return paths;
}

test("Train on the simulated band: onboarding → fit → calibrate → first session → results, in one run", async ({ page }) => {
  test.setTimeout(300_000);
  const paths = trackPaths(page);
  await toBandStep(page, "Noor", "Train", () =>
    page
      .getByRole("group", { name: "What do you want from your breathing?", exact: true })
      .getByRole("button", { name: "Recovery after training", exact: true })
      .click(),
  );
  await simulatedBandToDone(page);

  // The done step names the session that comes next.
  await expect(page.getByText("Post-training Downshift · Paced 5-5 · 3 min, after a strap check and calibration")).toBeVisible();
  await page.getByRole("button", { name: "Start my first session" }).click();

  // Straight to the instrument with the suggested settings.
  await page.waitForURL(/\/cloud\/record\/live\/\?/);
  const q = new URL(page.url()).searchParams;
  expect(Object.fromEntries(q)).toMatchObject({ mode: "paced", pacer: "5", len: "180", first: "post-training-downshift" });
  await expect(page.locator(".inst-title")).toContainText("Post-training Downshift");
  await expect(page.locator(".inst-title")).toContainText("Your first session · Paced 5-5 · 3:00");

  // Fit, then calibration on its own once the strap reads good; it takes the 20-second window.
  await expect(page.getByRole("heading", { name: "Check the strap" })).toBeVisible();
  await expect(page.getByText(/Your first session: fit the strap, calibrate for 20 seconds/)).toBeVisible();
  await page.getByRole("heading", { name: "Full breaths for 20 seconds" }).waitFor({ timeout: 30_000 });
  const calibrating = Date.now();
  await page.getByRole("heading", { name: "Calibrated" }).waitFor({ timeout: 60_000 });
  const seconds = (Date.now() - calibrating) / 1000;
  expect(seconds).toBeGreaterThanOrEqual(20);
  expect(seconds).toBeLessThanOrEqual(22);

  // The first session, then its score.
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.getByRole("button", { name: /Stop early/ })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(32_000);
  await page.getByRole("button", { name: /Stop early/ }).click();
  const total = page.locator(".res-total");
  await expect(total).toBeVisible();
  const score = Number((await total.innerText()).replace("/10", "").trim());
  expect(score).toBeGreaterThanOrEqual(1);
  expect(score).toBeLessThanOrEqual(10);
  await expect(page.getByText(/Post-training Downshift · \d+:\d\d/)).toBeVisible();

  // From the end of onboarding, never via Home or the New session page (sign-up itself passes /cloud/ on its way to the welcome).
  const afterWelcome = paths.slice(paths.lastIndexOf("/cloud/welcome/") + 1);
  expect(afterWelcome).toEqual(["/cloud/record/live/"]);
});

test("Calm on the simulated band: the first session is Just breathe, open, and leaving it goes Home", async ({ page }) => {
  test.setTimeout(120_000);
  await toBandStep(page, "Sol", "Calm");
  await simulatedBandToDone(page);
  await expect(page.getByText("Just breathe · Open · 3 min, after a strap check and calibration")).toBeVisible();
  await page.getByRole("button", { name: "Start my first session" }).click();

  await page.waitForURL(/\/cloud\/record\/live\/\?/);
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject({ mode: "open", len: "180", sound: "0", first: "just-breathe" });
  await expect(page.locator(".inst-title")).toContainText("Just breathe");

  // "Later": leaving the first session goes Home, not to the New session page.
  await page.getByRole("button", { name: "Leave the session" }).click();
  await page.waitForURL((url) => url.pathname === "/cloud/");
});
