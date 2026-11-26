import { expect, test, type Page } from "@playwright/test";
import { signInAsCoach } from "./auth";

// T-0120: professional onboarding ends with "Try it yourself" (the existing
// recorder, or skip), the first invite (link, QR code, copy) in the
// professional's own words, and a dashboard checklist for their kind with a
// sample person until the first real person joins. The sample is never stored.

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
  await page.getByRole("button", { name: "Continue" }).click();
  return email;
}

const next = (page: Page) => page.getByRole("button", { name: "Continue" }).click();
const pick = (page: Page, question: string, option: string) =>
  page.getByRole("group", { name: question, exact: true }).getByRole("button", { name: option, exact: true }).click();

/** From the defaults step: templates, then the terms with every box ticked; Continue saves the profile. */
async function throughTheTerms(page: Page) {
  await expect(page.getByRole("heading", { name: /^Defaults for the/ })).toBeVisible();
  await next(page);
  await next(page);
  await expect(page.getByRole("heading", { name: "Professional terms" })).toBeVisible();
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await next(page);
}

async function stored(page: Page, email: string) {
  return page.evaluate(
    ([key, address]) => {
      const db = JSON.parse(globalThis.localStorage.getItem(key) ?? "{}");
      const account = Object.values(db.accounts as Record<string, { profile: { uid: string; email: string } & Record<string, unknown> }>).find(
        (a) => a.profile.email === address,
      );
      const uid = account?.profile.uid ?? "";
      return {
        profile: account?.profile,
        sessions: (db.sessions?.[uid] ?? []) as unknown[],
        invites: (db.coachInvites as { coachId: string; athleteName: string; contact: string; code: string }[]).filter((i) => i.coachId === uid),
      };
    },
    [DB_KEY, email] as const,
  );
}

const checklist = (page: Page) => page.getByRole("region", { name: "Getting started" });

test("a clinician skips the try-out, invites a client with a link and QR code, and lands on a checklist with a sample client", async ({ page, context }) => {
  test.setTimeout(150_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const email = await signUpAsProfessional(page, "Aoife");
  await page.getByRole("radio", { name: /Clinician or therapist/ }).click();
  await next(page);
  await pick(page, "What's your profession?", "Physiotherapist");
  await page.getByLabel("Country").fill("Ireland");
  await next(page);
  await pick(page, "Pick any that apply", "Stress and anxiety skills");
  await next(page);
  await next(page);
  await throughTheTerms(page);

  // E8: try it yourself, in the clinician's words; skipped here.
  await expect(page.getByRole("heading", { name: "Try it yourself" })).toBeVisible();
  await expect(page.getByText("Do what you'll ask your clients to do.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record with the simulated band" })).toBeVisible();
  // Agreeing to the terms saved the profile, before anything left the page.
  expect((await stored(page, email)).profile).toMatchObject({ proKind: "clinician", preferences: { onboardedAt: expect.any(String) } });
  await page.getByRole("button", { name: "Skip for now" }).click();

  // E9: the invite, through the existing capability, in the clinician's terms.
  await expect(page.getByRole("heading", { name: "Invite your first client" })).toBeVisible();
  await page.getByLabel("Client's name").fill("Jordan Lee");
  await page.getByLabel("Phone number or email").fill("jordan@example.com");
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByText("Invite for Jordan Lee is ready.", { exact: false })).toBeVisible();
  const link = page.locator("output.inv-link");
  await expect(link).toHaveText(/\/cloud\/join\/\?code=[A-Z0-9-]+$/);
  const url = (await link.textContent()) ?? "";
  const qr = page.getByRole("img", { name: "QR code of the invite link for Jordan Lee" });
  await expect(qr).toBeVisible();
  expect(await qr.locator("path").getAttribute("d")).toMatch(/^M\d+ \d+h1v1h-1z/);
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  const { invites } = await stored(page, email);
  expect(invites).toHaveLength(1);
  expect(invites[0]).toMatchObject({ athleteName: "Jordan Lee", contact: "jordan@example.com" });
  expect(url.endsWith(`code=${encodeURIComponent(invites[0].code)}`)).toBe(true);
  await next(page);

  await expect(page.getByRole("heading", { name: "You're set, Aoife." })).toBeVisible();
  await expect(page.getByText("Your invite for Jordan Lee is ready.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Go to the dashboard" }).click();
  await page.waitForURL((u) => u.pathname === "/cloud/");

  // E10: the clinician's checklist; the open invite ticks the first item.
  await expect(checklist(page)).toBeVisible();
  await expect(checklist(page).getByText("1 of 3 done")).toBeVisible();
  await expect(checklist(page).getByText("Done: Invite a client")).toBeAttached();
  await expect(checklist(page).getByText("Try a session yourself")).toBeVisible();
  await expect(checklist(page).getByRole("link", { name: "Record" })).toHaveAttribute("href", /\/cloud\/record\/live\/\?.*first=first-session/);
  await expect(checklist(page).getByText("Assign a between-visits plan")).toBeVisible();
  await expect(checklist(page).getByText("After your first client joins")).toBeVisible();

  // The sample client, clearly labelled, while no real client has joined.
  await expect(page.getByRole("heading", { name: "No clients yet" })).toBeVisible();
  const sample = page.getByRole("region", { name: "Sample client: Riley" });
  await expect(sample).toBeVisible();
  await expect(sample.getByText("Sample", { exact: true })).toBeVisible();
  await expect(sample.getByRole("list", { name: "Sample sessions" }).getByRole("listitem")).toHaveCount(4);

  // Nothing of the sample was written to the account.
  const after = await stored(page, email);
  expect(after.sessions).toHaveLength(0);
  expect(JSON.stringify(after.profile)).not.toContain("Riley");
});

