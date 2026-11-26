// Practice templates per professional kind (planning/v1/02 §4.1 step 8, §5.2):
// the sessions and plans a professional starts with when setting practice.
// Data only, so the web and the app can share it (§10). Onboarding shows them;
// the screens that set practice can build an assignment from one.

import type { ProKind, SessionMode } from "./types";

export type ProTemplateId =
  | "pre-training-activation"
  | "post-training-downshift"
  | "breath-control-block"
  | "daily-slow-breathing"
  | "weekly-open-check"
  | "between-visits"
  | "focus-sprint"
  | "exam-week"
  | "class-calm";

export interface ProTemplate {
  id: ProTemplateId;
  name: string;
  /** A single session, a plan that repeats it over some days, or a session run live with a group. */
  format: "session" | "plan" | "group";
  mode: SessionMode;
  /** Seconds in, and out, on the pacer; null for open sessions. */
  pacerHalfCycleSec: 2 | 5 | null;
  durationSec: number;
  /** Plans only: sessions a week, and how many days the plan runs. */
  perWeek: number | null;
  days: number | null;
  /** One line on what it's for. */
  detail: string;
}

const MIN = 60;

const session = (id: ProTemplateId, name: string, pacer: 2 | 5 | null, minutes: number, detail: string): ProTemplate => ({
  id,
  name,
  format: "session",
  mode: pacer ? "paced" : "open",
  pacerHalfCycleSec: pacer,
  durationSec: minutes * MIN,
  perWeek: null,
  days: null,
  detail,
});

const plan = (id: ProTemplateId, name: string, pacer: 2 | 5 | null, minutes: number, perWeek: number, days: number, detail: string): ProTemplate => ({
  ...session(id, name, pacer, minutes, detail),
  format: "plan",
  perWeek,
  days,
});

const TEMPLATES: Record<ProKind, ProTemplate[]> = {
  coach: [
    session("pre-training-activation", "Pre-training Activation", 2, 2, "A quicker pacer to get ready before training."),
    session("post-training-downshift", "Post-training Downshift", 5, 8, "Slow breathing to come down after training."),
    plan("breath-control-block", "Breath Control Block", 5, 10, 4, 28, "Four weeks of paced breathing to build control."),
  ],
  clinician: [
    plan("daily-slow-breathing", "Daily slow breathing", 5, 5, 7, 7, "Slow paced breathing every day."),
    session("weekly-open-check", "Weekly open check", null, 3, "Three minutes of natural breathing once a week, to see the pattern."),
    plan("between-visits", "Between visits", 5, 5, 7, 14, "Daily slow breathing until the next visit, reviewed before it."),
  ],
  educator: [
    session("focus-sprint", "Focus Sprint", 5, 3, "Three calm minutes before study or a test."),
    plan("exam-week", "Exam Week", 5, 3, 7, 7, "A short session every day of exam week."),
    { ...session("class-calm", "Class calm", 5, 3, "The whole class on one pacer."), format: "group" },
  ],
};

/** A kind's templates, in the order onboarding shows them. */
export function templatesFor(kind: ProKind): ProTemplate[] {
  return TEMPLATES[kind].map((t) => ({ ...t }));
}

/** "Paced 5-5 · 8 min"; "Paced 5-5 · 10 min · 4 times a week for 28 days"; "Paced 5-5 · 3 min · with a group". */
export function templateLine(t: ProTemplate): string {
  const parts = [t.mode === "paced" ? `Paced ${t.pacerHalfCycleSec}-${t.pacerHalfCycleSec}` : "Open", `${Math.round(t.durationSec / MIN)} min`];
  if (t.format === "plan" && t.perWeek && t.days) {
    const often = t.perWeek === 7 ? "daily" : t.perWeek === 1 ? "once a week" : `${t.perWeek} times a week`;
    parts.push(`${often} for ${t.days} days`);
  }
  if (t.format === "group") parts.push("with a group");
  return parts.join(" · ");
}
