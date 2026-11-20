// Where things live in the console. Per-record pages use query strings
// because a static export can't prerender per-user routes.

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
