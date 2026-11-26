import { expect, test, type Page } from "@playwright/test";
import { signInAsAthlete, signInAsCalm, signInAsClient } from "./auth";

// The four things T-0131's review of the demo script found wrong on screen
// (T-0137): Home's start action and an assigned practice, the professional's
// word on New session, the empty coach pane on Calm, and "done for today"
// before the ring's minutes are met.

const DB_KEY = "breathband-console:local-db";

const main = (page: Page) => page.getByRole("navigation", { name: "Main" });

/** Moves the signed-in person's newest session to a couple of minutes ago, lasting `seconds`. */
async function newestSessionToday(page: Page, seconds: number) {
  await page.evaluate(
    ([key, seconds]) => {
      const db = JSON.parse(localStorage.getItem(key)!);
      const mine = db.sessions[db.currentUid] as { startedAt: string; durationSec: number }[];
      const newest = mine.reduce((a, b) => (Date.parse(a.startedAt) > Date.parse(b.startedAt) ? a : b));
      newest.startedAt = new Date(Date.now() - 2 * 60_000).toISOString();
      newest.durationSec = seconds;
      localStorage.setItem(key, JSON.stringify(db));
    },
    [DB_KEY, seconds] as const,
  );
  await page.goto("/cloud/");
  await expect(page.getByRole("region", { name: "Last session" })).toBeVisible({ timeout: 30_000 });
}

test("Jordan's Home starts the practice Ana assigned, and New session opens set to it", async ({ page }) => {
  await signInAsClient(page);
  await expect(page.getByRole("region", { name: "From Ana" })).toContainText("Ana has set your practice: Paced 5-5 · 5:00", { timeout: 30_000 });
  const start = page.getByRole("link", { name: "Start Paced 5-5 · 5 min" });
  await expect(start).toBeVisible();
  await expect(page.getByRole("link", { name: /^Start Open/ })).toHaveCount(0);

  await start.click();
  await page.waitForURL(/\/cloud\/record\/\?mode=paced&len=300&pacer=5$/);
  await expect(page.getByRole("button", { name: /^Paced Follow/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Pacer" }).getByRole("button", { name: /^5-5/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "5 min", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".setup-go")).toContainText("Paced 5-5 · 5 min");
});

test("New session names a clinician as the client's clinician, and a coach as a coach", async ({ browser }) => {
  const jordan = await (await browser.newContext()).newPage();
  await signInAsClient(jordan);
  await main(jordan).getByRole("link", { name: "Record" }).click();
  await jordan.waitForURL(/\/cloud\/record\/$/);
  const fromAna = jordan.getByRole("region", { name: "Practice from your clinician" });
  await expect(fromAna).toContainText("From your clinician: Paced 5-5 · 5:00 · 14 times", { timeout: 30_000 });
  await expect(jordan.getByText("From your coach")).toHaveCount(0);
  await fromAna.getByRole("button", { name: "Use these settings" }).click();
  await expect(jordan.getByRole("button", { name: "5 min", exact: true })).toHaveAttribute("aria-pressed", "true");
  await jordan.context().close();

  const alex = await (await browser.newContext()).newPage();
  await signInAsAthlete(alex);
  await main(alex).getByRole("link", { name: "Record" }).click();
  await alex.waitForURL(/\/cloud\/record\/$/);
  await expect(alex.getByRole("region", { name: "Practice from your coach" })).toContainText("From your coach: Paced 5-5 · 5:00", { timeout: 30_000 });
  await alex.context().close();
});

test("Calm with no professional has no empty coach pane; Train with a coach keeps it", async ({ browser }) => {
  const maya = await (await browser.newContext()).newPage();
  await signInAsCalm(maya);
  await expect(maya.locator(".home")).toHaveAttribute("data-goal", "calm", { timeout: 30_000 });
  await expect(maya.getByRole("heading", { name: "Recent" })).toBeVisible();
  await expect(maya.getByRole("heading", { name: /^From your/ })).toHaveCount(0);
  await expect(maya.getByText(/Share with a coach/)).toHaveCount(0);
  await expect(maya.getByRole("region", { name: "Recent sessions" })).toBeVisible();
  await maya.context().close();

  const alex = await (await browser.newContext()).newPage();
  await signInAsAthlete(alex);
  await expect(alex.locator(".home")).toHaveAttribute("data-goal", "train", { timeout: 30_000 });
  await expect(alex.getByRole("region", { name: "Coach and recent sessions" }).getByRole("heading", { name: "From your coach" })).toBeVisible();
  await alex.context().close();
});

test("Done for today only once today's minutes meet the ring", async ({ page }) => {
  await signInAsCalm(page);
  await expect(page.locator(".home")).toHaveAttribute("data-goal", "calm", { timeout: 30_000 });
  const line = page.locator(".home-line");
  const ring = page.getByRole("region", { name: "This week" }).locator(".home-ring");

  // A 40-second session today, as in the script's part 3: the ring isn't met, and the line says what's left.
  await newestSessionToday(page, 40);
  await expect(ring).toContainText(/Today\s*0 of 3 min/);
  await expect(line).toHaveText(/^\w+ days in a row\. Three more minutes finishes today\.$/);
  await expect(line).not.toContainText("Done for today");

  // Three minutes or more closes the ring, and now it's done.
  await newestSessionToday(page, 200);
  await expect(ring).toContainText("3 of 3 min, ring closed");
  await expect(line).toHaveText(/^Nice\. \w+ days in a row\.$/);
});
