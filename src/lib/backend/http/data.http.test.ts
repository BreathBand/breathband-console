// The DataService contract sections against the real API: server/ in-process on
// an ephemeral port, a temp migrated file database, a temp STORAGE_DIR, and a
// mailer that keeps emails in memory so each person can confirm their address.
// Built like auth.http.test.ts. No Docker needed.

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { serve, type ServerType } from "@hono/node-server";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { currentConsents } from "@/lib/domain/consent";
import { authSecret, createAuth } from "../../../../server/auth";
import { createDb } from "../../../../server/db/client";
import { MIGRATIONS_DIR } from "../../../../server/db/env";
import { assertLocalDatabaseUrl } from "../../../../server/db/guard";
import { coachInvites, coachLinks, consents, invites, squadMembers, user as userTable, waitlist } from "../../../../server/db/schema";
import { createApp } from "../../../../server/index";
import { hashCode } from "../../../../server/routes/codes";
import type { Email, Mailer } from "../../../../server/mailer";
import { createFsStorage } from "../../../../server/storage";
import { describeCoachToolsContract } from "../contract/coach-tools.contract";
import { describeCoachingContract } from "../contract/coaching.contract";
import type { DataContractHarness, Person } from "../contract/data.harness";
import { linkThroughInvites, PASSWORD, refusal, signUpInput, uniqueEmail } from "../contract/data.harness";
import { describeGroupContract } from "../contract/group.contract";
import { describeProfileContract } from "../contract/profile.contract";
import { describeSessionsContract } from "../contract/sessions.contract";
import { describeWaitlistContract } from "../contract/waitlist.contract";
import type { AuthUser } from "../types";
import type { Fetch } from "./client";
import { createHttpBackend } from "./index";

const APP = "http://localhost:3000";

let dir: string;
let handle: ReturnType<typeof createDb>;
let server: ServerType;
let api: string;

const outbox: Email[] = [];
const mailer: Mailer = {
  async send(email) {
    outbox.push(email);
  },
};

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "breathband-http-data-"));
  const url = `file:${join(dir, "data.db").replaceAll("\\", "/")}`;
  assertLocalDatabaseUrl(url, "the http data test's database");
  handle = createDb(url);
  await migrate(handle.db, { migrationsFolder: resolve(MIGRATIONS_DIR) });

  const started: { app?: ReturnType<typeof createApp> } = {};
  server = serve({
    fetch: (request) => (started.app ? started.app.fetch(request) : new Response("starting", { status: 503 })),
    port: 0,
  });
  await new Promise<void>((ready) => server.once("listening", ready));
  api = `http://localhost:${(server.address() as AddressInfo).port}`;

  const auth = createAuth({ db: handle.db, mode: "test", secret: authSecret("test", undefined), baseUrl: api, appUrl: APP, mailer });
  const storage = createFsStorage(join(dir, "blobs"));
  started.app = createApp({ db: handle.db, mode: "test", appUrl: APP, auth, storage });
});

afterAll(async () => {
  await new Promise((done) => (server ? server.close(done) : done(undefined)));
  handle?.client.close();
  try {
    if (dir) rmSync(dir, { recursive: true, force: true });
  } catch {
    // On Windows libSQL keeps the file open until the process exits; the OS temp folder gets it.
  }
});

// Better Auth rate-limits sign-in per client IP; every request gets its own (server/routes/auth.test.ts tests the limit).
let lastIp = 0;
const nextIp = () => {
  lastIp++;
  return `198.19.${Math.floor(lastIp / 250) % 250}.${(lastIp % 250) + 1}`;
};

/** Node's fetch as one browser on the web app: the app's Origin, and the API's cookies kept. */
function browser(): Fetch {
  const jar = new Map<string, string>();
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("Origin", APP);
    headers.set("X-Forwarded-For", nextIp());
    if (jar.size > 0) headers.set("Cookie", [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
    const response = await fetch(input, { ...init, headers });
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(";");
      const name = pair.slice(0, pair.indexOf("="));
      const value = pair.slice(pair.indexOf("=") + 1);
      const expired = attributes.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === "";
      if (expired) jar.delete(name);
      else jar.set(name, value);
    }
    return response;
  };
}

