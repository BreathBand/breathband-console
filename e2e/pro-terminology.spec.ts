import { expect, test, type Page } from "@playwright/test";
import { signInAsCoach } from "./auth";

// T-0116: the coach UI uses the professional's own word for the people they
// work with (planning/v1/02 §5.2). "Needs a look" defaults are the same for
// every kind until the backend can say whether rules were ever saved.

const DB_KEY = "breathband-console:local-db";

/** Makes the signed-in demo professional a clinician, as onboarding would have stored it. */
async function becomeClinician(page: Page): Promise<void> {
  await page.evaluate((key) => {
    const db = JSON.parse(globalThis.localStorage.getItem(key) ?? "{}");
    const profile = db.accounts["demo-coach"].profile;
    profile.proKind = "clinician";
    profile.proProfile = {
      kind: "clinician",
      organisation: null,
      profession: "physiotherapist",
      sports: [],
      level: null,
      country: "Ireland",
      useCases: ["between-visits"],
      terminology: "clients",
    };
    globalThis.localStorage.setItem(key, JSON.stringify(db));
  }, DB_KEY);
  await page.reload();
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const scoreDropRule = (page: Page) => page.getByRole("checkbox", { name: /below their recent average/ });
const missedDaysRule = (page: Page) => page.getByRole("checkbox", { name: /No session for/ });

test("a clinician sees clients across the dashboard, roster and invite; flags are unchanged", async ({ page }) => {
  await signInAsCoach(page);
  await becomeClinician(page);

  await expect(page.getByRole("heading", { level: 2, name: "From your clients" })).toBeVisible();
  await expect(page.locator(".title-row span").first()).toContainText(/\d+ clients?$/);
  await expect(page.getByText(/clients practised$/)).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "Clients" })).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "Athletes" })).toHaveCount(0);

  await nav(page).getByRole("link", { name: "Clients" }).click();
  await page.waitForURL((url) => url.pathname === "/cloud/athletes/");
  await expect(page.getByRole("heading", { level: 1, name: "Clients" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Clients" })).toBeVisible();
  await expect(page.getByText(/clients share their sessions with you/)).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Client", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invite a client by text or email" })).toBeVisible();
  await expect(page.getByLabel("Client's name")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Have a code from the client?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add client" })).toBeVisible();
  await expect(page.getByRole("main").getByText(/\bathletes?\b/i)).toHaveCount(0);

  await page.goto("/cloud/account/#alerts");
  await expect(missedDaysRule(page)).toBeChecked();
  await expect(scoreDropRule(page)).toBeChecked();
  await expect(page.getByText("Each client's targets are on their Trends tab.", { exact: false })).toBeVisible();
});

test("the demo coach still sees athletes, worded as before, and the full set of flags", async ({ page }) => {
  await signInAsCoach(page);

  await expect(page.getByRole("heading", { level: 2, name: "From your athletes" })).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "Athletes" })).toBeVisible();
  await expect(page.getByText(/athletes trained$/)).toBeVisible();

  await page.goto("/cloud/athletes/");
  await expect(page.getByRole("heading", { level: 1, name: "Athletes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invite an athlete by text or email" })).toBeVisible();
  await expect(page.getByLabel("Athlete's name")).toBeVisible();

  await page.goto("/cloud/account/#alerts");
  await expect(missedDaysRule(page)).toBeChecked();
  await expect(scoreDropRule(page)).toBeChecked();
});

test("a new clinician who signs up lands on a dashboard waiting for their first client", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/cloud/signup/");
  await page.getByRole("radio", { name: /^Coach/ }).check();
  await page.getByLabel("Name").fill("Niamh");
  await page.getByLabel("Email").fill(`niamh${Date.now()}@example.com`);
  await page.getByLabel(/^Password/).first().fill("breathe-easy-123");
  await page.getByLabel("Year of birth").fill("1985");
  await page.getByLabel(/terms of use/).check();
  await page.getByLabel(/breathing data/).check();
  await page.getByRole("button", { name: /Create/ }).click();
  await page.waitForURL(/\/cloud\/welcome\//, { timeout: 60_000 });
  const next = () => page.getByRole("button", { name: "Continue" }).click();
  await next();
  await page.getByRole("radio", { name: /Clinician or therapist/ }).click();
  await next();
  await page.getByRole("group", { name: "What's your profession?", exact: true }).getByRole("button", { name: "Physiotherapist", exact: true }).click();
  await page.getByLabel("Country").fill("Ireland");
  await next();
  await page.getByRole("group", { name: "Pick any that apply", exact: true }).getByRole("button", { name: "Stress and anxiety skills", exact: true }).click();
  await next();
  await expect(page.getByText("BreathCloud will call them this.")).toBeVisible();
  await expect(page.getByText(/still say/)).toHaveCount(0);
  await next();
  await page.getByRole("button", { name: "Go to the dashboard" }).click();
  await page.waitForURL((url) => url.pathname === "/cloud/");

  await expect(page.getByRole("heading", { name: "No clients yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add a client" })).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "Clients" })).toBeVisible();
});
