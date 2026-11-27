// T-0151: the help and legal pages. Each renders its sections (the same HTML
// the static export ships, signed in or out), legal pages carry the draft
// note, the terms quote what professional onboarding asks people to agree to,
// and nothing public gives away how calibration or scoring works.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PRIVATE_NOTES_HINT,
  PROFESSIONAL_TERMS_POINTS,
  STUDENT_AGE_ACKNOWLEDGEMENT,
  WELLNESS_ACKNOWLEDGEMENT,
} from "@/lib/domain/pro-terms";
import { AccessibilityStatement } from "./AccessibilityStatement";
import { DOC_LINKS, DOC_PATHS, LEGAL_DRAFT_NOTE } from "./doc-links";
import { HelpCentre } from "./HelpCentre";
import { PrivacyPolicy } from "./PrivacyPolicy";
import { Terms } from "./Terms";

const PAGES: Record<string, { component: FunctionComponent; title: string }> = {
  "/cloud/help/": { component: HelpCentre, title: "Help centre" },
  "/cloud/privacy/": { component: PrivacyPolicy, title: "Privacy policy" },
  "/cloud/terms/": { component: Terms, title: "Terms of use" },
  "/cloud/accessibility/": { component: AccessibilityStatement, title: "Accessibility statement" },
};

const html = (path: string) => renderToStaticMarkup(createElement(PAGES[path].component));

/** The page's words, as a reader sees them. */
function text(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}

describe("the doc pages", () => {
  it("lists exactly the four pages, each with a route that the static export builds", () => {
    expect(DOC_PATHS).toEqual(["/cloud/help/", "/cloud/privacy/", "/cloud/terms/", "/cloud/accessibility/"]);
    for (const path of DOC_PATHS) {
      const page = fileURLToPath(new URL(`../../../../src/app${path}page.tsx`, import.meta.url));
      expect(existsSync(page), page).toBe(true);
    }
  });

  it.each(DOC_LINKS.map((d) => [d.href, d] as const))("%s renders its title, a contents list and its sections", (path, doc) => {
    const markup = html(path);
    expect(PAGES[path].title).toBe(doc.title);
    expect(markup).toContain(`<h1>${doc.title}</h1>`);
    const ids = [...markup.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(3);
    for (const id of ids) {
      expect(markup).toContain(`<a href="#${id}">`);
      expect(markup).toContain(`aria-labelledby="${id}-h"`);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(DOC_LINKS.map((d) => [d.href, d.legal] as const))("%s shows the draft note when it's legal text (%s)", (path, legal) => {
    const words = text(html(path));
    if (legal) expect(words).toContain(`${LEGAL_DRAFT_NOTE}.`);
    else expect(words).not.toContain(LEGAL_DRAFT_NOTE);
  });

  it.each(DOC_PATHS)("%s keeps calibration and scoring internals off the page", (path) => {
    const words = text(html(path));
    expect(words).not.toMatch(/a100|midline|threshold|formula|algorithm|standard deviation|\bSD\b|±|\d\s*%/i);
    // The score bands' cut-offs (lib/domain/scores.ts) aren't published either.
    expect(words).not.toMatch(/\b\d+(\.\d+)?\s*(–|-|to)\s*\d+(\.\d+)?\s*(is|=|means)\b/i);
  });

  it.each(DOC_PATHS)("%s is wellness wording: no diagnosis or treatment claims, never 'patients'", (path) => {
    const words = text(html(path));
    expect(words).not.toMatch(/\b(we|breathband|it) (diagnoses|treats|cures|monitors)\b/i);
    // The one "patients" on any page is the clinicians' wording table, in the "instead of" column.
    const patients = words.match(/patients?/gi) ?? [];
    if (path === "/cloud/help/") {
      expect(patients).toEqual(["Patients"]);
      expect(html(path)).toContain("<td>Clients</td><td>Patients</td>");
    } else {
      expect(patients).toEqual([]);
    }
  });
});

describe("privacy policy", () => {
  const words = text(html("/cloud/privacy/"));

  it("covers what is collected, from the account to the access log", () => {
    for (const heading of [
      "Your account",
      "Your profile and setup answers",
      "Your agreements",
      "Your band and calibration",
      "Your sessions and breathing signal",
      "Mood check-ins",
      "Sharing",
      "Access log",
      "Sign-ins and service logs",
    ]) {
      expect(words).toContain(heading);
    }
  });

  it("says the region and the processors aren't chosen yet", () => {
    expect(words).toMatch(/region they run in is to be confirmed before launch/);
    expect(words).toMatch(/Hosting \(servers, database and file storage\): provider to be confirmed/);
    expect(words).toMatch(/Email \(verification, password reset and reminders\): provider to be confirmed/);
  });

  it("explains deletion within 24 hours, downloading, sharing and revoking, and rights", () => {
    expect(words).toContain("Within 24 hours everything is deleted");
    expect(words).toContain("Download my data");
    expect(words).toContain("Stopping takes effect straight away");
    expect(words).toContain("Your rights");
    expect(words).toMatch(/isn't a medical device/);
  });
});

describe("terms", () => {
  const words = text(html("/cloud/terms/"));

  it("quotes professional onboarding's own wording, so the two can't disagree", () => {
    for (const point of PROFESSIONAL_TERMS_POINTS) expect(words).toContain(point);
    expect(words).toContain(WELLNESS_ACKNOWLEDGEMENT);
    expect(words).toContain(STUDENT_AGE_ACKNOWLEDGEMENT);
    expect(words).toContain(PRIVATE_NOTES_HINT);
  });

  it("has a section for coaches, clinicians and educators: wellness only, people 16 or over", () => {
    expect(words).toContain("Terms for professionals");
    expect(words).toMatch(/coach or trainer, a clinician or therapist, or a teacher or counsellor/);
    expect(words).toContain("Wellness use only");
    expect(words).toContain("The people you invite are 16 or over");
    expect(words).toContain("You need to be 16 or over to have an account.");
  });
});

describe("help", () => {
  const words = text(html("/cloud/help/"));

  it("names the browsers that can pair and the ones that can't", () => {
    expect(words).toMatch(/Chrome or Edge on a computer/);
    expect(words).toMatch(/Android/);
    expect(words).toMatch(/doesn't work in Safari or Firefox, or in any browser on an iPhone or iPad/);
  });

  it("walks through a failed pairing: charge, closer, Bluetooth off and on, retry", () => {
    for (const step of ["Charge it.", "Bring it closer.", "Turn Bluetooth off and on", "Retry."]) expect(words).toContain(step);
  });

  it("has a guide for professionals: inviting, scopes, practice, reviewing, wording for clinicians", () => {
    for (const h of ["Inviting people", "What you can see", "Setting practice", "Reviewing sessions", "Wording for clinicians"]) {
      expect(words).toContain(h);
    }
  });
});
