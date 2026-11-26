// The professional's "getting started" checklist on the dashboard and the
// sample person shown beside it (planning/v1/02 §4.1 step 11, 03 E10). Pure:
// the dashboard gathers the facts, this decides what is listed and what's done.

import { aPerson, type PeopleNouns } from "./terminology";
import type { ProKind } from "./types";

export type ChecklistItemId = "invite" | "try-session" | "squad" | "first-practice" | "class-session" | "weekly-target";

/** What the dashboard knows about the professional's start, counted from their own data. */
export interface GettingStartedFacts {
  /** Real people linked to the professional. Never includes the sample person. */
  people: number;
  /** Invites sent that can still be accepted (pending and not expired). */
  pendingInvites: number;
  /** Sessions the professional recorded themselves. */
  ownSessions: number;
  squads: number;
  /** Practice set for anyone, open or finished. */
  practiceSet: number;
  /** People the professional has set targets for. */
  targetsSet: number;
  /** Live group sessions the professional hosted. */
  classSessions: number;
}

export interface ChecklistItem {
  id: ChecklistItemId;
  label: string;
  /** One line on how it's done, or why it's worth doing. */
  detail: string;
  done: boolean;
}

/** How many invites a coach's "invite three" asks for. */
export const COACH_INVITE_GOAL = 3;

/** People reached: those who joined plus invites still open. */
export const invited = (f: GettingStartedFacts) => f.people + f.pendingInvites;

/**
 * The checklist for a kind of work, in the order to do it. Coach: invite
 * three, record your own session, set a squad, assign the first practice.
 * Clinician: invite one, try a session, assign a between-visits plan.
 * Educator: invite the class, try a session, run a class session, set a
 * weekly target. Labels use the professional's own word for people.
 */
export function gettingStarted(kind: ProKind, facts: GettingStartedFacts, nouns: PeopleNouns): ChecklistItem[] {
  const trySession = (detail: string): ChecklistItem => ({
    id: "try-session",
    label: kind === "coach" ? "Record your own session" : "Try a session yourself",
    detail,
    done: facts.ownSessions > 0,
  });
  switch (kind) {
    case "coach":
      return [
        {
          id: "invite",
          label: `Invite ${COACH_INVITE_GOAL} ${nouns.many}`,
          detail: `${Math.min(invited(facts), COACH_INVITE_GOAL)} of ${COACH_INVITE_GOAL} so far. Send a link or show the QR code.`,
          done: invited(facts) >= COACH_INVITE_GOAL,
        },
        trySession("You'll coach it better once you've felt it."),
        { id: "squad", label: "Set a squad", detail: `Group your ${nouns.many} to compare them and run warm-ups together.`, done: facts.squads > 0 },
        { id: "first-practice", label: "Assign the first practice", detail: "Start from one of your templates.", done: facts.practiceSet > 0 },
      ];
    case "clinician":
      return [
        { id: "invite", label: `Invite ${aPerson(nouns)}`, detail: "Send a link, or show the QR code in the room.", done: invited(facts) > 0 },
        trySession(`Do what you'll ask your ${nouns.many} to do.`),
        { id: "first-practice", label: "Assign a between-visits plan", detail: "Start from the Between visits template.", done: facts.practiceSet > 0 },
      ];
    case "educator":
      return [
        { id: "invite", label: "Invite your class", detail: "Show the QR code in class, or send the link.", done: invited(facts) > 0 },
        trySession(`Do what you'll ask your ${nouns.many} to do.`),
        { id: "class-session", label: "Run a class session", detail: "Everyone breathes with one pacer.", done: facts.classSessions > 0 },
        { id: "weekly-target", label: "Set a weekly target", detail: `How many sessions a week each of your ${nouns.many} aims for.`, done: facts.targetsSet > 0 },
      ];
  }
}

/** The checklist shows for a professional with a kind until every item is done. Older coach accounts (no kind) never see it. */
export function showChecklist(kind: ProKind | null | undefined, items: readonly ChecklistItem[]): boolean {
  return !!kind && items.some((i) => !i.done);
}

/** The sample person shows until the first real person joins; pending invites don't count. */
export function showSamplePerson(realPeople: number): boolean {
  return realPeople === 0;
}

/** "Sample client", "Sample athlete", "Sample student". */
export function samplePersonLabel(nouns: PeopleNouns): string {
  return `Sample ${nouns.one}`;
}
