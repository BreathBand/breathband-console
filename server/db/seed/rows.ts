// The local adapter's demo data (src/lib/backend/local/db.ts createSeededDb,
// built from local/seed.ts and the synth generators) as database rows, so both
// backends show the same demo. Pure: nothing here touches the database.
//
// Ids: people keep their local uids ("demo-coach", "demo-athlete", ...). Session
// ids are only unique per athlete locally ("s001"), so rows prefix the athlete
// ("demo-athlete-s001"); other local ids get a "demo-" prefix.

import { createHmac } from "node:crypto";
import { createSeededDb } from "@/lib/backend/local/db";
import { DEMO_PASSWORD, DEMO_PEOPLE, generateWaveform } from "@/lib/backend/local/seed";
import { isTransitionScores } from "@/lib/domain/scores";
import type { SessionSummary, UserProfile, Waveform } from "@/lib/domain/types";
import { codeFrom, hashCode } from "../../routes/codes";
import {
  assignments,
  breathSessions,
  coachInvites,
  coachLinks,
  coachNotes,
  comments,
  consents,
  kudos,
  moodCheckins,
  profiles,
  proProfiles,
  seenSessions,
  squadMembers,
  squads,
  user,
} from "../schema";
import type { ProfilePreferences } from "../schema/people";
import { waveformKey } from "../../storage";

export { DEMO_PASSWORD };

/** The database id of a seeded session. */
export function demoSessionId(athleteId: string, localId: string): string {
  return `${athleteId}-${localId}`;
}

const demoId = (localId: string) => `demo-${localId}`;

export interface DemoSession {
  row: typeof breathSessions.$inferInsert & { id: string; waveformPath: string };
  /** The signal, generated on demand (it is the slow part). */
  waveform: () => Waveform;
}

export interface DemoRows {
  people: { profile: UserProfile; user: typeof user.$inferInsert; profileRow: typeof profiles.$inferInsert }[];
  /** The professionals' onboarding answers (Ana, Chris). */
  proProfiles: (typeof proProfiles.$inferInsert)[];
  /** Sign-up's and professional onboarding's consent records, for the people seeded with them. */
  consents: (typeof consents.$inferInsert & { id: string })[];
  sessions: DemoSession[];
  coachLinks: (typeof coachLinks.$inferInsert)[];
  assignments: (typeof assignments.$inferInsert)[];
  comments: (typeof comments.$inferInsert)[];
  kudos: (typeof kudos.$inferInsert)[];
  seenSessions: (typeof seenSessions.$inferInsert)[];
  coachNotes: (typeof coachNotes.$inferInsert)[];
  squads: (typeof squads.$inferInsert)[];
  squadMembers: (typeof squadMembers.$inferInsert & { coachId: string })[];
  coachInvites: (typeof coachInvites.$inferInsert)[];
  moodCheckins: (typeof moodCheckins.$inferInsert)[];
}

/** Every uid the demo seed owns: the local seed's accounts. */
export const DEMO_UIDS: readonly string[] = DEMO_PEOPLE.map((p) => p.uid);

/**
 * A coach invite's code, as routes/coach-invites.ts derives it (T-0122): an HMAC
 * of the coach and the moment of creation under AUTH_SECRET, cut to 8
 * characters. Only its hash is stored; the API derives the code again to list it.
 * Kept in step with the route by server/db/seed.test.ts (the API lists the seeded code and it works).
 */
export function coachInviteCode(secret: string, coachId: string, createdAt: Date): string {
  return codeFrom(createHmac("sha256", secret).update(`coach-invite\0${coachId}\0${createdAt.getTime()}`).digest());
}

/**
 * The demo, as rows, with sessions placed relative to `now` (as the local adapter does).
 * `secret` is the API's AUTH_SECRET: the coach invite's code depends on it.
 */
