// The help and legal pages (T-0151): plain static routes under /cloud/ that
// anyone can read, signed in or out. CloudShell renders them without the app
// frame (they bring DocFrame), and the landing page, the auth frame, Settings
// and the signed-in sidebar link to them from this one list.

export interface DocLink {
  href: string;
  /** Short, for footers. */
  label: string;
  /** The page's own title, where there's room for it (Settings). */
  title: string;
  /** Legal text, shown with the "pending legal review" note until counsel signs it off. */
  legal: boolean;
}

export const HELP_HREF = "/cloud/help/";
export const PRIVACY_HREF = "/cloud/privacy/";
export const TERMS_HREF = "/cloud/terms/";
export const ACCESSIBILITY_HREF = "/cloud/accessibility/";

export const DOC_LINKS: readonly DocLink[] = [
  { href: HELP_HREF, label: "Help", title: "Help centre", legal: false },
  { href: PRIVACY_HREF, label: "Privacy", title: "Privacy policy", legal: true },
  { href: TERMS_HREF, label: "Terms", title: "Terms of use", legal: true },
  { href: ACCESSIBILITY_HREF, label: "Accessibility", title: "Accessibility statement", legal: true },
];

export const DOC_PATHS: readonly string[] = DOC_LINKS.map((d) => d.href);

/** On every legal page until counsel has reviewed it (planning/v1/03 N1, N2, N9). */
export const LEGAL_DRAFT_NOTE = "Draft: pending legal review";

/**
 * Contact addresses. The product domain isn't bought yet (planning/v1/03 A10,
 * S6), so these are placeholders: confirm them before launch, here and in
 * SECURITY.md.
 */
export const CONTACT = {
  privacy: "privacy@ the Breathband domain",
  support: "support@ the Breathband domain",
  accessibility: "support@ the Breathband domain",
  confirm: "address to be confirmed before launch",
} as const;
