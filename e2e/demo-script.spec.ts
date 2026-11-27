import { expect, test, type Browser, type Page } from "@playwright/test";
import { signInAsAthlete, signInAsCalm, signInAsClient, signInAsClinician, signInAsCoach } from "./auth";
import { calibrateAndBegin, connectSimulatedBand, emailFor, next, pick, professionalToTerminology, signOut, signUp, stored } from "./helpers/flows";

// Demo script v2 (docs/DEMO.md, planning/v1/05; U1), step by step on the
// local backend with the simulated band. One test per part of the script, so
// a failure names the part of DEMO.md that no longer matches the app. When
// you change the script, change this spec in the same commit.

const scoreIn = (text: string) => (text.match(/(\d+(?:\.\d)?)\s*\/\s*10/) ?? [])[1] ?? "";

// The site's half of part 1 runs in the breathband-site repo; here the console's
// root sends people to BreathCloud, and Sign in reaches the demo accounts.
test("1. The product: the way into the demo accounts", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL(/\/cloud\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your Breathband sessions, on a bigger screen." })).toBeVisible();
  await page.getByRole("link", { name: "Sign in", exact: true }).first().click();
  await page.waitForURL(/\/cloud\/login\/$/);
  await expect(page.getByText("Every demo account's password is breathband.")).toBeVisible();
  for (const name of ["Lena Vos", "Alex Morgan", "Maya Brooks", "Ana Ruiz", "Jordan Lee"]) {
    await expect(page.getByRole("button", { name: new RegExp(`Sign in as ${name}`) })).toBeVisible({ timeout: 30_000 });
  }
});

/** A second window with its own demo data, as a second browser profile would have. */
async function window(browser: Browser, signIn: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await signIn(page);
  return { context, page };
}

test("2. Same band, different product: Maya (Calm) beside Alex (Train)", async ({ browser }) => {
  test.setTimeout(150_000);
  const maya = await window(browser, signInAsCalm);
  const alex = await window(browser, signInAsAthlete);

  // Maya: minimal, one warm line, the habit and the program; an open session's rate, no score chart.
  await expect(maya.page.locator(".home")).toHaveAttribute("data-goal", "calm", { timeout: 30_000 });
  await expect(maya.page.locator(".home-line")).toHaveText(/days in a row/);
  await expect(maya.page.getByText("Start Open · 3 min")).toBeVisible();
  await expect(maya.page.getByRole("region", { name: "Foundations" })).toContainText("10 of 14 days done");
  await expect(maya.page.getByRole("region", { name: "Last session" })).toContainText("br/min");
  await expect(maya.page.getByRole("heading", { name: /Total Breath Score, last/ })).toHaveCount(0);

  // Alex: dense, the score and its parts, the 8-week trend, the coach's practice; no encouraging line.
  await expect(alex.page.locator(".home")).toHaveAttribute("data-goal", "train", { timeout: 30_000 });
  await expect(alex.page.locator(".home-line")).toHaveCount(0);
  await expect(alex.page.getByText("Start Paced 5-5 · 5 min")).toBeVisible();
  await expect(alex.page.getByRole("region", { name: "Last session" })).toContainText("/10");
  await expect(alex.page.getByRole("heading", { name: "Total Breath Score, last 8 weeks" })).toBeVisible();
  await expect(alex.page.getByRole("heading", { name: "From your coach" })).toBeVisible();

  await maya.context.close();
  await alex.context.close();
});

test("3. A new person, live: Calm from sign-up to a first session and its result", async ({ page }) => {
  test.setTimeout(240_000);
  // Signed out, the console's landing page offers Create account.
  await page.goto("/cloud/");
  await expect(page.getByRole("link", { name: "Create account", exact: true })).toHaveAttribute("href", "/cloud/signup/");
  const email = emailFor("Sofia Reyes");
  await signUp(page, { name: "Sofia Reyes", email, year: "1992" });
  await expect(page.getByRole("heading", { name: "Welcome to Breathband." })).toBeVisible();
  await next(page);
  await expect(page.getByRole("heading", { name: "What brings you to Breathband, Sofia?" })).toBeVisible();
  await page.getByRole("radio", { name: /Calm/ }).click();
  await next(page);
  await pick(page, "What are you hoping for?", "Less stress");
  await pick(page, "When suits you best?", "Evening");
  await next(page);
  await page.getByRole("radio", { name: /New to it/ }).click();
  await next(page);
  await expect(page.getByRole("heading", { name: "Your sessions" })).toBeVisible();
  await next(page);
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await next(page);
  await connectSimulatedBand(page);
  await next(page);
  await expect(page.getByRole("heading", { name: "You're ready, Sofia." })).toBeVisible();
  await expect(page.getByText("Just breathe · Open · 3 min, after a strap check and calibration")).toBeVisible();
  await page.getByRole("button", { name: "Start my first session" }).click();

  // The strap check passes by itself, then the balloon line and the 20-second calibration.
  await page.waitForURL(/\/cloud\/record\/live\/\?/);
  await expect(page.getByRole("heading", { name: "Check the strap" })).toBeVisible();
  await expect(page.getByText("Imagine your belly as a balloon.", { exact: false })).toBeVisible({ timeout: 30_000 });
  await calibrateAndBegin(page);
  await page.waitForTimeout(40_000);
  await page.getByRole("button", { name: /Stop early/ }).click();

  // The result: the rate, its word, one coaching line and one tip.
  await expect(page.locator(".res-total")).toContainText("br/min");
  await expect(page.locator(".res-word").first()).toBeVisible();
  await expect(page.locator(".res-tip")).toBeVisible();
  await page.getByRole("button", { name: "Save session" }).click();
  await page.waitForURL(/\/cloud\/session\//);

  // Home: the streak has started.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home" }).click();
  await expect(page.locator(".home")).toHaveAttribute("data-goal", "calm", { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "This week" })).toContainText("1 day");
  expect((await stored(page, email)).sessions).toHaveLength(1);
});

