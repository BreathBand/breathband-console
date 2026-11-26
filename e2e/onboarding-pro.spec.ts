import { expect, test, type Page } from "@playwright/test";

// T-0112: a professional (signed up as Coach) is asked what kind of work they
// do, their practice, what they'll use Breathband for and what they call the
// people they work with; the answers are stored as proKind and proProfile.

const DB_KEY = "breathband-console:local-db";

async function signUpAsProfessional(page: Page, name: string): Promise<string> {
  const email = `${name.toLowerCase()}${Date.now()}@example.com`;
  await page.goto("/cloud/signup/");
  await page.getByRole("radio", { name: /^Coach/ }).check();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).first().fill("breathe-easy-123");
  await page.getByLabel("Year of birth").fill("1985");
  await page.getByLabel(/terms of use/).check();
  await page.getByLabel(/breathing data/).check();
  await page.getByRole("button", { name: /Create/ }).click();
  await page.waitForURL(/\/cloud\/welcome\//, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Welcome to BreathCloud." })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  return email;
}

const next = (page: Page) => page.getByRole("button", { name: "Continue" }).click();
const pick = (page: Page, question: string, option: string) =>
  page.getByRole("group", { name: question, exact: true }).getByRole("button", { name: option, exact: true }).click();

async function storedProfile(page: Page, email: string) {
  return page.evaluate(
    ([key, address]) => {
      const db = JSON.parse(globalThis.localStorage.getItem(key) ?? "{}");
      return Object.values(db.accounts as Record<string, { profile: { email: string } & Record<string, unknown> }>).find((a) => a.profile.email === address)?.profile;
    },
    [DB_KEY, email] as const,
  );
}

test("a coach: sports, level and team, use cases, and athletes by default", async ({ page }) => {
  test.setTimeout(120_000);
  const email = await signUpAsProfessional(page, "Marta");

  await expect(page.getByRole("heading", { name: "What kind of work do you do, Marta?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByRole("radio", { name: /Coach or trainer/ }).click();
  await next(page);

  await expect(page.getByRole("heading", { name: "Your practice" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await pick(page, "Which sports do you coach?", "Team sport");
  await pick(page, "Which sports do you coach?", "Something else");
  await page.getByLabel("Your sport or activity").fill("Rowing");
  await pick(page, "At what level?", "Collegiate");
  await page.getByLabel(/Team or club/).fill("  Riverside Rowing Club ");
  await next(page);

  await expect(page.getByRole("heading", { name: "What will you use it for?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await pick(page, "Pick any that apply", "Pre-competition calm");
  await pick(page, "Pick any that apply", "Team warm-ups");
  await next(page);

  await expect(page.getByRole("heading", { name: /How do you refer to the people/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Athletes/ })).toHaveAttribute("aria-checked", "true");
  await next(page);

  await expect(page.getByRole("heading", { name: "You're set, Marta." })).toBeVisible();
  await expect(page.getByText("Add your first athletes")).toBeVisible();
  await expect(page.getByText("Team sport, Rowing · Collegiate · Riverside Rowing Club")).toBeVisible();
  await page.getByRole("button", { name: "Add athletes" }).click();
  await page.waitForURL((url) => url.pathname === "/cloud/athletes/");

  const profile = await storedProfile(page, email);
  expect(profile).toMatchObject({
    role: "coach",
    proKind: "coach",
    proProfile: {
      kind: "coach",
      organisation: "Riverside Rowing Club",
      profession: null,
      sports: ["team", "other"],
      sportOther: "Rowing",
      level: "collegiate",
      country: null,
      useCases: ["pre-competition", "team-warm-ups"],
      terminology: "athletes",
    },
    preferences: { onboardedAt: expect.any(String) },
  });
});

test("a clinician: profession and country, their own use cases, and clients by default", async ({ page }) => {
  test.setTimeout(120_000);
  const email = await signUpAsProfessional(page, "Niamh");

  // Coach first, then back to change the kind: the clinician's questions follow.
  await page.getByRole("radio", { name: /Coach or trainer/ }).click();
  await next(page);
  await expect(page.getByRole("group", { name: "Which sports do you coach?" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("radio", { name: /Clinician or therapist/ }).click();
  await next(page);

  await expect(page.getByRole("heading", { name: "Your practice" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Which sports do you coach?" })).toHaveCount(0);
  await pick(page, "What's your profession?", "Physiotherapist");
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByLabel("Country").fill("Ireland");
  await next(page);

  await expect(page.getByRole("button", { name: "Pre-competition calm" })).toHaveCount(0);
  await pick(page, "Pick any that apply", "Breathing pattern practice between visits");
  await pick(page, "Pick any that apply", "Stress and anxiety skills");
  await next(page);

  await expect(page.getByRole("radio", { name: /^Clients/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: /Patients/ })).toHaveCount(0);
  await next(page);

  await expect(page.getByText("Add your first clients")).toBeVisible();
  await expect(page.getByText("Physiotherapist · Ireland")).toBeVisible();
  await page.getByRole("button", { name: "Go to the dashboard" }).click();
  await page.waitForURL((url) => url.pathname === "/cloud/");

  const profile = await storedProfile(page, email);
  expect(profile).toMatchObject({
    role: "coach",
    proKind: "clinician",
    proProfile: {
      kind: "clinician",
      organisation: null,
      profession: "physiotherapist",
      sports: [],
      level: null,
      country: "Ireland",
      useCases: ["between-visits", "stress-anxiety"],
      terminology: "clients",
    },
  });
  expect(profile?.proProfile).not.toHaveProperty("sportOther");
});

test("an educator who calls people athletes: the override is stored and used", async ({ page }) => {
  test.setTimeout(120_000);
  const email = await signUpAsProfessional(page, "Owen");
  await page.getByRole("radio", { name: /Teacher or counsellor/ }).click();
  await next(page);
  await page.getByLabel(/School or college/).fill("Northfield College");
  await pick(page, "What's your role?", "Coach");
  await expect(page.getByText("For now, Breathband is for students aged 16 and over.")).toBeVisible();
  await next(page);
  await pick(page, "Pick any that apply", "Class calm");
  await next(page);
  await expect(page.getByRole("radio", { name: /^Students/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: /^Athletes/ }).click();
  await next(page);

  await expect(page.getByRole("button", { name: "Add athletes" })).toBeVisible();
  await page.getByRole("button", { name: "Add athletes" }).click();
  await page.waitForURL((url) => url.pathname === "/cloud/athletes/");
  expect(await storedProfile(page, email)).toMatchObject({
    proKind: "educator",
    proProfile: { kind: "educator", organisation: "Northfield College", profession: "coach", useCases: ["class-calm"], terminology: "athletes" },
  });
});
