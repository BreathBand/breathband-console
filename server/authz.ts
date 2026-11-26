// The access rules from firebase/firestore.rules and storage.rules, as pure
// functions. Routes look up who is asking and the coach link, then ask here.
// The local adapter (src/lib/backend/local) enforces the same rules in the browser.
//
// I-08 covers profiles, sessions and waveforms; I-09 coaching; I-10 squads,
// alert rules, a coach's invites to athletes, group sessions and mood
// check-ins (below).
// The waitlist is public: no rule.

import type { Role, ShareScope } from "@/lib/domain/types";

/**
 * The link between a coach and an athlete, as far as access goes: its scope,
 * or null when there is none (never made, or revoked: revoking deletes it).
 */
export type LinkScope = ShareScope | null;

/** `isSelf(uid)`: the signed-in person is the owner. */
export function isSelf(viewerId: string, ownerId: string): boolean {
  return viewerId === ownerId;
}

/** `canReadAthlete(athleteId)`: the athlete, or a coach linked to them in any scope. Sessions, notes, scores. */
export function canReadAthlete(viewerId: string, athleteId: string, link: LinkScope): boolean {
  return isSelf(viewerId, athleteId) || link !== null;
}

/** storage.rules: the breathing signal needs the athlete, or a link with the "curves" scope. */
export function canReadCurves(viewerId: string, athleteId: string, link: LinkScope): boolean {
  return isSelf(viewerId, athleteId) || link === "curves";
}

/**
 * `users/{uid}` read: the owner, or either side of a coach link
 * (`coachToOwner`: viewer coaches the owner; `ownerToCoach`: the owner coaches the viewer).
 */
export function canReadProfile(viewerId: string, uid: string, coachToOwner: LinkScope, ownerToCoach: LinkScope): boolean {
  return isSelf(viewerId, uid) || coachToOwner !== null || ownerToCoach !== null;
}

/** Birth year and consent records are the owner's own; a linked reader sees the rest of the profile. */
export function canReadPrivateProfile(viewerId: string, uid: string): boolean {
  return isSelf(viewerId, uid);
}

/**
 * Profile updates, and creating a session, changing its note or deleting it:
 * the owner only. A linked coach reads; it never writes.
 */
export function canWriteOwn(viewerId: string, ownerId: string): boolean {
  return isSelf(viewerId, ownerId);
}

/** `proFieldsOk`: `proKind` and `proProfile` are for professionals (role "coach") only. */
export function canSetProFields(role: Role): boolean {
  return role === "coach";
}

// Coaching (I-09): links, invites, practice, comments and a coach's own working data.

/** `coachLinks` read: either side of the link. */
export function canReadLink(viewerId: string, coachId: string, athleteId: string): boolean {
  return isSelf(viewerId, coachId) || isSelf(viewerId, athleteId);
}

/** `coachLinks` update (scope) and delete (revoke), and creating an invite: the athlete only. */
export function canManageSharing(viewerId: string, athleteId: string): boolean {
  return isSelf(viewerId, athleteId);
}

/** The redeemInvite function: the redeemer acts as themselves, never on their own invite. */
export function canRedeemInvite(viewerId: string, coachId: string, inviteAthleteId: string): boolean {
  return isSelf(viewerId, coachId) && coachId !== inviteAthleteId;
}

/**
 * A linked coach acting as themselves on the athlete: setting practice, targets,
 * a private note. `link` is the coach's link to the athlete (null: none or revoked).
 */
export function canCoach(viewerId: string, coachId: string, link: LinkScope): boolean {
  return isSelf(viewerId, coachId) && link !== null;
}

/** Assignment update (cancel): the coach who set it, linked or not. */
export function canCancelAssignment(viewerId: string, setById: string): boolean {
  return isSelf(viewerId, setById);
}

/** Comment and kudos create: whoever can read the athlete (the athlete, or a linked coach in any scope). */
export function canComment(viewerId: string, athleteId: string, link: LinkScope): boolean {
  return canReadAthlete(viewerId, athleteId, link);
}

/** Comment delete: its author only. */
export function canDeleteComment(viewerId: string, authorId: string): boolean {
  return isSelf(viewerId, authorId);
}

/**
 * `coaches/{coachId}/...` (seen marks, private notes, squads, alert rules) and
 * reading or revoking the coach's own invites: the coach only. Nobody else reads
 * them, the athlete included.
 */
export function canUseCoachData(viewerId: string, coachId: string): boolean {
  return isSelf(viewerId, coachId);
}

// I-10: squads, a coach's invites to athletes, group sessions.

/** `links`: the coach's link to each athlete in question (null: none or revoked). */
const allLinked = (links: readonly LinkScope[]) => links.every((link) => link !== null);

/** Saving a squad: the coach's own, holding only athletes linked to them. */
export function canSaveSquad(viewerId: string, coachId: string, memberLinks: readonly LinkScope[]): boolean {
  return canUseCoachData(viewerId, coachId) && allLinked(memberLinks);
}

/** `coachInvites` create: a professional (role "coach") inviting in their own name. */
export function canInviteAthlete(viewerId: string, coachId: string, role: Role): boolean {
  return isSelf(viewerId, coachId) && role === "coach";
}

/** Accepting or declining a coach's invite (the Cloud Function's check): an athlete, for themselves. */
export function canAnswerCoachInvite(viewerId: string, athleteId: string, role: Role): boolean {
  return isSelf(viewerId, athleteId) && role === "athlete";
}

/** Opening a group session: a professional hosting in their own name, for athletes linked to them. */
export function canHostGroup(viewerId: string, hostId: string, role: Role, athleteLinks: readonly LinkScope[]): boolean {
  return isSelf(viewerId, hostId) && role === "coach" && allLinked(athleteLinks);
}

/** `groupSessions` read: the host and the invited athletes. */
export function canReadGroup(viewerId: string, hostId: string, athleteIds: readonly string[]): boolean {
  return isSelf(viewerId, hostId) || athleteIds.includes(viewerId);
}

/** `groupSessions` update (start, pacer, markers, end, cancel) and the live view: the host only. */
export function canRunGroup(viewerId: string, hostId: string): boolean {
  return isSelf(viewerId, hostId);
}

/** `users/{uid}/moodCheckins`: the person's own, read and written by them alone; a linked coach never reads them. */
export function canUseOwnMoods(viewerId: string, athleteId: string): boolean {
  return isSelf(viewerId, athleteId);
}
