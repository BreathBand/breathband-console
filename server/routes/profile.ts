// GET/PATCH /api/v1/users/{uid}: the UserProfile, assembled from `user`
// (email, role, pro kind, birth year), `profiles` (name, preferences),
// `pro_profiles` and `consents`. Also the sign-up hooks that enforce 16+ and
// store the consent records, wired into Better Auth by server/auth.ts.

import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { ageGateProblem, CONSENT_KINDS, consentsProblem } from "@/lib/domain/consent";
import { goalPlanProblem } from "@/lib/domain/goal-questions";
import { gamificationProblem } from "@/lib/domain/habit";
import { onboardingProblem } from "@/lib/domain/onboarding";
import { preferencesProblem } from "@/lib/domain/preferences";
import { proProblem } from "@/lib/domain/pro-profile";
import type { ConsentRecord, ProProfile, UserPreferences, UserProfile } from "@/lib/domain/types";
import { canReadPrivateProfile, canReadProfile, canSetProFields, canWriteOwn } from "../authz";
import type { Db } from "../db/client";
import { consents, profiles, proProfiles, user } from "../db/schema";
import type { ProfilePreferences } from "../db/schema/people";
import { fail, jsonObject, linkScope, type DataApp, type DataDeps } from "./data";

const MAX_NAME = 80;

export function profileRoutes(routes: DataApp, { db }: DataDeps) {
  routes.get("/users/:uid", async (c) => {
    const viewer = c.get("uid");
    const uid = c.req.param("uid");
    const self = viewer === uid;
    const coachToOwner = self ? null : await linkScope(db, viewer, uid);
    const ownerToCoach = self ? null : await linkScope(db, uid, viewer);
    if (!canReadProfile(viewer, uid, coachToOwner, ownerToCoach)) fail("permission-denied");
    const profile = await loadProfile(db, uid, canReadPrivateProfile(viewer, uid));
    if (!profile) fail("not-found");
    return c.json(profile);
  });

  routes.patch("/users/:uid", async (c) => {
    const uid = c.req.param("uid");
    if (!canWriteOwn(c.get("uid"), uid)) fail("permission-denied");
    const { displayName, preferences, proKind, proProfile } = await jsonObject(c.req.raw);

    const name = typeof displayName === "string" ? displayName.trim() : undefined;
    if (displayName !== undefined && !name) fail("invalid-input", "displayName: empty");
    if (preferences !== undefined && preferences !== null) {
      const problem = preferencesProblemOf(preferences);
      if (problem) fail("invalid-input", problem);
    }

    const current = await loadProfile(db, uid, false);
    if (!current) fail("not-found");
    const proChange = proKind !== undefined || proProfile !== undefined;
    if (proChange) {
      if (!canSetProFields(current.role)) fail("permission-denied", "proKind, proProfile: professionals only");
      // An explicit null is checked like any other value, never read as "keep" (as the local adapter does).
      const problem = proProblem(proKind !== undefined ? proKind : current.proKind, proProfile !== undefined ? proProfile : current.proProfile);
      if (problem) fail("invalid-input", problem);
    }

    const changes: Partial<typeof profiles.$inferInsert> = {};
    if (name) changes.displayName = name.slice(0, MAX_NAME);
    if (preferences !== undefined) changes.preferences = (preferences as ProfilePreferences | null) ?? null;
    await db
      .insert(profiles)
      .values({ userId: uid, displayName: current.displayName, ...changes })
      .onConflictDoUpdate({ target: profiles.userId, set: { ...changes, updatedAt: new Date() } });
    if (changes.displayName) await db.update(user).set({ name: changes.displayName }).where(eq(user.id, uid));
    if (proKind !== undefined) await db.update(user).set({ proKind: proKind as ProProfile["kind"] }).where(eq(user.id, uid));
    if (proProfile !== undefined) await saveProProfile(db, uid, proProfile as ProProfile);

    return c.json(await loadProfile(db, uid, true));
  });
}

/** The first problem with untrusted preferences, from the same validators the local adapter uses. */
function preferencesProblemOf(value: unknown): string | null {
  if (typeof value !== "object" || Array.isArray(value)) return "preferences: an object";
  const p = value as UserPreferences;
  if (typeof p.session !== "object" || p.session === null) return "preferences.session: an object";
  try {
    return preferencesProblem(p) ?? goalPlanProblem(p) ?? onboardingProblem(p.onboarding) ?? gamificationProblem(p.gamification);
  } catch {
    return "preferences: malformed";
  }
}

async function saveProProfile(db: Db, uid: string, p: ProProfile) {
  const row = {
    kind: p.kind,
    organisation: p.organisation,
    profession: p.profession,
    sports: p.sports,
    sportOther: p.sportOther ?? null,
    level: p.level,
    country: p.country,
    useCases: p.useCases,
    terminology: p.terminology,
  };
  await db
    .insert(proProfiles)
    .values({ userId: uid, ...row })
    .onConflictDoUpdate({ target: proProfiles.userId, set: { ...row, updatedAt: new Date() } });
}

