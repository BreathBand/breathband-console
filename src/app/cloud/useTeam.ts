"use client";

import { useBackend } from "@/lib/backend/BackendProvider";
import { activity, type Activity } from "@/lib/domain/activity";
import { assignmentProgress, awaitingReply, type AssignmentProgress } from "@/lib/domain/coaching";
import {
  DEFAULT_TARGETS,
  type AlertRules,
  type AthleteTargets,
  type CoachLink,
  type SessionComment,
  type SessionSummary,
  type Squad,
  type UserProfile,
} from "@/lib/domain/types";
import { useLoad } from "@/lib/useLoad";

/** How far back the dashboard looks for sessions to review. */
export const REVIEW_WINDOW_DAYS = 14;

export interface TeamMember {
  profile: UserProfile;
  link: CoachLink | null;
  /** The coach's targets for this athlete (defaults until set). */
  targets: AthleteTargets;
  /** Newest first. */
  sessions: SessionSummary[];
  activity: Activity;
  /** Newest first, including finished ones. */
  plans: AssignmentProgress[];
  /** Oldest first. */
  comments: SessionComment[];
  /** Threads where the athlete spoke last. */
  awaiting: SessionComment[];
  /** Sessions in the review window this coach hasn't opened, newest first. */
  unseen: SessionSummary[];
}

export interface Team {
  members: TeamMember[];
  seen: Set<string>;
  squads: Squad[];
  rules: AlertRules;
}

/**
 * Everything the coach dashboard and roster need, in one load: each linked
 * athlete with their sessions, practice plans and comments, plus which
 * sessions the coach has already opened.
 *
 * One request per athlete per collection is fine for a coach's roster; with
 * Firebase, a team this size reads a few hundred small documents.
 */
export function useTeam(coachId: string, now: Date) {
  const backend = useBackend();
  return useLoad<Team>(`team:${coachId}`, async () => {
    const [athletes, seenKeys, squads, rules] = await Promise.all([
      backend.data.listAthletes(coachId),
      backend.data.listSeenSessions(coachId),
      backend.data.listSquads(coachId),
      backend.data.getAlertRules(coachId),
    ]);
    const seen = new Set(seenKeys);
    const since = now.getTime() - REVIEW_WINDOW_DAYS * 86_400_000;
    const members = await Promise.all(
      athletes.map(async (profile): Promise<TeamMember> => {
        const [sessions, assignments, comments, link] = await Promise.all([
          backend.data.listSessions(profile.uid, { limit: 200 }),
          backend.data.listAssignments(profile.uid),
          backend.data.listComments(profile.uid),
          backend.data.getCoachLink(coachId, profile.uid),
        ]);
        const targets = link?.targets ?? DEFAULT_TARGETS;
        return {
          profile,
          link,
          targets,
          sessions,
          activity: activity(sessions, now, rules, targets),
          plans: assignments.map((a) => assignmentProgress(a, sessions, now)),
          comments,
          awaiting: awaitingReply(comments),
          unseen: sessions.filter((s) => Date.parse(s.startedAt) >= since && !seen.has(`${s.athleteId}/${s.id}`)),
        };
      }),
    );
    members.sort((a, b) => a.profile.displayName.localeCompare(b.profile.displayName));
    return { members, seen, squads, rules };
  });
}
