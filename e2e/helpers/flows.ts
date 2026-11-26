import { expect, type Page } from "@playwright/test";

// Shared steps for the P1 specs and the demo script spec (T-0131). The older
// specs keep their own copies; these are new and used only by the new files.

export const DB_KEY = "breathband-console:local-db";
export const PASSWORD = "breathe-easy-123";

export type Goal = "Train" | "Focus" | "Calm";
export type ProKind = "coach" | "clinician" | "educator";

export const next = (page: Page) => page.getByRole("button", { name: "Continue" }).click();

export const pick = (page: Page, question: string, option: string) =>
  page.getByRole("group", { name: question, exact: true }).getByRole("button", { name: option, exact: true }).click();

/** A unique address for a person made by a test. */
export function emailFor(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z]/g, "")}${Date.now()}@example.com`;
}

/** Sign up from /cloud/signup/ (as a professional when `pro`), landing on the welcome flow's first step. */
export async function signUp(page: Page, opts: { name: string; email: string; year: string; pro?: boolean }): Promise<void> {
  await page.goto("/cloud/signup/");
  if (opts.pro) await page.getByRole("radio", { name: /^Coach/ }).check();
  await page.getByLabel("Name").fill(opts.name);
  await page.getByLabel("Email").fill(opts.email);
  await page.getByLabel(/^Password/).first().fill(PASSWORD);
  await page.getByLabel("Year of birth").fill(opts.year);
  await page.getByLabel(/terms of use/).check();
  await page.getByLabel(/breathing data/).check();
  await page.getByRole("button", { name: /Create/ }).click();
  await page.waitForURL(/\/cloud\/welcome\//, { timeout: 60_000 });
}

/** Sign in with the form (for accounts a test made; demo people use e2e/auth.ts). */
export async function signInWithPassword(page: Page, email: string): Promise<void> {
  await page.goto("/cloud/login/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/cloud/login"), { timeout: 60_000 });
}

/** The sidebar's Sign out; lands on the signed-out /cloud/ page. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((u) => u.pathname === "/cloud/");
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
}

/** The stored account for an address, with its assignments, sessions and the invites it sent. */
export async function stored(page: Page, email: string) {
  return page.evaluate(
    ([key, address]) => {
      type Profile = { uid: string; email: string } & Record<string, unknown>;
      const db = JSON.parse(globalThis.localStorage.getItem(key) ?? "{}");
      const account = Object.values(db.accounts as Record<string, { profile: Profile }>).find((a) => a.profile.email === address);
      const uid = account?.profile.uid ?? "";
      return {
        profile: account?.profile,
        assignments: (db.assignments?.[uid] ?? []) as Record<string, unknown>[],
        sessions: (db.sessions?.[uid] ?? []) as Record<string, unknown>[],
        invites: ((db.coachInvites ?? []) as { coachId: string; code: string; athleteName: string }[]).filter((i) => i.coachId === uid),
      };
    },
    [DB_KEY, email] as const,
  );
}

/** In the band step: the simulated band, connected. */
export async function connectSimulatedBand(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Your band" })).toBeVisible();
  const routes = page.getByRole("radiogroup", { name: "How you'll breathe with Breathband" });
  await routes.getByRole("radio", { name: /Simulated band/ }).click();
  await page.getByRole("button", { name: "Start the simulated band" }).click();
  await expect(page.getByText(/Simulated band connected/)).toBeVisible({ timeout: 15_000 });
}

/**
 * On the instrument: the strap check passes by itself, then the 20-second
 * calibration, then Begin. Real time: the simulated band breathes at human speed.
 */
export async function calibrateAndBegin(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Full breaths for 20 seconds" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Calibrated" })).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.getByRole("button", { name: /Stop early/ })).toBeVisible({ timeout: 10_000 });
}

/** The individual's onboarding after the welcome step: goal, its questions, experience, sessions, plan, up to the band step. */
export async function individualToBandStep(page: Page, goal: Goal, answer?: () => Promise<void>): Promise<void> {
  await next(page);
  await page.getByRole("radio", { name: new RegExp(goal) }).click();
  await next(page);
  if (answer) {
    await answer();
    await next(page);
  } else {
    await page.getByRole("button", { name: "Skip these" }).click();
  }
  await expect(page.getByRole("heading", { name: "How much breath training have you done?" })).toBeVisible();
  await page.getByRole("radio", { name: /New to it/ }).click();
  await next(page);
  await expect(page.getByRole("heading", { name: "Your sessions" })).toBeVisible();
  await next(page);
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await next(page);
  await expect(page.getByRole("heading", { name: "Your band" })).toBeVisible();
}

const KIND_RADIO: Record<ProKind, RegExp> = {
  coach: /Coach or trainer/,
  clinician: /Clinician or therapist/,
  educator: /Teacher or counsellor/,
};

/** A professional's kind, practice and use: from the welcome step to "How do you refer to the people you work with?". */
export async function professionalToTerminology(page: Page, kind: ProKind): Promise<void> {
  await expect(page.getByRole("heading", { name: "Welcome to BreathCloud." })).toBeVisible();
  await next(page);
  await page.getByRole("radio", { name: KIND_RADIO[kind] }).click();
  await next(page);
  await expect(page.getByRole("heading", { name: "Your practice" })).toBeVisible();
  if (kind === "coach") {
    await pick(page, "Which sports do you coach?", "Team sport");
    await pick(page, "At what level?", "Collegiate");
  } else if (kind === "clinician") {
    await pick(page, "What's your profession?", "Physiotherapist");
    await page.getByLabel("Country").fill("Ireland");
  } else {
    await page.getByLabel(/School or college/).fill("Northfield College");
    await pick(page, "What's your role?", "Counsellor");
  }
  await next(page);
  await expect(page.getByRole("heading", { name: "What will you use it for?" })).toBeVisible();
  const use = { coach: "Pre-competition calm", clinician: "Breathing pattern practice between visits", educator: "Exam stress" }[kind];
  await pick(page, "Pick any that apply", use);
  await next(page);
  await expect(page.getByRole("heading", { name: /How do you refer to the people/ })).toBeVisible();
}