test("a coach goes from the try-out to the recorder, leaving it lands on their checklist, and a saved session ticks it", async ({ page }) => {
  test.setTimeout(300_000);
  await signUpAsProfessional(page, "Tomas");
  await page.getByRole("radio", { name: /Coach or trainer/ }).click();
  await next(page);
  await pick(page, "Which sports do you coach?", "Running");
  await pick(page, "At what level?", "Amateur");
  await next(page);
  await pick(page, "Pick any that apply", "Recovery");
  await next(page);
  await next(page);
  await throughTheTerms(page);

  await expect(page.getByText("You'll coach it better once you've felt it.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Record with the simulated band" }).click();
  await page.waitForURL((u) => u.pathname === "/cloud/record/live/" && u.searchParams.get("first") === "first-session");
  await expect(page.getByRole("button", { name: "Start the simulated band" })).toBeVisible();
  await page.getByRole("button", { name: "Leave the session" }).click();
  await page.waitForURL((u) => u.pathname === "/cloud/");

  await expect(checklist(page).getByText("0 of 4 done")).toBeVisible();
  for (const item of ["Invite 3 athletes", "Record your own session", "Set a squad", "Assign the first practice"]) {
    await expect(checklist(page).getByText(item, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Sample athlete: Riley" })).toBeVisible();

  // The checklist's Record goes to the same recorder; a saved session of their own ticks the item.
  // Real time: the simulated band breathes at human speed (about a minute).
  await checklist(page).getByRole("link", { name: "Record" }).click();
  await page.waitForURL((u) => u.pathname === "/cloud/record/live/");
  await page.getByRole("button", { name: "Start the simulated band" }).click();
  await page.getByRole("heading", { name: "Full breaths for 20 seconds" }).waitFor({ timeout: 30_000 });
  await page.getByRole("heading", { name: "Calibrated" }).waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.getByRole("button", { name: /Stop early/ })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(32_000);
  await page.getByRole("button", { name: /Stop early/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();
  await page.waitForURL(/\/cloud\/session\//);
  await page.goto("/cloud/");
  await expect(checklist(page).getByText("1 of 4 done")).toBeVisible();
  await expect(checklist(page).getByText("Done: Record your own session")).toBeAttached();
});

test("the demo coach, who has athletes and no kind of work set, sees the dashboard as before", async ({ page }) => {
  await signInAsCoach(page);
  await expect(page.getByRole("heading", { level: 2, name: "Needs a look" })).toBeVisible();
  await expect(checklist(page)).toHaveCount(0);
  await expect(page.getByText(/^Sample /)).toHaveCount(0);
  await expect(page.getByText("Riley")).toHaveCount(0);
});
