import { expect, test, type Page } from "@playwright/test";

// Signs the demo people in, on either backend (T-0139). playwright.config.ts runs
// the local backend: the login page's demo buttons, checked through localStorage.
// playwright.http.config.ts names its project's backend "http" in its metadata:
// there the login page has the form only, and the API's seed (`npm run db:seed`)
// writes the same people with the demo password.

const DB_KEY = "breathband-console:local-db";
const SIGN_IN_DEADLINE_MS = 90_000;

const DEMO_PASSWORD = "breathband";
// Better Auth allows 5 sign-ins a minute per client (SIGN_IN_RATE_LIMIT in
// server/auth.ts), and the demo specs sign in more often than that. A refused
// sign-in (429) is waited out and tried again, the way a person would.
const RATE_LIMITED_DEADLINE_MS = 180_000;
const RATE_LIMIT_WAIT_MS = 20_000;

/** The backend the running project's web app was built for. */
export function e2eBackend(): "local" | "http" {
  return test.info().project.metadata?.backend === "http" ? "http" : "local";
}

type Person = { name: string; uid: string; email: string };

async function signInWithDemoButton(page: Page, { name, uid }: Person): Promise<void> {
  await page.goto("/cloud/login/");
  const card = page.getByRole("button", { name: new RegExp(`Sign in as ${name}`) });
  const deadline = Date.now() + SIGN_IN_DEADLINE_MS;
  for (;;) {
    await card.click({ timeout: 30_000 });
    const signedIn = await page
      .waitForFunction(
        ([key, expected]) => {
          const db = globalThis.localStorage.getItem(key);
          return db !== null && JSON.parse(db).currentUid === expected;
        },
        [DB_KEY, uid] as const,
        { timeout: 3_000 },
      )
      .then(
        () => true,
        () => false,
      );
    if (signedIn) break;
    if (Date.now() > deadline) {
      throw new Error(`${name}'s demo sign-in (uid ${uid}) didn't take within ${SIGN_IN_DEADLINE_MS / 1000}s`);
    }
  }
  await page.waitForURL((url) => !url.pathname.startsWith("/cloud/login"), {
    timeout: 30_000,
  });
}

/**
 * Fills the login form and submits it, waiting out rate limits (and checking the
 * page says so, T-0139). Answers the API's status for the last attempt.
 */
export async function submitLoginForm(page: Page, email: string, password: string): Promise<number> {
  const deadline = Date.now() + RATE_LIMITED_DEADLINE_MS;
  for (;;) {
    await page.goto("/cloud/login/");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    const answer = page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/auth/sign-in/email",
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const status = (await answer).status();
    if (status !== 429) return status;
    await expect(page.getByText("Too many attempts. Wait a minute and try again.")).toBeVisible();
    if (Date.now() > deadline) throw new Error(`${email} stayed rate limited for ${RATE_LIMITED_DEADLINE_MS / 1000}s`);
    await page.waitForTimeout(RATE_LIMIT_WAIT_MS);
  }
}

async function signInWithForm(page: Page, { email }: Person): Promise<void> {
  const status = await submitLoginForm(page, email, DEMO_PASSWORD);
  if (status !== 200) throw new Error(`Signing in as ${email} answered ${status}`);
  await page.waitForURL((url) => !url.pathname.startsWith("/cloud/login"), { timeout: 30_000 });
}

function signInAs(page: Page, person: Person): Promise<void> {
  return e2eBackend() === "http" ? signInWithForm(page, person) : signInWithDemoButton(page, person);
}

export function signInAsCoach(page: Page): Promise<void> {
  return signInAs(page, { name: "Lena Vos", uid: "demo-coach", email: "coach@demo.local" });
}

export function signInAsAthlete(page: Page): Promise<void> {
  return signInAs(page, { name: "Alex Morgan", uid: "demo-athlete", email: "athlete@demo.local" });
}

// The demo plan's people (planning/v1/05, T-0127).

export function signInAsCalm(page: Page): Promise<void> {
  return signInAs(page, { name: "Maya Brooks", uid: "demo-maya", email: "maya@demo.local" });
}

export function signInAsFocus(page: Page): Promise<void> {
  return signInAs(page, { name: "Sam Okafor", uid: "demo-athlete-2", email: "sam@demo.local" });
}

export function signInAsClinician(page: Page): Promise<void> {
  return signInAs(page, { name: "Ana Ruiz", uid: "demo-ana", email: "ana@demo.local" });
}

export function signInAsClient(page: Page): Promise<void> {
  return signInAs(page, { name: "Jordan Lee", uid: "demo-jordan", email: "jordan@demo.local" });
}

export function signInAsEducator(page: Page): Promise<void> {
  return signInAs(page, { name: "Chris Park", uid: "demo-chris", email: "chris@demo.local" });
}
