import { expect, test, type Page } from "@playwright/test";

// T-0118: professional onboarding ends with the kind's defaults for the people
// they invite, its practice templates, and the professional terms. A clinician
// must also give the wellness acknowledgement, an educator the 16+ one. The
// terms are kept as consent records; the defaults on proProfile.

const DB_KEY = "breathband-console:local-db";
const WELLNESS =
  "Breathband is a wellness tool. It doesn't diagnose, treat or monitor any condition. Don't record diagnoses, medical history or treatment in BreathCloud.";

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
  await page.getByRole("button", { name: "Continue" }).click();
  return email;
}

const continueButton = (page: Page) => page.getByRole("button", { name: "Continue" });
const next = (page: Page) => continueButton(page).click();
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

test("a clinician: defaults and templates, and no finishing without the wellness acknowledgement", async ({ page }) => {
  test.setTimeout(120_000);
  const email = await signUpAsProfessional(page, "Lena");
  await page.getByRole("radio", { name: /Clinician or therapist/ }).click();
  await next(page);
  await pick(page, "What's your profession?", "Physiotherapist");
  await page.getByLabel("Country").fill("Ireland");
  await next(page);
  await pick(page, "Pick any that apply", "Breathing pattern practice between visits");
  await next(page);
  await next(page);

  // Step 7: 5 sessions a week, no score target, scores and curves requested.
  await expect(page.getByRole("heading", { name: "Defaults for the clients you invite" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Sessions a week" }).getByRole("button", { name: "5", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Starting targets: 5 sessions a week. No score target at first.")).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Scores and curves/ })).toHaveAttribute("aria-checked", "true");
  await next(page);

  // Step 8: the clinician's templates.
  await expect(page.getByRole("heading", { name: "Practice templates" })).toBeVisible();
  const templates = page.getByRole("list", { name: "Your practice templates" });
  await expect(templates.getByText("Daily slow breathing", { exact: true })).toBeVisible();
  await expect(templates.getByText("Weekly open check", { exact: true })).toBeVisible();
  await expect(templates.getByText("Between visits", { exact: true })).toBeVisible();
  await expect(templates.getByText("Open · 3 min")).toBeVisible();
  await next(page);

  // The terms: draft, both boxes required, the private-notes hint.
  await expect(page.getByRole("heading", { name: "Professional terms" })).toBeVisible();
  await expect(page.getByRole("note", { name: "Draft" })).toContainText("Draft for counsel's review");
  await expect(page.getByText(/For practice notes only\. Don't record diagnoses or medical history here\./)).toBeVisible();
  await expect(continueButton(page)).toBeDisabled();
  await page.getByRole("checkbox", { name: "I agree to the professional terms." }).check();
  await expect(continueButton(page)).toBeDisabled();
  await page.getByRole("checkbox", { name: WELLNESS }).check();
  await expect(continueButton(page)).toBeEnabled();
  await page.getByRole("checkbox", { name: WELLNESS }).uncheck();
  await expect(continueButton(page)).toBeDisabled();
  await page.getByRole("checkbox", { name: WELLNESS }).check();
  await next(page);

  await expect(page.getByRole("heading", { name: "You're set, Lena." })).toBeVisible();
  await expect(page.getByText("5 sessions a week")).toBeVisible();
  await page.getByRole("button", { name: "Go to the dashboard" }).click();
  await page.waitForURL((url) => url.pathname === "/cloud/");

  const profile = await storedProfile(page, email);
  expect(profile).toMatchObject({
    proKind: "clinician",
    proProfile: { kind: "clinician", defaultTargets: { sessionsPerWeek: 5 }, scopeRequested: "curves" },
  });
  expect((profile?.proProfile as { defaultTargets: object }).defaultTargets).not.toHaveProperty("score");
  const consents = profile?.consents as { kind: string; version: string; acceptedAt: string }[];
  expect(consents.map((c) => c.kind)).toEqual(["terms", "privacy", "breathing-data", "professional-terms", "wellness-acknowledgement"]);
  for (const c of consents.slice(3)) {
    expect(c.version).toMatch(/^draft-/);
    expect(Date.parse(c.acceptedAt)).not.toBeNaN();
  }
});

test("an educator: scores only, 16+ acknowledgement, and changed sessions a week are stored", async ({ page }) => {
  test.setTimeout(120_000);
  const email = await signUpAsProfessional(page, "Priya");
  await page.getByRole("radio", { name: /Teacher or counsellor/ }).click();
  await next(page);
  await pick(page, "What's your role?", "Teacher");
  await next(page);
  await pick(page, "Pick any that apply", "Exam stress");
  await next(page);
  await next(page);

  await expect(page.getByRole("heading", { name: "Defaults for the students you invite" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Scores only/ })).toHaveAttribute("aria-checked", "true");
  await pick(page, "Sessions a week", "4");
  await next(page);
  await expect(page.getByText("Focus Sprint", { exact: true })).toBeVisible();
  await expect(page.getByText("Exam Week", { exact: true })).toBeVisible();
  await expect(page.getByText("Paced 5-5 · 3 min · with a group")).toBeVisible();
  await next(page);

  await expect(page.getByRole("checkbox", { name: WELLNESS })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "I agree to the professional terms." }).check();
  await expect(continueButton(page)).toBeDisabled();
  await page.getByRole("checkbox", { name: "Only invite students aged 16 or over." }).check();
  await next(page);
  await page.getByRole("button", { name: "Add students" }).click();
  await page.waitForURL((url) => url.pathname === "/cloud/athletes/");

  const profile = await storedProfile(page, email);
  expect(profile).toMatchObject({ proProfile: { kind: "educator", defaultTargets: { sessionsPerWeek: 4 }, scopeRequested: "scores" } });
  expect((profile?.consents as { kind: string }[]).map((c) => c.kind).slice(3)).toEqual(["professional-terms", "student-age-acknowledgement"]);
});

test("a coach: the terms alone, and the coach's targets", async ({ page }) => {
  test.setTimeout(120_000);
  const email = await signUpAsProfessional(page, "Marco");
  await page.getByRole("radio", { name: /Coach or trainer/ }).click();
  await next(page);
  await pick(page, "Which sports do you coach?", "Running");
  await pick(page, "At what level?", "Amateur");
  await next(page);
  await pick(page, "Pick any that apply", "Recovery");
  await next(page);
  await next(page);

  await expect(page.getByText("Starting targets: Total 7 · 12–16 breaths a minute · 4 sessions a week.")).toBeVisible();
  await page.getByRole("radio", { name: /^Scores only/ }).click();
  await next(page);
  await expect(page.getByText("Pre-training Activation", { exact: true })).toBeVisible();
  await expect(page.getByText("Paced 2-2 · 2 min")).toBeVisible();
  await next(page);

  await expect(page.getByRole("checkbox")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "I agree to the professional terms." }).check();
  await next(page);
  await page.getByRole("button", { name: "Add athletes" }).click();
  await page.waitForURL((url) => url.pathname === "/cloud/athletes/");

  const profile = await storedProfile(page, email);
  expect(profile).toMatchObject({
    proProfile: { kind: "coach", defaultTargets: { score: 7, rateLow: 12, rateHigh: 16, sessionsPerWeek: 4 }, scopeRequested: "scores" },
  });
  expect((profile?.consents as { kind: string }[]).map((c) => c.kind).slice(3)).toEqual(["professional-terms"]);
});
