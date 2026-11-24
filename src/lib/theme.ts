/** Where the account page keeps the chosen colour theme. The root layout's inline script reads the same key. */
export const THEME_KEY = "breathband:theme";

export type ThemeChoice = "system" | "light" | "dark";

export function readTheme(): ThemeChoice {
  try {
    const t = globalThis.localStorage?.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

/** Applies and remembers a theme. "system" removes the override so prefers-color-scheme decides. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Private windows can refuse storage; the theme still applies for this page.
  }
}
