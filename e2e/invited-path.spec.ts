import { expect, test, type Page } from "@playwright/test";
import { signInAsAthlete, signInAsCoach } from "./auth";

// T-0123: the invited path (planning/v1/02 §2, §3.5). A professional's invite
// says who's asking in their own terms and what they ask to see; the scope
// starts at what they ask for; a new person signs up, accepts, and onboarding
// starts with the goal prefilled from the professional's kind; practice set
// with the invite is their first session. An existing account just confirms.

const DB_KEY = "breathband-console:local-db";
const PASSWORD = "breathe-easy-123";

const next = (page: Page) => page.getByRole("button", { name: "Continue" }).click();
const pick = (page: Page, question: string, option: string) =>
  page.getByRole("group", { name: question, exact: true }).getByRole("button", { name: option, exact: true }).click();

async function fillSignUp(page: Page, name: string, email: string, year: string) {
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).first().fill(PASSWORD);
  await page.getByLabel("Year of birth").fill(year);
  await page.getByLabel(/terms of use/).check();
  await page.getByLabel(/breathing data/).check();
  await page.getByRole("button", { name: /Create/ }).click();
}

async function stored(page: Page, email: string) {
  return page.evaluate(
    ([key, address]) => {
      const db = JSON.parse(globalThis.localStorage.getItem(key) ?? "{}");
      const account = Object.values(db.accounts as Record<string, { profile: { uid: string; email: string } & Record<string, unknown> }>).find(
        (a) => a.profile.email === address,
      );
      const uid = account?.profile.uid ?? "";
      return { profile: account?.profile, assignments: (db.assignments?.[uid] ?? []) as Record<string, unknown>[] };
    },
    [DB_KEY, email] as const,
  );
}

