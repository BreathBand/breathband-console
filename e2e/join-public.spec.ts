import { expect, test, type Page } from "@playwright/test";
import { signInAsCoach } from "./auth";

// T-0129: a professional's invite link, opened by someone who isn't signed in
// (planning/v1/02 §2: "who invited them and what they're asking to see, then
// sign up"). The page names the professional in their own terms, the scope
// they ask for, and offers sign-up or sign-in, both carrying the code back to
// the join page. A code that isn't a pending invite gets one neutral message.

const DB_KEY = "breathband-console:local-db";

/** The demo coach (Lena Vos, an older account with no kind) makes an invite link, then signs out. */
async function coachInvites(page: Page, athleteName: string): Promise<string> {
  await signInAsCoach(page);
  await page.goto("/cloud/athletes/");
  await page.getByLabel("Athlete's name").fill(athleteName);
  await page.getByLabel("Phone number or email").fill("alex@example.com");
  await page.getByRole("button", { name: "Create invite link" }).click();
  const url = (await page.locator("output.inv-link").textContent()) ?? "";
  expect(url).toMatch(/\/cloud\/join\/\?code=/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((u) => u.pathname === "/cloud/");
  return url;
}

test("signed out, the invite says who's asking and what they'd see; signing in on it comes back to accept", async ({ page }) => {
  const url = await coachInvites(page, "Alex Morgan");
  const code = new URL(url).searchParams.get("code") ?? "";

  await page.goto(url);
  // No bounce to sign-in: the invite itself, without the app's chrome.
  await expect(page.getByRole("heading", { name: "Lena Vos (coach) would like to see your scores and breathing curves." })).toBeVisible();
  await expect(page.getByText("Invitation to share from your coach")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/cloud/join/");
  await expect(page.getByRole("navigation", { name: "BreathCloud" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Accept/ })).toHaveCount(0);

  // Sign up carries the code through ?next=.
  const signUp = page.getByRole("link", { name: "Sign up to accept" });
  await expect(signUp).toHaveAttribute("href", `/cloud/signup/?next=${encodeURIComponent(`/cloud/join/?code=${code}`)}`);

  // An existing account signs in from the invite and lands back on it, signed in, to choose and accept.
  await page.getByRole("link", { name: "I already have an account" }).click();
  await page.waitForURL(/\/cloud\/login\/\?next=%2Fcloud%2Fjoin%2F/);
  await page.getByRole("button", { name: /Sign in as Alex Morgan/ }).click();
  await page.waitForURL((u) => u.pathname === "/cloud/join/" && u.searchParams.get("code") === code, { timeout: 60_000 });
  await expect(page.getByRole("radio", { name: /Scores and curves/ })).toBeChecked();
  await page.getByRole("button", { name: "Accept: share scores and curves" }).click();
  await expect(page.getByRole("heading", { name: "You're sharing with Lena Vos" })).toBeVisible();
});

test("signed out, an unknown, revoked or missing code shows a neutral message that names nobody", async ({ page }) => {
  const url = await coachInvites(page, "Sam Kerr");
  const code = new URL(url).searchParams.get("code") ?? "";
  await page.evaluate(
    ([key, revoked]) => {
      const db = JSON.parse(globalThis.localStorage.getItem(key) ?? "{}");
      for (const invite of db.coachInvites as { code: string; status: string }[]) if (invite.code === revoked) invite.status = "revoked";
      globalThis.localStorage.setItem(key, JSON.stringify(db));
    },
    [DB_KEY, code] as const,
  );

  for (const link of [url, "/cloud/join/?code=ZZZZ2222"]) {
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "This invite isn't available" })).toBeVisible();
    await expect(page.getByText(/Lena/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", /^\/cloud\/login\/\?next=%2Fcloud%2Fjoin%2F/);
  }

  await page.goto("/cloud/join/");
  await expect(page.getByRole("heading", { name: "This link is missing its invite code" })).toBeVisible();
});
