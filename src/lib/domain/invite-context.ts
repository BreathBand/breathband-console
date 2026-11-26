// The invited path (planning/v1/02 §2 and §3.5): a person arrives through a
// professional's invite link. The invite page says who is asking, in the
// professional's own terms, and what they'd see; the scope starts at what the
// professional asks for; onboarding's goal starts from the professional's
// kind; and practice set with the invite becomes the person's first session.
// Pure, so the web and the app can share it.

import { proDefaults } from "./pro-defaults";
import { templatesFor, type ProTemplate, type ProTemplateId } from "./pro-templates";
import type { Assignment, BreathGoal, ClinicianProfession, EducatorRole, ProKind, ShareScope } from "./types";

/** The goal step's starting answer per kind: Coach → Train, Clinician → Calm, Educator → Focus (§3.5). */
export const GOAL_FOR_KIND: Record<ProKind, BreathGoal> = { coach: "train", clinician: "calm", educator: "focus" };

/** The goal an invite from this kind of professional starts with; null when the kind isn't known. */
export function goalForKind(kind: ProKind | null | undefined): BreathGoal | null {
  return kind ? GOAL_FOR_KIND[kind] : null;
}

/** What the invite page needs to know about who's asking. Every field is optional: older invites and accounts lack them. */
export interface InviteAsker {
  coachKind?: ProKind | null;
  coachProfession?: ClinicianProfession | EducatorRole | null;
  scopeRequested?: ShareScope | null;
}

/**
 * The scope the invite page starts at: what the professional asks for, else
 * their kind's default (educators ask for scores only), else scores and
 * curves, as the page did before professionals had kinds.
 */
export function inviteScope(asker: InviteAsker): ShareScope {
  if (asker.scopeRequested === "scores" || asker.scopeRequested === "curves") return asker.scopeRequested;
  return asker.coachKind ? proDefaults(asker.coachKind).scopeRequested : "curves";
}

const KIND_WORD: Record<ProKind, string> = { coach: "coach", clinician: "clinician", educator: "teacher" };

const PROFESSION_WORD: Record<ClinicianProfession | EducatorRole, string | null> = {
  physiotherapist: "physiotherapist",
  "respiratory-therapist": "respiratory therapist",
  physician: "physician",
  psychologist: "psychologist",
  nurse: "nurse",
  other: null,
  teacher: "teacher",
  counsellor: "counsellor",
  coach: "coach",
};

/**
 * What the professional is, in their own words: their profession or role when
 * they gave one ("physiotherapist", "counsellor"), else their kind ("coach",
 * "clinician", "teacher"). Accounts from before kinds were asked are coaches.
 */
export function proTitle(asker: Pick<InviteAsker, "coachKind" | "coachProfession">): string {
  const profession = asker.coachProfession ? PROFESSION_WORD[asker.coachProfession] : null;
  return profession ?? (asker.coachKind ? KIND_WORD[asker.coachKind] : "coach");
}

/** "scores and breathing curves" or "scores". */
export const scopeWords = (scope: ShareScope) => (scope === "curves" ? "scores and breathing curves" : "scores");

/** "Lena Vos (coach) would like to see your scores and breathing curves." (§3.5) */
export function inviteHeadline(name: string, asker: InviteAsker, scope: ShareScope): string {
  return `${name} (${proTitle(asker)}) would like to see your ${scopeWords(scope)}.`;
}

/** The templates a professional can set with an invite: sessions and plans, not group sessions. */
export function invitePracticeChoices(kind: ProKind | null | undefined): ProTemplate[] {
  return kind ? templatesFor(kind).filter((t) => t.format !== "group") : [];
}

/** The template an invite's practice names, or null when it isn't one of the kind's choices. */
export function invitePractice(kind: ProKind | null | undefined, id: ProTemplateId | string | null | undefined): ProTemplate | null {
  return (id && invitePracticeChoices(kind).find((t) => t.id === id)) || null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A single session is due within this many days of accepting. */
export const SESSION_PRACTICE_DAYS = 7;

/**
 * The assignment a template becomes when the invite is accepted: its mode,
 * pacer and length; a plan's sessions over its days (4 a week for 28 days is
 * 16), a single session once; due at the end of the plan, or a week for a
 * session. The note is the template's name.
 */
export function practiceAssignment(
  t: ProTemplate,
  acceptedAt: Date,
): Pick<Assignment, "mode" | "pacerHalfCycleSec" | "durationSec" | "target" | "dueAt" | "note"> {
  const days = t.format === "plan" && t.days ? t.days : SESSION_PRACTICE_DAYS;
  const target = t.format === "plan" && t.perWeek && t.days ? Math.max(1, Math.min(30, Math.round((t.perWeek * t.days) / 7))) : 1;
  return {
    mode: t.mode,
    pacerHalfCycleSec: t.mode === "paced" ? t.pacerHalfCycleSec : null,
    durationSec: t.durationSec,
    target,
    dueAt: new Date(acceptedAt.getTime() + days * DAY_MS).toISOString(),
    note: t.name,
  };
}

/**
 * The practice a newly invited person starts with: the first one the
 * professional set (oldest first) that is still open, or null. Only this
 * professional's when `coachId` is given.
 */
export function firstAssignment(assignments: readonly Assignment[], coachId: string | null, now: Date): Assignment | null {
  const open = assignments
    .filter((a) => !a.cancelled && Date.parse(a.dueAt) > now.getTime() && (coachId === null || a.coachId === coachId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return open[0] ?? null;
}
