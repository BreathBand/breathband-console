// The access rules from firebase/firestore.rules and storage.rules, as pure
// functions. Routes look up who is asking and the coach link, then ask here.
// The local adapter (src/lib/backend/local) enforces the same rules in the browser.
//
// I-08 covers profiles, sessions and waveforms; I-09 coaching (below).

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

/** `coaches/{coachId}/...` (seen marks, private notes): the coach only. Nobody else reads them, the athlete included. */
export function canUseCoachData(viewerId: string, coachId: string): boolean {
  return isSelf(viewerId, coachId);
}