/** A clinician (physiotherapist) who asks for scores only signs up and invites Jordan with "Between visits" as the first practice. */
async function clinicianInvites(page: Page): Promise<string> {
  await page.goto("/cloud/signup/");
  await page.getByRole("radio", { name: /^Coach/ }).check();
  await fillSignUp(page, "Aoife Byrne", `aoife${Date.now()}@example.com`, "1985");
  await page.waitForURL(/\/cloud\/welcome\//, { timeout: 60_000 });
  await next(page);
  await page.getByRole("radio", { name: /Clinician or therapist/ }).click();
  await next(page);
  await pick(page, "What's your profession?", "Physiotherapist");
  await page.getByLabel("Country").fill("Ireland");
  await next(page);
  await pick(page, "Pick any that apply", "Breathing pattern practice between visits");
  await next(page);
  await next(page);
  await expect(page.getByRole("heading", { name: /^Defaults for the/ })).toBeVisible();
  await page.getByRole("radiogroup", { name: "What your invites ask them to share" }).getByRole("radio", { name: /Scores only/ }).click();
  await next(page);
  await next(page);
  await expect(page.getByRole("heading", { name: "Professional terms" })).toBeVisible();
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await next(page);
  await page.getByRole("button", { name: "Skip for now" }).click();

  await expect(page.getByRole("heading", { name: "Invite your first client" })).toBeVisible();
  await page.getByLabel("Client's name").fill("Jordan Lee");
  await page.getByLabel("Phone number or email").fill("jordan@example.com");
  await page.getByLabel("First practice (optional)").selectOption({ label: "Between visits · Paced 5-5 · 5 min · daily for 14 days" });
  await page.getByRole("button", { name: "Create invite link" }).click();
  const url = (await page.locator("output.inv-link").textContent()) ?? "";
  expect(url).toMatch(/\/cloud\/join\/\?code=[A-Z0-9-]+$/);
  await next(page);
  await page.getByRole("button", { name: "Go to the dashboard" }).click();
  await page.waitForURL((u) => u.pathname === "/cloud/");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((u) => u.pathname === "/cloud/");
  return url;
}

test("a new person opens a clinician's invite, signs up, accepts at the asked scope, starts on Calm and lands in the assigned practice", async ({ page }) => {
  test.setTimeout(240_000);
  const url = await clinicianInvites(page);

  // Signed out, the link shows who's asking first (T-0129), then sign-up, carrying the invite code.
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Aoife Byrne (physiotherapist) would like to see your scores." })).toBeVisible();
  await expect(page.getByRole("note").filter({ hasText: "Aoife has set your first practice: Between visits" })).toBeVisible();
  await page.getByRole("link", { name: "Sign up to accept" }).click();
  await page.waitForURL(/\/cloud\/signup\/\?next=%2Fcloud%2Fjoin%2F/);
  await expect(page.getByText("You're joining from an invite.", { exact: false })).toBeVisible();
  const email = `jordan${Date.now()}@example.com`;
  await fillSignUp(page, "Jordan Lee", email, "1998");

  // The invite page: who's asking in their own terms, and the scope they asked for.
  await page.waitForURL(/\/cloud\/join\/\?code=/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Aoife Byrne (physiotherapist) would like to see your scores." })).toBeVisible();
  await expect(page.getByText("Invitation to share from your physiotherapist")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Scores only/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /Scores and curves/ })).not.toBeChecked();
  await expect(page.getByRole("note").filter({ hasText: "Aoife has set your first practice: Between visits" })).toBeVisible();
  await page.getByRole("button", { name: "Accept: share scores only" }).click();

  // Onboarding, set up from the invite: Calm prefilled and changeable.
  await page.waitForURL(/\/cloud\/welcome\/\?invite=/);
  await next(page);
  await expect(page.getByRole("radio", { name: /Calm/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Set to Calm because Aoife Byrne (physiotherapist) invited you.", { exact: false })).toBeVisible();
  await next(page);
  await page.getByRole("button", { name: "Skip these" }).click();
  await next(page); // experience
  await next(page); // sessions
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await next(page);
  await expect(page.getByRole("heading", { name: "Your band" })).toBeVisible();
  const routes = page.getByRole("radiogroup", { name: "How you'll breathe with Breathband" });
  await routes.getByRole("radio", { name: /Simulated band/ }).click();
  await page.getByRole("button", { name: "Start the simulated band" }).click();
  await expect(page.getByText(/Simulated band connected/)).toBeVisible({ timeout: 15_000 });
  await next(page);

  // The done step names the clinician's practice as the first session.
  await expect(page.getByRole("heading", { name: /You're ready/ })).toBeVisible();
  await expect(page.getByText("Between visits from Aoife · Paced 5-5 · 5 min, after a strap check and calibration")).toBeVisible();
  await expect(page.getByText("Aoife Byrne (physiotherapist)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start my first session" }).click();

  // Straight into the instrument, locked to the practice's settings.
  await page.waitForURL(/\/cloud\/record\/live\/\?/);
  const q = new URL(page.url()).searchParams;
  expect(Object.fromEntries(q)).toMatchObject({ mode: "paced", pacer: "5", len: "300", first: "assigned-practice" });
  await expect(page.locator(".inst-title")).toContainText("Assigned practice");

  // Stored: the Calm goal, and the practice as Jordan's assignment from Aoife.
  const after = await stored(page, email);
  expect(after.profile).toMatchObject({ preferences: { goal: "calm", onboardedAt: expect.any(String) } });
  expect(after.assignments).toEqual([
    expect.objectContaining({ mode: "paced", pacerHalfCycleSec: 5, durationSec: 300, target: 14, note: "Between visits", cancelled: false }),
  ]);
});

test("a signed-in, set-up athlete accepts a coach's invite and just confirms the share, without onboarding", async ({ page }) => {
  // The demo coach is an older account with no kind: "coach", and scores and curves, as before.
  await signInAsCoach(page);
  await page.goto("/cloud/athletes/");
  await page.getByLabel("Athlete's name").fill("Alex Morgan");
  await page.getByLabel("Phone number or email").fill("alex@example.com");
  await expect(page.getByLabel("First practice (optional)")).toHaveCount(0);
  await page.getByRole("button", { name: "Create invite link" }).click();
  const url = (await page.locator("output.inv-link").textContent()) ?? "";
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((u) => u.pathname === "/cloud/");

  await signInAsAthlete(page);
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Lena Vos (coach) would like to see your scores and breathing curves." })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Scores and curves/ })).toBeChecked();
  await page.getByRole("button", { name: "Accept: share scores and curves" }).click();
  await expect(page.getByRole("heading", { name: "You're sharing with Lena Vos" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/cloud/join/");
});
