import { expect, test } from "@playwright/test";
import { signInAsAthlete } from "./auth";

// T-0151: the help and legal pages are readable signed out (no bounce to
// sign-in), legal ones say they're drafts, and they're linked from the landing
// page, sign-in and sign-up (the consent box links to the terms and privacy),
// Settings, and the signed-in sidebar.

const DOCS = [
  { path: "/cloud/help/", label: "Help", title: "Help centre", legal: false },
  { path: "/cloud/privacy/", label: "Privacy", title: "Privacy policy", legal: true },
  { path: "/cloud/terms/", label: "Terms", title: "Terms of use", legal: true },
  { path: "/cloud/accessibility/", label: "Accessibility", title: "Accessibility statement", legal: true },
];

for (const doc of DOCS) {
  test(`${doc.path} renders signed out`, async ({ page }) => {
    await page.goto(doc.path);
    await expect(page.getByRole("heading", { level: 1, name: doc.title })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    const draft = page.getByText("Draft: pending legal review.");
    if (doc.legal) await expect(draft).toBeVisible();
    else await expect(draft).toHaveCount(0);
    // Still here: no redirect to the sign-in page.
    await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(doc.path);
    const footer = page.getByRole("navigation", { name: "Help and legal" });
    for (const d of DOCS) await expect(footer.getByRole("link", { name: d.label, exact: true })).toHaveAttribute("href", d.path);
  });
}

test("the landing page footer and the sign-in page link to every doc page", async ({ page }) => {
  await page.goto("/cloud/");
  const footer = page.getByRole("navigation", { name: "Footer" });
  for (const d of DOCS) await expect(footer.getByRole("link", { name: d.label, exact: true })).toHaveAttribute("href", d.path);

  await page.goto("/cloud/login/");
  const links = page.getByRole("navigation", { name: "Help and legal" });
  for (const d of DOCS) await expect(links.getByRole("link", { name: d.label, exact: true })).toHaveAttribute("href", d.path);
});

test("the sign-up consent links to the terms and privacy policy in a new tab", async ({ page }) => {
  await page.goto("/cloud/signup/");
  const consent = page.locator("label[for=consentTerms]");
  await expect(consent.getByRole("link", { name: /terms of use/ })).toHaveAttribute("href", "/cloud/terms/");
  await expect(consent.getByRole("link", { name: /privacy notice/ })).toHaveAttribute("href", "/cloud/privacy/");
  await expect(consent.getByRole("link", { name: /terms of use/ })).toHaveAttribute("target", "_blank");
  // The box still checks by its label.
  await page.getByLabel(/terms of use/).check();
  await expect(page.getByLabel(/terms of use/)).toBeChecked();
});

test("signed in, the sidebar's Help and Settings link to the docs, which offer a way back", async ({ page }) => {
  await signInAsAthlete(page);
  await page.getByRole("link", { name: "Help", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/cloud/help/");
  await expect(page.getByRole("heading", { level: 1, name: "Help centre" })).toBeVisible();
  await page.getByRole("link", { name: /Back/ }).click();
  await page.waitForURL((u) => u.pathname === "/cloud/");

  await page.goto("/cloud/account/");
  const help = page.getByRole("region", { name: "Help and legal" });
  for (const d of DOCS) await expect(help.getByRole("link", { name: d.title })).toHaveAttribute("href", d.path);
});
