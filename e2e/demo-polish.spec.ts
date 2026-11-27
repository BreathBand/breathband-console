import { expect, test, type Page } from "@playwright/test";
import { signInAsAthlete, signInAsCalm, signInAsClient, signInAsClinician, signInAsFocus } from "./auth";

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

// T-0138: the same rule after a session, and the professional's word on the client's own tabs.

test("the results and the review agree with Home: a short session reads as a start, not done for today", async ({ page }) => {
  test.setTimeout(240_000);
  await signInAsCalm(page);
  await expect(page.locator(".home")).toHaveAttribute("data-goal", "calm", { timeout: 30_000 });

  await page.goto("/cloud/device/");
  await page.getByRole("button", { name: "Simulated band", exact: false }).first().click();
  await page.getByRole("button", { name: "Start the simulated band" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Simulated band" })).toBeVisible({ timeout: 15_000 });
  // Navigate inside the app: a full page load would drop the band's connection.
  await main(page).getByRole("link", { name: "Record" }).click();
  await page.waitForURL(/\/cloud\/record\/$/);
  await page.getByRole("button", { name: "Start session" }).click();
  await page.waitForURL(/\/cloud\/record\/live\//);
  await expect(page.getByRole("heading", { name: "Calibrated" })).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.getByRole("button", { name: /Stop early/ })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(32_000);
  await page.getByRole("button", { name: /Stop early/ }).click();

  // About 30 seconds of Maya's 3 minutes: the results say what's left, never "Done for today".
  const results = page.locator(".res-line");
  await expect(results).toHaveText(/^\w+ days in a row\. Three more minutes finishes today\.$/);
  const said = await results.innerText();

  await page.getByRole("button", { name: "Save session" }).click();
  await page.waitForURL(/\/cloud\/session\//);
  await expect(page.getByRole("region", { name: "Coaching" })).toContainText(said);

  await main(page).getByRole("link", { name: "Home" }).click();
  await expect(page.locator(".home")).toHaveAttribute("data-goal", "calm", { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "This week" }).locator(".home-ring")).toContainText(/Today\s*0 of 3 min/);
  await expect(page.locator(".home-line")).toHaveText(said);
});

test("a clinician's client's own tabs name the clinician, not a coach", async ({ page }) => {
  await signInAsClient(page);
  // The reviewer's path: the "Practice" link on the From Ana card.
  await page.getByRole("region", { name: "From Ana" }).getByRole("link", { name: "Practice" }).click();
  await page.waitForURL(/\/cloud\/sessions\/\?tab=plan/);
  const tabs = page.getByRole("navigation", { name: "Your data" });
  await expect(tabs.getByRole("link", { name: /^From your clinician/ })).toHaveAttribute("aria-current", "page", { timeout: 30_000 });
  await expect(page.getByText("From your coach")).toHaveCount(0);
});

// T-0148: a clinician's client hears from their clinician everywhere, and the private notes say who sees them.

/** The id of the session Ana commented on, from Jordan's local DB. */
async function sessionAnaCommentedOn(page: Page): Promise<string> {
  return page.evaluate((key) => {
    const db = JSON.parse(localStorage.getItem(key)!);
    const comments = db.comments["demo-jordan"] as { authorId: string; kind: string; sessionId: string }[];
    return comments.find((c) => c.authorId === "demo-ana" && c.kind === "comment")!.sessionId;
  }, DB_KEY);
}

test("a clinician's client's review: the clinician's line, her comment tagged clinician, and no coach anywhere", async ({ page }) => {
  await signInAsClient(page);
  await expect(page.getByRole("region", { name: "From Ana" })).toBeVisible({ timeout: 30_000 });
  const id = await sessionAnaCommentedOn(page);
  await page.goto(`/cloud/session/?athlete=demo-jordan&id=${id}`);

  const thread = page.locator("ol.thread");
  await expect(thread).toContainText("Ana Ruiz · clinician", { timeout: 30_000 });
  await expect(thread).not.toContainText("· coach");
  const coachingLine = page.getByRole("region", { name: "Coaching" });
  await expect(coachingLine).toContainText("Ana will see this before your next visit.");
  await expect(coachingLine).not.toContainText("in a row");
  await expect(page.getByRole("region", { name: "Comments" })).toContainText("Between you and your clinician");
  await expect(page.getByLabel("Write a comment")).toHaveAttribute("placeholder", "Reply to your clinician…");
  await expect(page.getByRole("region", { name: "Session note" })).toContainText("Visible to your clinician");
  await expect(page.getByText(/your coach/)).toHaveCount(0);
});

test("a clinician's client's Plan tab asks in the clinician's words", async ({ page }) => {
  await signInAsClient(page);
  await expect(page.getByRole("region", { name: "From Ana" })).toBeVisible({ timeout: 30_000 });
  await page.goto("/cloud/sessions/?tab=plan");
  await expect(page.getByRole("heading", { level: 2, name: "What your clinician asked for" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/set by Ana Ruiz/).first()).toBeVisible();
  await expect(page.getByText(/your coach/)).toHaveCount(0);
});

test("Focus with no professional: Home and the Sessions tabs both say teacher", async ({ page }) => {
  await signInAsFocus(page);
  await expect(page.locator(".home")).toHaveAttribute("data-goal", "focus", { timeout: 30_000 });
  // Sam without Lena: no link and no practice.
  await page.evaluate((key) => {
    const db = JSON.parse(localStorage.getItem(key)!);
    db.coachLinks = db.coachLinks.filter((l: { athleteId: string }) => l.athleteId !== "demo-athlete-2");
    db.assignments["demo-athlete-2"] = [];
    localStorage.setItem(key, JSON.stringify(db));
  }, DB_KEY);
  await page.goto("/cloud/");
  const side = page.getByRole("region", { name: "Teacher and recent sessions" });
  await expect(side.getByRole("heading", { name: "From your teacher" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/cloud/sessions/?tab=plan");
  const tabs = page.getByRole("navigation", { name: "Your data" });
  await expect(tabs.getByRole("link", { name: /^From your teacher/ })).toHaveAttribute("aria-current", "page", { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 2, name: "What your teacher asked for" })).toBeVisible();
  await expect(page.getByText("When your teacher sets practice, it shows here and in the app.")).toBeVisible();
  await expect(page.getByText(/your coach/i)).toHaveCount(0);
});

test("a professional's private notes carry the hint, and the prompt doesn't ask for injuries", async ({ page }) => {
  await signInAsClinician(page);
  await page.goto("/cloud/sessions/?athlete=demo-jordan&tab=notes");
  const notes = page.getByRole("region", { name: "Your notes on Jordan" });
  await expect(notes).toContainText("Only you can see these", { timeout: 30_000 });
  await expect(notes).toContainText("For practice notes only. Don't record diagnoses or medical history here.");
  const box = notes.getByRole("textbox", { name: "Notes" });
  await expect(box).toHaveAttribute("placeholder", "Goals, what works for them, what to try next…");
  await expect(box).toHaveAccessibleDescription("For practice notes only. Don't record diagnoses or medical history here.");
});
