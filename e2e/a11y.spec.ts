import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  signInAsAthlete,
  signInAsCalm,
  signInAsClient,
  signInAsClinician,
  signInAsCoach,
  signInAsEducator,
  signInAsFocus,
} from "./auth";

// WCAG 2.2 AA (DESIGN.md, "Accessibility"; checklist O1, P2; T-0153): axe on
// the console's main routes, signed out and as each demo person, in the light
// and the dark theme. A serious or critical violation fails the test; minor
// and moderate ones are attached to the report, not failed on.
//
// The theme is set the way the account page sets it (src/lib/theme.ts): the
// stored choice, which the root layout's script turns into data-theme on
// <html> before the first paint.

const THEME_KEY = "breathband:theme";
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

/** WCAG 2.0, 2.1 and 2.2, levels A and AA (axe has no separate wcag22a tag). */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const FAILING = new Set(["serious", "critical"]);

/**
 * Known violations left for a redesign, each one rule on one selector and
 * named by its parked line in cards/done/T-0153.md. Never a whole rule.
 */
const KNOWN: { rule: string; selector: string; parked: string }[] = [];

async function settle(page: Page) {
  await expect(page.locator("main, [role=main]").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 });
  // Finish entrance transitions so contrast is read on the final colours
  // (endless ones, like a pulsing dot, can't be finished and are left running).
  await page.evaluate(() =>
    document.getAnimations().forEach((a) => {
      if (a.effect?.getComputedTiming().endTime !== Infinity) a.finish();
    }),
  );
}

async function scan(page: Page, info: TestInfo, theme: Theme, label: string) {
  await settle(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  const failing = violations
    .filter((v) => FAILING.has(v.impact ?? ""))
    .map((v) => ({
      ...v,
      nodes: v.nodes.filter((n) => !KNOWN.some((k) => k.rule === v.id && n.target.join(" ") === k.selector)),
    }))
    .filter((v) => v.nodes.length > 0);
  const lines = failing.flatMap((v) =>
    v.nodes.map((n) => `${v.impact} ${v.id} at ${n.target.join(" ")}: ${n.failureSummary?.split("\n").slice(1).join(" ").trim()}`),
  );
  const others = violations.filter((v) => !FAILING.has(v.impact ?? ""));
  if (others.length > 0) {
    await info.attach(`${label} (${theme}): minor and moderate`, {
      body: others.map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
      contentType: "text/plain",
    });
  }
  expect.soft(lines, `${label} (${theme}): serious and critical axe violations`).toEqual([]);
}

/** Opens a route and scans it. */
async function check(page: Page, info: TestInfo, theme: Theme, path: string) {
  await page.goto(path);
  await scan(page, info, theme, path);
}

/** The href of the first session in the workspace's session list. */
async function firstSessionHref(page: Page): Promise<string> {
  const link = page.locator('main a[href*="/cloud/session/"]').first();
  await expect(link).toBeVisible({ timeout: 30_000 });
  return (await link.getAttribute("href")) ?? "";
}

/** An athlete's own screens: home, sessions, a review, trends, settings, the band and record setup. */
async function athleteRoutes(page: Page, info: TestInfo, theme: Theme) {
  await check(page, info, theme, "/cloud/");
  await check(page, info, theme, "/cloud/sessions/?tab=sessions");
  const review = await firstSessionHref(page);
  await check(page, info, theme, review);
  await check(page, info, theme, "/cloud/sessions/?tab=trends");
  await check(page, info, theme, "/cloud/account/");
  await check(page, info, theme, "/cloud/device/");
  await check(page, info, theme, "/cloud/record/");
}

/** A professional's screens: the dashboard, the roster, one person's workspace and a review, compare, settings. */
async function proRoutes(page: Page, info: TestInfo, theme: Theme, athleteId: string) {
  const ws = `/cloud/sessions/?athlete=${athleteId}`;
  await check(page, info, theme, "/cloud/");
  await check(page, info, theme, "/cloud/athletes/");
  await check(page, info, theme, ws);
  await check(page, info, theme, `${ws}&tab=trends`);
  await check(page, info, theme, `${ws}&tab=sessions`);
  const review = await firstSessionHref(page);
  await check(page, info, theme, review);
  await check(page, info, theme, "/cloud/trends/");
  await check(page, info, theme, "/cloud/account/");
}

const PEOPLE: { who: string; signIn: (page: Page) => Promise<void>; routes: (page: Page, info: TestInfo, theme: Theme) => Promise<void> }[] = [
  { who: "Alex (athlete)", signIn: signInAsAthlete, routes: athleteRoutes },
  { who: "Maya (Calm)", signIn: signInAsCalm, routes: athleteRoutes },
  { who: "Sam (Focus)", signIn: signInAsFocus, routes: athleteRoutes },
  { who: "Jordan (Ana's client)", signIn: signInAsClient, routes: athleteRoutes },
  { who: "Lena (coach)", signIn: signInAsCoach, routes: (p, i, t) => proRoutes(p, i, t, "demo-athlete") },
  { who: "Ana (clinician)", signIn: signInAsClinician, routes: (p, i, t) => proRoutes(p, i, t, "demo-jordan") },
  { who: "Chris (educator)", signIn: signInAsEducator, routes: (p, i, t) => proRoutes(p, i, t, "demo-student-1") },
];

test.describe.configure({ mode: "parallel" });

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      // Reduced motion: panes that load late would otherwise be scanned mid fade-in.
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.addInitScript(([key, value]) => globalThis.localStorage.setItem(key, value), [THEME_KEY, theme] as const);
    });

    test("signed out: landing, sign in, sign up, reset and an invite", async ({ page }, info) => {
      await check(page, info, theme, "/cloud/");
      await check(page, info, theme, "/cloud/login/");
      await check(page, info, theme, "/cloud/signup/");
      await check(page, info, theme, "/cloud/reset/");
      // Lena's seeded pending invite (src/lib/backend/local/seed.ts), and a code that isn't one.
      await check(page, info, theme, "/cloud/join/?code=RBHL7K2Q");
      await expect(page.getByRole("heading", { name: /would like to see/ })).toBeVisible();
      await check(page, info, theme, "/cloud/join/?code=NOTACODE");
    });

    for (const person of PEOPLE) {
      test(`signed in as ${person.who}`, async ({ page }, info) => {
        await person.signIn(page);
        await person.routes(page, info, theme);
      });
    }
  });
}
