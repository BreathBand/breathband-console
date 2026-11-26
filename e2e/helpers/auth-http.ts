import type { Page } from "@playwright/test";

// e2e/auth.ts for the http backend (T-0136). playwright.http.config.ts loads this
// file wherever a spec imports "./auth", so the demo specs run unchanged on both
// backends. Same exports, same people: the API's seed (`npm run db:seed`) writes
// the local adapter's demo accounts. On http the login page has no demo buttons,
// so each person signs in through the form with the demo password.

const DEMO_PASSWORD = "breathband";
// Better Auth allows 5 sign-ins a minute per client (SIGN_IN_RATE_LIMIT in
// server/auth.ts), and the demo specs sign in more often than that. A refused
// sign-in (429) is waited out and tried again, the way a person would.
const SIGN_IN_DEADLINE_MS = 180_000;
const RATE_LIMIT_WAIT_MS = 20_000;

async function signInAs(page: Page, email: string): Promise<void> {
  const deadline = Date.now() + SIGN_IN_DEADLINE_MS;
  for (;;) {
    await page.goto("/cloud/login/");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(DEMO_PASSWORD);
    const answer = page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/auth/sign-in/email",
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const status = (await answer).status();
    if (status !== 429) {
      if (status !== 200) throw new Error(`Signing in as ${email} answered ${status}`);
      await page.waitForURL((url) => !url.pathname.startsWith("/cloud/login"), { timeout: 30_000 });
      return;
    }
    if (Date.now() > deadline) throw new Error(`${email} stayed rate limited for ${SIGN_IN_DEADLINE_MS / 1000}s`);
    await page.waitForTimeout(RATE_LIMIT_WAIT_MS);
  }
}

export async function signInAsCoach(page: Page): Promise<void> {
  await signInAs(page, "coach@demo.local");
}

export async function signInAsAthlete(page: Page): Promise<void> {
  await signInAs(page, "athlete@demo.local");
}

export async function signInAsCalm(page: Page): Promise<void> {
  await signInAs(page, "maya@demo.local");
}

export async function signInAsFocus(page: Page): Promise<void> {
  await signInAs(page, "sam@demo.local");
}

export async function signInAsClinician(page: Page): Promise<void> {
  await signInAs(page, "ana@demo.local");
}

export async function signInAsClient(page: Page): Promise<void> {
  await signInAs(page, "jordan@demo.local");
}

export async function signInAsEducator(page: Page): Promise<void> {
  await signInAs(page, "chris@demo.local");
}