async function confirmEmail(address: string) {
  const email = outbox.filter((e) => e.to === address && /confirm your email/i.test(e.subject)).at(-1);
  const link = email?.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`no confirmation email to ${address}`);
  // Its own client IP, like every request here: Better Auth rate-limits per IP, and the coaching sections confirm many people.
  const confirmed = await fetch(link, { redirect: "manual", headers: { "X-Forwarded-For": nextIp() } });
  if (confirmed.status !== 302) throw new Error(`confirming ${address} failed: ${confirmed.status}`);
}

const open = (fetchImpl: Fetch = browser()) => createHttpBackend({ baseUrl: api, appUrl: APP, fetch: fetchImpl });

/** Each person's browser, for requests the adapter has no method for. */
const browsers = new Map<string, Fetch>();

/** POST /api/auth/update-user as this person: Better Auth's own route for changing the user. */
const updateUser = (uid: string, fields: Record<string, unknown>) =>
  browsers.get(uid)!(`${api}/api/auth/update-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });

/** Every person made so far, by uid, so `link` can act in each one's browser. */
const people = new Map<string, Person>();

const harness = (): DataContractHarness => ({
  async person(role = "athlete") {
    const fetchImpl = browser();
    const backend = open(fetchImpl);
    const input = signUpInput(role);
    await backend.auth.signUp(input);
    await confirmEmail(input.email);
    const user = await backend.auth.signIn(input.email, input.password);
    browsers.set(user.uid, fetchImpl);
    const person = { uid: user.uid, email: user.email, birthYear: input.birthYear, backend };
    people.set(user.uid, person);
    return person;
  },
  async updateAccount(person, fields) {
    return (await updateUser(person.uid, fields)).ok ? "accepted" : "refused";
  },
  signedOut: () => open(),
  link: linkThroughInvites(people),
});

describeProfileContract("http", harness);
describeSessionsContract("http", harness);
describeCoachingContract("http", harness);
describeCoachToolsContract("http", harness);
describeGroupContract("http", harness);
describeWaitlistContract("http", harness);

describe("the API behind the http DataService", () => {
  const post = (path: string, body: unknown) =>
    fetch(`${api}/api/auth${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP, "X-Forwarded-For": nextIp() },
      body: JSON.stringify(body),
    });
  const signUpBody = (fields: Record<string, unknown> = {}) => ({
    name: "Direct",
    email: uniqueEmail(),
    password: PASSWORD,
    birthYear: 1990,
    consents: currentConsents(),
    ...fields,
  });
  const userRow = async (email: string) => (await handle.db.select().from(userTable).where(eq(userTable.email, email)))[0];

  it("stores the consent records at sign-up, one per kind at its version", async () => {
    const body = signUpBody();
    expect((await post("/sign-up/email", body)).status).toBe(200);
    const row = await userRow(body.email);
    const stored = await handle.db.select().from(consents).where(eq(consents.userId, row.id));
    expect(stored.map((c) => [c.kind, c.version]).sort()).toEqual(currentConsents().map((c) => [c.kind, c.version]).sort());
  });

  it.each<[string, Record<string, unknown>, string]>([
    ["someone under 16", { birthYear: new Date().getUTCFullYear() - 15 }, "under-age"],
    ["a missing consent", { consents: currentConsents(["terms", "privacy"]) }, "invalid-input"],
    ["an outdated consent version", { consents: currentConsents().map((c) => ({ ...c, version: "old" })) }, "invalid-input"],
    ["consents that aren't a list", { consents: "yes" }, "invalid-input"],
  ])("refuses a direct sign-up from %s, and creates no account", async (_, fields, code) => {
    const body = signUpBody(fields);
    const response = await post("/sign-up/email", body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code });
    expect(await userRow(body.email)).toBeUndefined();
  });

  it("refuses a sign-up that sets the professional kind (onboarding sets it, through PATCH /users)", async () => {
    const body = signUpBody({ role: "coach", proKind: "clinician" });
    const response = await post("/sign-up/email", body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid-input" });
    expect(await userRow(body.email)).toBeUndefined();
  });

  it.each<[string, Record<string, unknown>]>([
    ["an athlete making themselves a coach", { role: "coach" }],
    ["setting proKind", { proKind: "clinician" }],
    ["changing the birth year", { birthYear: 1970 }],
    ["an under-16 birth year", { birthYear: new Date().getUTCFullYear() - 10 }],
  ])("refuses update-user %s, and changes nothing", async (_, fields) => {
    const ana = await harness().person();
    const before = await userRow(ana.email);
    const response = await updateUser(ana.uid, fields);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "permission-denied" });
    expect(await userRow(ana.email)).toMatchObject({ role: "athlete", proKind: null, birthYear: before.birthYear });
  });

  it("still lets update-user change the name", async () => {
    const ana = await harness().person();
    expect((await updateUser(ana.uid, { name: "Ana Renamed" })).status).toBe(200);
    expect((await userRow(ana.email)).name).toBe("Ana Renamed");
  });

  it("counts the person as signed out when a data route answers 401", async () => {
    const fetchImpl = browser();
    const backend = open(fetchImpl);
    const input = signUpInput();
    await backend.auth.signUp(input);
    await confirmEmail(input.email);
    const user = await backend.auth.signIn(input.email, input.password);
    const seen: (AuthUser | null)[] = [];
    backend.auth.onAuthStateChanged((u) => seen.push(u));

    // The session ends elsewhere (another tab signs out, or it is revoked).
    await open(fetchImpl).auth.signOut();
    await refusal(backend.data.getProfile(user.uid), "not-signed-in");
    expect(backend.auth.currentUser()).toBeNull();
    expect(seen.at(-1)).toBeNull();
  });

  it("removes the stored signal with the session", async () => {
    const person = await harness().person();
    const saved = await person.backend.data.saveSession(
      person.uid,
      { startedAt: "2026-11-24T08:00:00.000Z", durationSec: 60, mode: "open", pacerHalfCycleSec: null, scores: null, scoringVersion: "transition-v1", respirationRateBpm: null, note: "", appVersion: "web" },
      { sampleIntervalMs: 50, user: [0, 1, 0], pacer: null, markers: [], calibration: { min: 0, max: 1 } },
    );
    const blob = join(dir, "blobs", ...saved.waveformPath.split("/"));
    expect(existsSync(blob)).toBe(true);
    await person.backend.data.deleteSession(person.uid, saved.id);
    expect(existsSync(blob)).toBe(false);
  });
});