/** The UserProfile for `uid`; birth year and consents only when `withPrivate`. Null if there's no such user. */
export async function loadProfile(db: Db, uid: string, withPrivate: boolean): Promise<UserProfile | null> {
  const [row] = await db
    .select({ user, profile: profiles, pro: proProfiles })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .leftJoin(proProfiles, eq(proProfiles.userId, user.id))
    .where(eq(user.id, uid));
  if (!row) return null;
  const { user: u, profile, pro } = row;

  const result: UserProfile = {
    uid: u.id,
    email: u.email,
    displayName: profile?.displayName ?? u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
  if (profile?.preferences) result.preferences = profile.preferences;
  if (u.proKind) result.proKind = u.proKind;
  if (pro) {
    result.proProfile = {
      kind: pro.kind,
      organisation: pro.organisation,
      profession: pro.profession as ProProfile["profession"],
      sports: pro.sports as ProProfile["sports"],
      ...(pro.sportOther !== null && { sportOther: pro.sportOther }),
      level: pro.level as ProProfile["level"],
      country: pro.country,
      useCases: pro.useCases as ProProfile["useCases"],
      terminology: pro.terminology as ProProfile["terminology"],
    };
  }
  if (withPrivate) {
    if (u.birthYear !== null) result.birthYear = u.birthYear;
    const records = await db.select().from(consents).where(eq(consents.userId, uid));
    if (records.length > 0) {
      result.consents = records
        .map((r): ConsentRecord => ({ kind: r.kind as ConsentRecord["kind"], version: r.version, acceptedAt: r.acceptedAt.toISOString() }))
        .sort((a, b) => CONSENT_KINDS.indexOf(a.kind) - CONSENT_KINDS.indexOf(b.kind));
    }
  }
  return result;
}

type HookContext = { body?: unknown } | null;

/** User columns Better Auth takes as input at sign-up that update-user must never change. */
const FIXED_USER_FIELDS = ["role", "proKind", "birthYear"] as const;

const consentsIn = (context: HookContext): unknown =>
  context?.body && typeof context.body === "object" ? (context.body as { consents?: unknown }).consents : undefined;

/**
 * Better Auth's `databaseHooks.user`: sign-up refuses under 16 (by year of birth)
 * and consents that aren't every kind at its current version, then stores the
 * profile row and the consent records; refuses proKind at sign-up, and role,
 * proKind and birth year on update-user. Accounts made without a birth year or
 * consents (older clients, the API's own tests) are still allowed; see CARD.md.
 */
export function signUpHooks(db: Db) {
  const refuseUnderAge = (birthYear: unknown) => {
    if (typeof birthYear !== "number") return;
    const problem = ageGateProblem(birthYear, new Date());
    if (problem) {
      const code = problem.code === "under-age" ? "under-age" : "invalid-input";
      throw new APIError("BAD_REQUEST", { code, message: problem.message });
    }
  };

  return {
    create: {
      before: async (created: Record<string, unknown>, context: HookContext) => {
        // firestore.rules: proKind comes later, from onboarding (PATCH /api/v1/users), never at sign-up.
        // 400, not 403: Better Auth turns a 403 at sign-up into its "account exists" answer.
        if (created.proKind !== undefined && created.proKind !== null) {
          throw new APIError("BAD_REQUEST", { code: "invalid-input", message: "proKind: set it in onboarding, not at sign-up" });
        }
        refuseUnderAge(created.birthYear);
        const given = consentsIn(context);
        if (given === undefined) return;
        const problem = Array.isArray(given) ? consentsProblem(given) : "consents: a list";
        if (problem) throw new APIError("BAD_REQUEST", { code: "invalid-input", message: problem });
      },
      after: async (created: { id: string; name: string } & Record<string, unknown>, context: HookContext) => {
        await db.insert(profiles).values({ userId: created.id, displayName: created.name }).onConflictDoNothing();
        const given = consentsIn(context);
        if (!Array.isArray(given)) return;
        const acceptedAt = new Date();
        await db.insert(consents).values(
          CONSENT_KINDS.map((kind) => ({
            userId: created.id,
            kind,
            version: (given as { kind: string; version: string }[]).find((c) => c.kind === kind)!.version,
            acceptedAt,
          })),
        );
      },
    },
    // Role and birth year are fixed after sign-up, and proKind changes only through
    // PATCH /api/v1/users (professionals only), so /api/auth/update-user may not touch them.
    update: {
      before: async (changes: Record<string, unknown>) => {
        const fixed = FIXED_USER_FIELDS.filter((field) => changes[field] !== undefined);
        if (fixed.length > 0) {
          throw new APIError("FORBIDDEN", { code: "permission-denied", message: `${fixed.join(", ")}: can't be changed here` });
        }
      },
    },
  };
}