export function demoRows(now: Date, secret: string): DemoRows {
  const local = createSeededDb(now);
  const at = (iso: string) => new Date(iso);

  const people = Object.values(local.accounts).map(({ profile }) => ({
    profile,
    user: {
      id: profile.uid,
      name: profile.displayName,
      email: profile.email,
      emailVerified: true,
      role: profile.role,
      proKind: profile.proKind ?? null,
      birthYear: profile.birthYear ?? null,
      createdAt: at(profile.createdAt),
      updatedAt: at(profile.createdAt),
    },
    profileRow: {
      userId: profile.uid,
      displayName: profile.displayName,
      preferences: (profile.preferences as ProfilePreferences | null | undefined) ?? null,
      createdAt: at(profile.createdAt),
      updatedAt: at(profile.createdAt),
    },
  }));

  // As routes/profile.ts saves a professional profile and keeps consent records.
  const proProfileRows = people.flatMap(({ profile }) => {
    const p = profile.proProfile;
    if (!p) return [];
    return [
      {
        userId: profile.uid,
        kind: p.kind,
        organisation: p.organisation,
        profession: p.profession,
        sports: p.sports,
        sportOther: p.sportOther ?? null,
        level: p.level,
        country: p.country,
        useCases: p.useCases,
        terminology: p.terminology,
        defaultTargets: p.defaultTargets ?? null,
        scopeRequested: p.scopeRequested ?? "scores",
        createdAt: at(profile.createdAt),
        updatedAt: at(profile.createdAt),
      },
    ];
  });
  const consentRows = people.flatMap(({ profile }) =>
    (profile.consents ?? []).map((c) => ({
      id: demoId(`${profile.uid}-consent-${c.kind}`),
      userId: profile.uid,
      kind: c.kind,
      version: c.version,
      acceptedAt: at(c.acceptedAt),
      createdAt: at(c.acceptedAt),
      updatedAt: at(c.acceptedAt),
    })),
  );

  const sessions = Object.values(local.sessions)
    .flat()
    .map((s): DemoSession => {
      const id = demoSessionId(s.athleteId, s.id);
      return { row: sessionRow(s, id, waveformKey(s.athleteId, id)), waveform: () => generateWaveform(s) };
    });

  const sessionId = (athleteId: string, localId: string) => demoSessionId(athleteId, localId);

  const thread = Object.values(local.comments).flat();
  const byAuthor = (c: (typeof thread)[number]) => ({
    id: demoId(c.id),
    athleteId: c.athleteId,
    sessionId: sessionId(c.athleteId, c.sessionId),
    authorId: c.authorId,
    authorName: c.authorName,
    authorRole: c.authorRole,
    createdAt: at(c.createdAt),
    updatedAt: at(c.createdAt),
  });

  return {
    people,
    proProfiles: proProfileRows,
    consents: consentRows,
    sessions,
    coachLinks: local.coachLinks.map((l) => ({
      coachId: l.coachId,
      athleteId: l.athleteId,
      scope: l.scope,
      targets: l.targets ?? null,
      createdAt: at(l.createdAt),
      updatedAt: at(l.createdAt),
    })),
    assignments: Object.values(local.assignments)
      .flat()
      .map((a) => ({
        id: demoId(a.id),
        coachId: a.coachId,
        athleteId: a.athleteId,
        mode: a.mode,
        pacerHalfCycleSec: a.pacerHalfCycleSec,
        durationSec: a.durationSec,
        target: a.target,
        dueAt: at(a.dueAt),
        note: a.note,
        cancelled: a.cancelled,
        createdAt: at(a.createdAt),
        updatedAt: at(a.createdAt),
      })),
    comments: thread.filter((c) => c.kind === "comment").map((c) => ({ ...byAuthor(c), text: c.text })),
    kudos: thread.filter((c) => c.kind === "kudos").map(byAuthor),
    seenSessions: Object.entries(local.seen).flatMap(([coachId, keys]) =>
      keys.map((key) => {
        const [athleteId, localId] = key.split("/");
        return { coachId, athleteId, sessionId: sessionId(athleteId, localId) };
      }),
    ),
    coachNotes: Object.entries(local.coachNotes).map(([key, text]) => {
      // "coachId_athleteId"; demo uids have no underscore.
      const [coachId, athleteId] = key.split("_");
      return { coachId, athleteId, text };
    }),
    squads: Object.entries(local.squads).flatMap(([coachId, list]) =>
      list.map((q) => ({ id: demoId(q.id), coachId, name: q.name, createdAt: at(q.createdAt), updatedAt: at(q.createdAt) })),
    ),
    squadMembers: Object.entries(local.squads).flatMap(([coachId, list]) =>
      list.flatMap((q) => q.athleteIds.map((athleteId) => ({ squadId: demoId(q.id), athleteId, coachId }))),
    ),
    // The local codes ("RBHL7K2Q", Ana's) can't be kept: the API derives a coach invite's code (see coachInviteCode).
    coachInvites: local.coachInvites.map((i) => ({
      codeHash: hashCode(coachInviteCode(secret, i.coachId, at(i.createdAt))),
      coachId: i.coachId,
      coachName: i.coachName,
      athleteName: i.athleteName,
      contact: i.contact,
      expiresAt: at(i.expiresAt),
      status: i.status,
      athleteId: i.athleteId,
      createdAt: at(i.createdAt),
      updatedAt: at(i.createdAt),
    })),
    moodCheckins: Object.values(local.moodCheckins)
      .flat()
      .map((m) => ({
        id: demoId(m.id),
        userId: m.athleteId,
        sessionId: m.sessionId === null ? null : sessionId(m.athleteId, m.sessionId),
        phase: m.phase,
        mood: m.mood,
        createdAt: at(m.createdAt),
        updatedAt: at(m.createdAt),
      })),
  };
}

/** As routes/sessions.ts stores a saved session, with the seed's own id and path. */
function sessionRow(s: SessionSummary, id: string, waveformPath: string): DemoSession["row"] {
  const total = s.scores === null ? null : isTransitionScores(s.scores) ? s.scores.total : s.scores.overall;
  return {
    id,
    athleteId: s.athleteId,
    startedAt: new Date(s.startedAt),
    durationSec: s.durationSec,
    mode: s.mode,
    pacerHalfCycleSec: s.pacerHalfCycleSec,
    scoringVersion: s.scoringVersion,
    respirationRateBpm: s.respirationRateBpm,
    total: typeof total === "number" ? total : null,
    source: s.source ?? null,
    skillLevel: s.skillLevel ?? null,
    scores: s.scores,
    paced: s.paced ?? null,
    open: s.open ?? null,
    note: s.note,
    waveformPath,
    appVersion: s.appVersion,
    createdAt: new Date(s.startedAt),
    updatedAt: new Date(s.startedAt),
  };
}