test("4. A clinician: onboarding to an invite; Jordan's From Ana; Ana's review, comment and report", async ({ page }) => {
  test.setTimeout(240_000);

  // A physiotherapist signs up live.
  await signUp(page, { name: "Aoife Byrne", email: emailFor("Aoife Byrne"), year: "1985", pro: true });
  await professionalToTerminology(page, "clinician");
  await expect(page.getByRole("radio", { name: /^Clients/ })).toHaveAttribute("aria-checked", "true");
  await next(page);
  await expect(page.getByRole("heading", { name: "Defaults for the clients you invite" })).toBeVisible();
  await next(page);
  await expect(page.getByRole("heading", { name: "Practice templates" })).toBeVisible();
  await next(page);
  await expect(page.getByRole("heading", { name: "Professional terms" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Breathband is a wellness tool/ })).toBeVisible();
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await next(page);
  await expect(page.getByRole("heading", { name: "Try it yourself" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Invite your first client" })).toBeVisible();
  await page.getByLabel("Client's name").fill("Sean Murphy");
  await page.getByLabel("Phone number or email").fill("sean@example.com");
  await page.getByLabel("First practice (optional)").selectOption({ label: "Between visits · Paced 5-5 · 5 min · daily for 14 days" });
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByRole("img", { name: "QR code of the invite link for Sean Murphy" })).toBeVisible();
  await next(page);
  await expect(page.getByRole("heading", { name: "You're set, Aoife." })).toBeVisible();
  await page.getByRole("button", { name: "Go to the dashboard" }).click();
  await page.waitForURL((u) => u.pathname === "/cloud/");
  await expect(page.getByRole("region", { name: "Getting started" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sample client: Riley" })).toBeVisible();
  await signOut(page);

  // Jordan, Ana's client: the From Ana card, and her practice on New session.
  await signInAsClient(page);
  const fromAna = page.getByRole("region", { name: "From Ana" });
  await expect(fromAna).toContainText("Ana Ruiz, your clinician", { timeout: 30_000 });
  await expect(fromAna).toContainText("Ana has set your practice: Paced 5-5 · 5:00 · 14 times");
  const jordanScore = scoreIn(await page.getByRole("region", { name: "Last session" }).innerText());
  expect(Number(jordanScore)).toBeGreaterThan(0);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Record" }).click();
  await page.waitForURL(/\/cloud\/record\/$/);
  await page.getByRole("button", { name: "Use these settings" }).click();
  await expect(page.getByRole("button", { name: /^Paced Follow/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "5 min", exact: true })).toHaveAttribute("aria-pressed", "true");
  await signOut(page);

  // Ana: adherence, Jordan's session with Jordan's numbers, a comment, the progress report.
  await signInAsClinician(page);
  await expect(page.getByRole("heading", { level: 2, name: "Needs a look" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Clients" }).click();
  await page.getByRole("region", { name: "Clients" }).getByRole("link", { name: /Jordan Lee/ }).first().click();
  const tabs = page.getByRole("navigation", { name: "Jordan Lee's data" });
  await tabs.getByRole("link", { name: /^Plan/ }).click();
  await expect(page.getByText("10/14").first()).toBeVisible();
  await expect(page.getByText("On track").first()).toBeVisible();
  await tabs.getByRole("link", { name: /^Sessions/ }).click();
  await page.getByRole("region", { name: "Sessions" }).getByRole("link").first().click();
  await page.waitForURL(/\/cloud\/session\/\?/);
  await expect(page.locator(".mc-total")).toContainText(jordanScore);
  await page.getByLabel("Write a comment").fill("Steady again, Jordan. Keep the evenings.");
  await page.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(page.locator("ol.thread")).toContainText("Steady again, Jordan. Keep the evenings.");
  await page.goto("/cloud/sessions/?athlete=demo-jordan");
  await page.getByRole("link", { name: "Report" }).click();
  await page.waitForURL(/\/cloud\/report\/\?/);
  await expect(page.getByText("Breathing progress report")).toBeVisible();
  await expect(page.getByText("Ana Ruiz, clinician")).toBeVisible();
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
});

test("5. A coach: Lena's dashboard, compare, and the two-person session", async ({ page }) => {
  test.setTimeout(180_000);
  await signInAsCoach(page);
  await expect(page.getByRole("heading", { level: 2, name: "Needs a look" })).toBeVisible({ timeout: 30_000 });
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name: "Compare" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Compare athletes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sprint squad" })).toBeVisible();

  await nav.getByRole("link", { name: "Two-person" }).click();
  await expect(page.getByRole("heading", { name: "Breathe together" })).toBeVisible();
  await page.getByRole("button", { name: "Connect both bands" }).click();
  await page.getByRole("button", { name: "Calibrate both" }).click();
  await expect(page.getByRole("heading", { name: "Both calibrated" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(40_000);
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByRole("heading", { name: "Side by side" })).toBeVisible();
  const cards = page.locator(".duo-card");
  await expect(cards).toHaveCount(2);
  const [one, two] = [scoreIn(await cards.nth(0).innerText()), scoreIn(await cards.nth(1).innerText())];
  await expect(cards.nth(0).getByRole("heading", { name: "User 1" })).toBeVisible();
  await expect(cards.nth(1).getByRole("heading", { name: "User 2" })).toBeVisible();
  // User 1 is steady, User 2 rushed: the steady one scores higher.
  expect(Number(one)).toBeGreaterThan(Number(two));
});
