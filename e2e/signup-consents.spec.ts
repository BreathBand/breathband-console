import { expect, test, type Page } from "@playwright/test";

const DB_KEY = "breathband-console:local-db";

async function fillAccount(page: Page, email: string, birthYear: string) {
  await page.goto("/cloud/signup/");
  await page.getByLabel("Name").fill("Robin Ash");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).first().fill("breathe-easy-123");
  await page.getByLabel("Year of birth").fill(birthYear);
}

const create = (page: Page) => page.getByRole("button", { name: "Create account" }).click();

test("sign-up needs both consents and stores them with the birth year", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `robin${Date.now()}@example.com`;
  await fillAccount(page, email, "1994");

  await create(page);
  await expect(page.getByText("Agree to the terms and privacy notice to create an account.")).toBeVisible();
  await page.getByLabel(/terms of use/).check();
  await create(page);
  await expect(page.getByText("Breathband needs this to score your sessions.")).toBeVisible();
  await page.getByLabel(/breathing data/).check();
  await create(page);

  await page.waitForURL(/\/cloud\/welcome\//, { timeout: 60_000 });
  const profile = await page.evaluate(
    ([key, address]) => {
      const db = JSON.parse(globalThis.localStorage.getItem(key) ?? "{}");
      return Object.values(db.accounts as Record<string, { profile: { email: string } }>).find(
        (a) => a.profile.email === address,
      )?.profile;
    },
    [DB_KEY, email] as const,
  );
  expect(profile).toMatchObject({
    birthYear: 1994,
    consents: [{ kind: "terms" }, { kind: "privacy" }, { kind: "breathing-data" }],
  });
});

test("an under-16 birth year stops sign-up with the age message", async ({ page }) => {
  test.setTimeout(120_000);
  const thisYear = new Date().getFullYear();
  await fillAccount(page, `young${Date.now()}@example.com`, String(thisYear - 15));
  await page.getByLabel(/terms of use/).check();
  await page.getByLabel(/breathing data/).check();
  await create(page);

  await expect(page.getByText("Breathband is for people 16 and over for now.")).toBeVisible();
  await expect(page.getByLabel("Year of birth")).toBeFocused();
  await expect(page).toHaveURL(/\/cloud\/signup\//);
  const signedIn = await page.evaluate((key) => JSON.parse(globalThis.localStorage.getItem(key) ?? "{}").currentUid ?? null, DB_KEY);
  expect(signedIn).toBeNull();
});
