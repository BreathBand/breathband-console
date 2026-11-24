import type { Page } from "@playwright/test";

const DB_KEY = "breathband-console:local-db";
const SIGN_IN_DEADLINE_MS = 90_000;

async function signInAs(page: Page, name: string, uid: string): Promise<void> {
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

export function signInAsCoach(page: Page): Promise<void> {
  return signInAs(page, "Lena Vos", "demo-coach");
}

export function signInAsAthlete(page: Page): Promise<void> {
  return signInAs(page, "Alex Morgan", "demo-athlete");
}
