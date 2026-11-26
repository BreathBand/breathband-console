// Where things live in the console. Per-record pages use query strings
// because a static export can't prerender per-user routes.

/**
 * The public site, which lives in its own repo (breathband-site). "/" suits one
 * domain that routes everything outside /cloud/ to the site; set
 * NEXT_PUBLIC_SITE_URL when the site is on another host. Link to it with a
 * plain <a>: it isn't a route in this app.
 */
export const SITE_HOME = process.env.NEXT_PUBLIC_SITE_URL || "/";

export type AthleteTab = "overview" | "trends" | "sessions" | "plan" | "notes";

/** One athlete's workspace, optionally on a tab; `assign` opens the new-practice form. */
export function athleteHref(athleteId: string, tab: AthleteTab = "overview", assign = false): string {
  const q = new URLSearchParams({ athlete: athleteId });
  if (tab !== "overview") q.set("tab", tab);
  if (assign) q.set("assign", "1");
  return `/cloud/sessions/?${q}`;
}

export function sessionHref(athleteId: string, sessionId: string): string {
  return `/cloud/session/?${new URLSearchParams({ athlete: athleteId, id: sessionId })}`;
}
