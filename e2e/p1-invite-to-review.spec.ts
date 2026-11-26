import { expect, test } from "@playwright/test";
import { signInAsClinician } from "./auth";
import { calibrateAndBegin, connectSimulatedBand, emailFor, next, signInWithPassword, signOut, signUp, stored } from "./helpers/flows";

// P1 (planning/v1/03): invite → accept → assignment → session → professional
// review, on the local backend with the simulated band. Ana (the demo
// clinician) invites a new client with a first practice from her Clients page;
// the client, already signed in, accepts on /cloud/join/, is set up on Calm,
// records the whole assigned session; Ana sees it count, opens it with the
// same numbers and comments; the client reads the comment.
//
// Real time: the practice is "Weekly open check" (Open, 3 min) so the session
// can run its full length and count toward the practice (about 4 minutes).

const PRACTICE = "Weekly open check · Open · 3 min";
const COMMENT = "Nice and settled, Robin. Same again next week.";

test("a clinician's invite with a first practice → accepted → the assigned session recorded → reviewed and commented on", async ({ page }) => {
  test.setTimeout(480_000);

  // Ana creates the invite with a first practice.
  await signInAsClinician(page);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Clients" }).click();
  await page.waitForURL(/\/cloud\/athletes\//);
  await page.getByLabel("Client's name").fill("Robin Shaw");
  await page.getByLabel("Phone number or email").fill("robin@example.com");
  await page.getByLabel("First practice (optional)").selectOption({ label: PRACTICE });
  await page.getByRole("button", { name: "Create invite link" }).click();
  const link = page.locator("output.inv-link");
  await expect(link).toHaveText(/\/cloud\/join\/\?code=[A-Z0-9-]+$/);
  const url = (await link.textContent()) ?? "";
  await expect(page.getByRole("img", { name: "QR code of the invite link for Robin Shaw" })).toBeVisible();
  await signOut(page);

  // Robin signs up first, then opens the link while signed in (today's join page).
  const email = emailFor("Robin Shaw");
  await signUp(page, { name: "Robin Shaw", email, year: "1990" });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: /^Ana Ruiz \(physiotherapist\) would like to see your / })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("note").filter({ hasText: "Ana has set your first practice: Weekly open check" })).toBeVisible();
  await page.getByRole("button", { name: /^Accept: share / }).click();

  // Onboarding from the invite: Calm prefilled, the practice as the first session.
  await page.waitForURL(/\/cloud\/welcome\/\?invite=/);
  await next(page);
  await expect(page.getByRole("radio", { name: /Calm/ })).toHaveAttribute("aria-checked", "true");
  await next(page);
  await page.getByRole("button", { name: "Skip these" }).click();
  await next(page); // experience
  await expect(page.getByRole("heading", { name: "Your sessions" })).toBeVisible();
  await next(page);
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await next(page);
  await connectSimulatedBand(page);
  await next(page);
  await expect(page.getByText("Weekly open check from Ana · Open · 3 min, after a strap check and calibration")).toBeVisible();
  const assigned = (await stored(page, email)).assignments;
  expect(assigned).toEqual([expect.objectContaining({ mode: "open", durationSec: 180, target: 1, note: "Weekly open check", cancelled: false })]);
  await page.getByRole("button", { name: "Start my first session" }).click();

  // The whole assigned session on the simulated band; it stops itself at 3:00.
  await page.waitForURL(/\/cloud\/record\/live\/\?/);
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject({ mode: "open", len: "180", first: "assigned-practice" });
  await calibrateAndBegin(page);
  const total = page.locator(".res-total");
  await expect(total).toContainText("br/min", { timeout: 240_000 });
  const rate = ((await total.innerText()).match(/\d+(\.\d)?/) ?? [""])[0];
  expect(Number(rate)).toBeGreaterThan(0);
  await page.getByLabel(/Note/).fill("First one from Ana's practice.");
  await page.getByRole("button", { name: "Save session" }).click();
  await page.waitForURL(/\/cloud\/session\//);
  const review = new URL(page.url());
  review.searchParams.delete("new");
  // The results round the rate to a whole breath; the review gives it to a tenth.
  const hero = page.getByRole("region", { name: "Breathing rate" });
  await expect(hero).toContainText("br/min");
  const reviewRate = ((await hero.innerText()).match(/\d+(\.\d)?/) ?? [""])[0];
  expect(Math.round(Number(reviewRate))).toBe(Number(rate));
  await signOut(page);

  // Ana: Robin is a client, the practice is done, and the session has Robin's numbers.
  await signInAsClinician(page);
  await expect(page.getByRole("main")).toContainText("Robin Shaw", { timeout: 30_000 });
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Clients" }).click();
  await page.getByRole("region", { name: "Clients" }).getByRole("link", { name: /Robin Shaw/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Robin Shaw" })).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Robin Shaw's data" });
  await tabs.getByRole("link", { name: /^Plan/ }).click();
  await expect(page.getByText("Open · 3:00 · 1 time").first()).toBeVisible();
  await expect(page.getByText("1/1").first()).toBeVisible();
  await tabs.getByRole("link", { name: /^Sessions/ }).click();
  await page.getByRole("region", { name: "Sessions" }).getByRole("link").first().click();
  await page.waitForURL(/\/cloud\/session\/\?/);
  await expect(page.getByRole("region", { name: "Breathing rate" })).toContainText(`${reviewRate}br/min`);
  await expect(page.getByText("First one from Ana's practice.")).toBeVisible();
  await page.getByLabel("Write a comment").fill(COMMENT);
  await page.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(page.locator("ol.thread")).toContainText(COMMENT);
  await signOut(page);

  // Robin reads Ana's comment on the session.
  await signInWithPassword(page, email);
  await page.goto(review.pathname + review.search);
  await expect(page.locator("ol.thread")).toContainText(COMMENT, { timeout: 30_000 });
  await expect(page.locator("ol.thread")).toContainText("Ana Ruiz");
});