describe("the coaching API behind the http DataService", () => {
  const people = async () => Promise.all([harness().person(), harness().person("coach")]);
  const inviteRows = async (athleteId: string) => handle.db.select().from(invites).where(eq(invites.athleteId, athleteId));

  it("stores only a hash of an invite code, and marks it redeemed", async () => {
    const [ana, cara] = await people();
    const invite = await ana.backend.data.createInvite(ana.uid, "scores");
    const [row] = await inviteRows(ana.uid);
    expect(row).toMatchObject({ codeHash: hashCode(invite.code), scope: "scores", status: "pending" });
    expect(JSON.stringify(row)).not.toContain(invite.code);
    expect(row.expiresAt.toISOString()).toBe(invite.expiresAt);

    await cara.backend.data.redeemInvite(cara.uid, invite.code);
    expect((await inviteRows(ana.uid))[0].status).toBe("redeemed");
    const [link] = await handle.db.select().from(coachLinks).where(and(eq(coachLinks.coachId, cara.uid), eq(coachLinks.athleteId, ana.uid)));
    expect(link).toMatchObject({ scope: "scores", targets: null });
  });

  it("refuses an expired invite and makes no link", async () => {
    const [ana, cara] = await people();
    const invite = await ana.backend.data.createInvite(ana.uid);
    await handle.db.update(invites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invites.codeHash, hashCode(invite.code)));
    await refusal(cara.backend.data.redeemInvite(cara.uid, invite.code), "invite-invalid");
    expect(await cara.backend.data.getCoachLink(cara.uid, ana.uid)).toBeNull();
  });

  it("lets one of two coaches racing for the same code have it", async () => {
    const [ana, cara] = await people();
    const other = await harness().person("coach");
    const invite = await ana.backend.data.createInvite(ana.uid);
    const results = await Promise.allSettled([cara, other].map((c) => c.backend.data.redeemInvite(c.uid, invite.code)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "invite-invalid" } });
    expect(await ana.backend.data.listCoaches(ana.uid)).toHaveLength(1);
  });

  // The local adapter accepts any key here; the API stores marks only for sessions the coach can read.
  it("marks only a session that exists, of an athlete the coach is linked to", async () => {
    const [ana, cara] = await people();
    const saved = await ana.backend.data.saveSession(
      ana.uid,
      { startedAt: "2026-11-24T08:00:00.000Z", durationSec: 60, mode: "open", pacerHalfCycleSec: null, scores: null, scoringVersion: "transition-v1", respirationRateBpm: null, note: "", appVersion: "web" },
      { sampleIntervalMs: 50, user: [0, 1, 0], pacer: null, markers: [], calibration: { min: 0, max: 1 } },
    );
    await refusal(cara.backend.data.markSessionSeen(cara.uid, ana.uid, saved.id), "permission-denied");
    const invite = await ana.backend.data.createInvite(ana.uid);
    await cara.backend.data.redeemInvite(cara.uid, invite.code);
    await refusal(cara.backend.data.markSessionSeen(cara.uid, ana.uid, "no-such-session"), "not-found");
    expect(await cara.backend.data.listSeenSessions(cara.uid)).toEqual([]);
  });
});

