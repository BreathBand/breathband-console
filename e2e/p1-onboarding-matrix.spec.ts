import { expect, test } from "@playwright/test";
import { emailFor, individualToBandStep, next, pick, professionalToTerminology, signUp, stored, type Goal, type ProKind } from "./helpers/flows";

// P1 (planning/v1/03): onboarding end to end for each goal and each kind of
// professional, on the local backend. The per-step details have their own
// specs (onboarding-tracks, onboarding-pro, onboarding-pro-terms,
// onboarding-pro-invite); this matrix checks that every track and every kind
// gets from sign-up to its own Home or dashboard, set up the way it chose.

const INDIVIDUALS: { goal: Goal; name: string; year: string; answer: (page: Parameters<typeof pick>[0]) => Promise<void>; session: string; mode: RegExp }[] = [
  {
    goal: "Train",
    name: "Kit Rowe",
    year: "1997",
    answer: (page) => pick(page, "What do you want from your breathing?", "Recovery after training"),
    session: "Paced 5-5 · 10 min",
    mode: /^Paced Follow/,
  },
  {
    goal: "Focus",
    name: "Noor Haddad",
    year: "2006",
    answer: (page) => pick(page, "When does stress get in the way?", "Exams and tests"),
    session: "Paced 5-5 · 3 min",
    mode: /^Paced Follow/,
  },
  {
    goal: "Calm",
    name: "Ada Quinn",
    year: "1979",
    answer: (page) => pick(page, "What are you hoping for?", "Less stress"),
    session: "Open · 3 min",
    mode: /^Open Breathe/,
  },
];

for (const p of INDIVIDUALS) {
  test(`individual, ${p.goal}: sign-up → goal questions → plan → band → done → a ${p.goal} Home and New session`, async ({ page }) => {
    test.setTimeout(120_000);
    const email = emailFor(p.name);
    await signUp(page, { name: p.name, email, year: p.year });
    await expect(page.getByRole("heading", { name: "Welcome to Breathband." })).toBeVisible();
    await individualToBandStep(page, p.goal, () => p.answer(page));
    // No band today: the phone app route, so the done step offers Home.
    await page.getByRole("radiogroup", { name: "How you'll breathe with Breathband" }).getByRole("radio", { name: /phone app/ }).click();
    await next(page);

    const first = p.name.split(" ")[0];
    await expect(page.getByRole("heading", { name: `You're ready, ${first}.` })).toBeVisible();
    const summary = page.locator(".welcome-summary");
    await expect(summary).toContainText(p.goal);
    await expect(summary).toContainText(p.session);
    await page.getByRole("button", { name: "Go to my home" }).click();

    await page.waitForURL((url) => url.pathname === "/cloud/");
    // A first-run Home: the goal, and the track's first session ready to start.
    await expect(page.getByRole("heading", { level: 1, name: `Welcome, ${first}.` })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Goal:")).toContainText(p.goal);
    await expect(page.getByRole("link", { name: `Start ${p.session}` })).toBeVisible();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Record" }).click();
    await page.waitForURL(/\/cloud\/record\/$/);
    await expect(page.getByRole("button", { name: p.mode })).toHaveAttribute("aria-pressed", "true");

    const { profile } = await stored(page, email);
    expect(profile).toMatchObject({ role: "athlete", preferences: { goal: p.goal.toLowerCase(), onboardedAt: expect.any(String) } });
  });
}

const PROFESSIONALS: { kind: ProKind; name: string; people: string; nav: string; boxes: (string | RegExp)[]; checklist: string[]; consents: string[] }[] = [
  {
    kind: "coach",
    name: "Marta Silva",
    people: "athletes",
    nav: "Athletes",
    boxes: ["I agree to the professional terms."],
    checklist: ["Invite 3 athletes", "Record your own session", "Set a squad", "Assign the first practice"],
    consents: ["professional-terms"],
  },
  {
    kind: "clinician",
    name: "Niamh Walsh",
    people: "clients",
    nav: "Clients",
    boxes: ["I agree to the professional terms.", /Breathband is a wellness tool\. It doesn't diagnose, treat or monitor any condition\./],
    checklist: ["Invite a client", "Try a session yourself", "Assign a between-visits plan"],
    consents: ["professional-terms", "wellness-acknowledgement"],
  },
  {
    kind: "educator",
    name: "Owen Price",
    people: "students",
    nav: "Students",
    boxes: ["I agree to the professional terms.", "Only invite students aged 16 or over."],
    checklist: ["Invite your class", "Try a session yourself", "Run a class session", "Set a weekly target"],
    consents: ["professional-terms", "student-age-acknowledgement"],
  },
];

for (const p of PROFESSIONALS) {
  test(`professional, ${p.kind}: kind → practice → use → ${p.people} → defaults → templates → terms → dashboard with its checklist`, async ({ page }) => {
    test.setTimeout(120_000);
    const email = emailFor(p.name);
    await signUp(page, { name: p.name, email, year: "1984", pro: true });
    await professionalToTerminology(page, p.kind);
    await expect(page.getByRole("radio", { name: new RegExp(`^${p.people}`, "i") })).toHaveAttribute("aria-checked", "true");
    await next(page);

    await expect(page.getByRole("heading", { name: `Defaults for the ${p.people} you invite` })).toBeVisible();
    await next(page);
    await expect(page.getByRole("heading", { name: "Practice templates" })).toBeVisible();
    await next(page);

    // The terms: exactly the kind's boxes, every one required.
    await expect(page.getByRole("heading", { name: "Professional terms" })).toBeVisible();
    const boxes = page.getByRole("checkbox");
    await expect(boxes).toHaveCount(p.boxes.length);
    for (const label of p.boxes) await expect(page.getByRole("checkbox", { name: label })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    for (const box of await boxes.all()) await box.check();
    await next(page);

    await expect(page.getByRole("heading", { name: "Try it yourself" })).toBeVisible();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByRole("heading", { name: /^Invite your/ })).toBeVisible();
    await page.getByRole("button", { name: "Skip for now" }).click();
    const first = p.name.split(" ")[0];
    await expect(page.getByRole("heading", { name: `You're set, ${first}.` })).toBeVisible();
    await page.getByRole("button", { name: "Go to the dashboard" }).click();

    // The dashboard in the kind's words, with its checklist and a sample person.
    await page.waitForURL((u) => u.pathname === "/cloud/");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: p.nav })).toBeVisible({ timeout: 30_000 });
    const checklist = page.getByRole("region", { name: "Getting started" });
    await expect(checklist).toBeVisible();
    for (const item of p.checklist) await expect(checklist.getByText(item, { exact: true })).toBeVisible();
    const one = p.people.slice(0, -1);
    await expect(page.getByRole("region", { name: new RegExp(`^Sample ${one}: `) })).toBeVisible();

    const { profile } = await stored(page, email);
    expect(profile).toMatchObject({ role: "coach", proKind: p.kind, proProfile: { kind: p.kind, terminology: p.people } });
    const kinds = ((profile?.consents ?? []) as { kind: string }[]).map((c) => c.kind);
    for (const consent of p.consents) expect(kinds).toContain(consent);
  });
}
