// The access rules from firebase/firestore.rules and storage.rules, as pure
// functions. Routes look up who is asking and the coach link, then ask here.
// The local adapter (src/lib/backend/local) enforces the same rules in the browser.
//
// I-08 covers profiles, sessions and waveforms; coaching (I-09) adds its own.

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