describe("the I-10 API behind the http DataService", () => {
  it("stores only a hash of a coach's invite code, and lists the code back to the coach", async () => {
    const cara = await harness().person("coach");
    const sent = await cara.backend.data.createCoachInvite(cara.uid, { athleteName: "Jo", contact: "jo@example.com" });
    const [row] = await handle.db.select().from(coachInvites).where(eq(coachInvites.coachId, cara.uid));
    expect(row.codeHash).toBe(hashCode(sent.code));
    expect(JSON.stringify(row)).not.toContain(sent.code);
    expect((await cara.backend.data.listCoachInvites(cara.uid)).map((i) => i.code)).toEqual([sent.code]);
  });

  it("refuses a coach's invite once it has expired, and makes no link", async () => {
    const [ana, cara] = await Promise.all([harness().person(), harness().person("coach")]);
    const sent = await cara.backend.data.createCoachInvite(cara.uid, { athleteName: "Ana", contact: "ana@example.com" });
    await handle.db.update(coachInvites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(coachInvites.codeHash, hashCode(sent.code)));
    await refusal(ana.backend.data.respondToCoachInvite(ana.uid, sent.code, { accept: true, scope: "curves" }), "invite-invalid");
    expect(await cara.backend.data.getCoachLink(cara.uid, ana.uid)).toBeNull();
  });

  it("removes a squad's members with the squad", async () => {
    const [ana, cara] = await Promise.all([harness().person(), harness().person("coach")]);
    await linkThroughInvites(people)(cara.uid, ana.uid, "curves");
    const squad = await cara.backend.data.saveSquad(cara.uid, { name: "Solo", athleteIds: [ana.uid] });
    await cara.backend.data.deleteSquad(cara.uid, squad.id);
    expect(await handle.db.select().from(squadMembers).where(eq(squadMembers.squadId, squad.id))).toEqual([]);
  });

  it("keeps the live view to the host, and reports everyone gone once the session ends", async () => {
    const [ana, ben, cara] = await Promise.all([harness().person(), harness().person(), harness().person("coach")]);
    for (const athlete of [ana, ben]) await linkThroughInvites(people)(cara.uid, athlete.uid, "curves");
    const group = await cara.backend.data.createGroupSession(cara.uid, { title: "", athleteIds: [ana.uid, ben.uid], pacerHalfCycleSec: 5, durationSec: 60 });
    const live = (uid: string) => browsers.get(uid)!(`${api}/api/v1/group-sessions/${group.id}/live`);
    expect((await live(ana.uid)).status).toBe(403);

    await cara.backend.data.startGroupSession(group.id);
    await cara.backend.data.endGroupSession(group.id);
    expect(await (await live(cara.uid)).json()).toEqual({ status: "ended", presence: { [ana.uid]: "left", [ben.uid]: "left" } });
  });

  it("stores a waitlist address once, trimmed and in lower case", async () => {
    const visitor = open().data;
    const email = `Waiting-${Date.now()}@Example.test`;
    await visitor.joinWaitlist({ email: ` ${email} `, source: "hero" });
    await visitor.joinWaitlist({ email: email.toUpperCase(), source: "footer" });
    const rows = await handle.db.select().from(waitlist).where(eq(waitlist.email, email.toLowerCase()));
    expect(rows).toMatchObject([{ email: email.toLowerCase(), source: "hero" }]);
  });

  it.each<[string, { email: string; source: string }, string]>([
    ["an address over 254 characters", { email: `${"a".repeat(250)}@example.test`, source: "hero" }, "invalid-email"],
    ["a source over 32 characters", { email: "fine@example.test", source: "s".repeat(33) }, "invalid-input"],
  ])("refuses a waitlist entry with %s", async (_, entry, code) => {
    await refusal(open().data.joinWaitlist(entry), code as "invalid-email");
    expect(await handle.db.select().from(waitlist).where(eq(waitlist.email, entry.email))).toEqual([]);
  });
});
