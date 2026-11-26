import { expect, test, type Page } from "@playwright/test";

// T-0109: the band step checks the browser first, then offers four routes
// (Bluetooth, the phone app, no band yet, the simulated band). Every route
// finishes onboarding, and "no band yet" can open sample-data mode.

const DB_KEY = "breathband-console:local-db";

async function toBandStep(page: Page, name: string): Promise<string> {
  const email = `${name.toLowerCase()}${Date.now()}@example.com`;
  await page.goto("/cloud/signup/");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).first().fill("breathe-easy-123");
  await page.getByLabel("Year of birth").fill("1998");
  await page.getByLabel(/terms of use/).check();
  await page.getByLabel(/breathing data/).check();
  await page.getByRole("button", { name: /Create/ }).click();
  await page.waitForURL(/\/cloud\/welcome\//, { timeout: 60_000 });

  const next = () => page.getByRole("button", { name: "Continue" }).click();
  await next();
  await page.getByRole("radio", { name: /Calm/ }).click();
  await next();
  await page.getByRole("button", { name: "Skip these" }).click();
  await next();
  await expect(page.getByRole("heading", { name: "Your sessions" })).toBeVisible();
  await next();
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await next();
  await expect(page.getByRole("heading", { name: "Your band" })).toBeVisible();
  return email;
}

const routes = (page: Page) => page.getByRole("radiogroup", { name: "How you'll breathe with Breathband" });

function storedPreferences(page: Page, email: string) {
  return page.evaluate(
    ([key, address]) => {
      const db = JSON.parse(globalThis.localStorage.getItem(key) ?? "{}");
      return Object.values(db.accounts as Record<string, { profile: { email: string; preferences: unknown } }>).find(
        (a) => a.profile.email === address,
      )?.profile.preferences as { onboarding?: unknown; onboardedAt?: string | null } | undefined;
    },
    [DB_KEY, email] as const,
  );
}

test("without Web Bluetooth the band step says what to do, and the phone-app route still finishes", async ({ page }) => {
  test.setTimeout(120_000);
  // A browser without Web Bluetooth (Safari, Firefox, any iPhone browser).
  await page.addInitScript(() => {
    delete (Navigator.prototype as { bluetooth?: unknown }).bluetooth;
  });
  const email = await toBandStep(page, "Mira");

  const note = page.getByRole("note", { name: "Browser check" });
  await expect(note).toBeVisible();
  await expect(note).toContainText("Connecting the band needs Chrome or Edge on a computer or an Android phone.");
  await expect(note).toContainText("You can still finish setting up");
  await expect(routes(page).getByRole("radio", { name: /Connect my Breathband/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();

  await routes(page).getByRole("radio", { name: /I'll use the phone app/ }).click();
  await expect(page.getByText(`signed in as ${email}`)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: /You're ready/ })).toBeVisible();
  await expect(page.getByText("The phone app")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start my first session" })).toHaveCount(0);
  await page.getByRole("button", { name: "Go to my home" }).click();
  await page.waitForURL((url) => url.pathname === "/cloud/");

  const prefs = await storedPreferences(page, email);
  expect(prefs?.onboardedAt).toBeTruthy();
  expect(prefs?.onboarding).toEqual({ bandRoute: "app", sampleData: false });
});

test("the simulated band connects in the band step and leads to the first session", async ({ page }) => {
  test.setTimeout(120_000);
  const email = await toBandStep(page, "Tomas");

  await routes(page).getByRole("radio", { name: /Simulated band/ }).click();
  await expect(routes(page).getByRole("radio", { name: /Simulated band/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Start the simulated band" }).click();
  await expect(page.getByText(/Simulated band connected/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: /You're ready/ })).toBeVisible();
  await expect(page.getByText("Simulated band", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start my first session" }).click();
  // T-0115: straight into fit, calibration and the track's first session (Calm: Just breathe), not the New session page.
  await page.waitForURL(/\/cloud\/record\/live\/\?.*first=just-breathe/);

  expect((await storedPreferences(page, email))?.onboarding).toEqual({ bandRoute: "simulated", sampleData: false });
});

test("no band yet: sample-data mode shows labelled sample sessions, and leaving it goes home", async ({ page }) => {
  test.setTimeout(120_000);
  const email = await toBandStep(page, "Ines");

  await routes(page).getByRole("radio", { name: /I don't have a band yet/ }).click();
  await expect(page.getByLabel(/Explore with sample sessions/)).toBeChecked();
  await page.getByRole("button", { name: "Tell me when bands are available" }).click();
  await expect(page.getByRole("status").filter({ hasText: "on the list" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("No band yet · sample sessions")).toBeVisible();
  await page.getByRole("button", { name: "Explore sample sessions" }).click();
  await page.waitForURL(/\/cloud\/welcome\/sample\/$/);
  expect((await storedPreferences(page, email))?.onboarding).toEqual({ bandRoute: "none", sampleData: true });

  await expect(page.getByRole("heading", { name: "Riley’s sessions" })).toBeVisible();
  await expect(page.getByText("Sample data")).toBeVisible();
  const rows = page.getByRole("list", { name: "Sample sessions" }).getByRole("listitem");
  await expect(rows).toHaveCount(6);
  for (const row of await rows.all()) await expect(row.getByText("Sample", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Leave sample mode" }).click();
  await page.waitForURL((url) => url.pathname === "/cloud/");
  expect((await storedPreferences(page, email))?.onboarding).toEqual({ bandRoute: "none", sampleData: false });
});
