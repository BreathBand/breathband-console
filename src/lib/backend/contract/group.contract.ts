import { beforeEach, describe, expect, it } from "vitest";
import type { NewGroupSession, Presence } from "../types";
import type { DataContractHarness, Person } from "./data.harness";
import { refusal } from "./data.harness";

// The group-session section of the shared adapter suite: a coach opens one for
// linked athletes, runs it lobby → live → ended (or cancels it), and only the
// host and the invited athletes see it. State only: the live signal (frames)
// isn't part of this section. Run by contract/data.local.test.ts and
// http/data.http.test.ts. With real time and an end right after the start,
// nobody has taken part on either adapter, so results stay empty.

export function describeGroupContract(adapter: string, setup: () => DataContractHarness | Promise<DataContractHarness>) {
  describe(`DataService contract, group sessions: ${adapter}`, () => {
    let h: DataContractHarness;
    let ana: Person;
    let ben: Person;
    let cara: Person;
    let input: NewGroupSession;

    beforeEach(async () => {
      h = await setup();
      [ana, ben, cara] = await Promise.all([h.person(), h.person(), h.person("coach")]);
      await h.link(cara.uid, ana.uid, "curves");
      await h.link(cara.uid, ben.uid, "scores");
      input = { title: "  Morning  ", athleteIds: [ana.uid, ben.uid, ana.uid], pacerHalfCycleSec: 5, durationSec: 300 };
    });

    const open = (fields: Partial<NewGroupSession> = {}) => cara.backend.data.createGroupSession(cara.uid, { ...input, ...fields });

    it("opens in the lobby for linked athletes, with the host's name", async () => {
      const group = await open();
      expect(group).toMatchObject({
        hostId: cara.uid,
        hostName: "Cara Coach",
        title: "Morning",
        athleteIds: [ana.uid, ben.uid],
        pacerHalfCycleSec: 5,
        durationSec: 300,
        status: "lobby",
        startedAt: null,
        endedAt: null,
        pacerChanges: [],
        markers: [],
        results: {},
        groupAverage: null,
      });
      expect(Date.parse(group.createdAt)).not.toBeNaN();
      expect((await open({ title: "   " })).title).toBe("Group session");
    });

    it("refuses an unlinked athlete, an athlete hosting, and a session that's too small, too short, too long or off-pacer", async () => {
      const stranger = await h.person();
      await refusal(open({ athleteIds: [ana.uid, stranger.uid] }), "permission-denied");
      await refusal(ana.backend.data.createGroupSession(ana.uid, input), "permission-denied");
      await refusal(ana.backend.data.createGroupSession(cara.uid, input), "permission-denied");
      await refusal(open({ athleteIds: [ana.uid, ana.uid] }), "invalid-input");
      await refusal(open({ durationSec: 59 }), "invalid-input");
      await refusal(open({ durationSec: 1801 }), "invalid-input");
      await refusal(open({ pacerHalfCycleSec: 3 as 5 }), "invalid-input");
      expect(await cara.backend.data.listGroupSessions(cara.uid)).toEqual([]);
    });

    it("shows a session to its host and invited athletes only, newest first", async () => {
      const first = await open({ title: "First" });
      const second = await open({ title: "Second", athleteIds: [ana.uid, ben.uid] });
      expect((await cara.backend.data.listGroupSessions(cara.uid)).map((g) => g.id)).toEqual([second.id, first.id]);
      expect((await ana.backend.data.listGroupSessions(ana.uid)).map((g) => g.id)).toEqual([second.id, first.id]);
      expect(await ben.backend.data.getGroupSession(first.id)).toEqual(first);

      const stranger = await h.person();
      await refusal(stranger.backend.data.getGroupSession(first.id), "permission-denied");
      expect(await stranger.backend.data.listGroupSessions(stranger.uid)).toEqual([]);
      await refusal(ana.backend.data.listGroupSessions(cara.uid), "permission-denied");
      expect(await cara.backend.data.getGroupSession("no-such-group")).toBeNull();
      await refusal(h.signedOut().data.getGroupSession(first.id), "not-signed-in");
    });

    it("runs lobby → live → ended, switching the pacer and dropping markers on the way", async () => {
      const group = await open();
      const live = await cara.backend.data.startGroupSession(group.id);
      expect(live.status).toBe("live");
      expect(Date.parse(live.startedAt!)).not.toBeNaN();

      // The pacer that's already running isn't a switch.
      expect((await cara.backend.data.setGroupPacer(group.id, 5)).pacerChanges).toEqual([]);
      const switched = await cara.backend.data.setGroupPacer(group.id, 2);
      expect(switched.pacerChanges).toEqual([{ atSec: expect.any(Number), pacerHalfCycleSec: 2 }]);
      expect(switched.pacerChanges[0].atSec).toBeGreaterThanOrEqual(0);
      expect(switched.pacerChanges[0].atSec).toBeLessThan(60);
      const marked = await cara.backend.data.addGroupMarker(group.id);
      expect(marked.markers).toHaveLength(1);
      expect(marked.pacerChanges).toEqual(switched.pacerChanges);

      const ended = await cara.backend.data.endGroupSession(group.id);
      expect(ended).toMatchObject({ status: "ended", results: {}, groupAverage: null, markers: marked.markers });
      expect(Date.parse(ended.endedAt!)).not.toBeNaN();
      expect(await ana.backend.data.getGroupSession(group.id)).toMatchObject({ status: "ended" });
    });

    it("refuses a step out of order: start twice, switch or mark in the lobby, end from the lobby, cancel once live", async () => {
      const group = await open();
      await refusal(cara.backend.data.setGroupPacer(group.id, 2), "invalid-input");
      await refusal(cara.backend.data.addGroupMarker(group.id), "invalid-input");
      await refusal(cara.backend.data.endGroupSession(group.id), "invalid-input");
      await cara.backend.data.startGroupSession(group.id);
      await refusal(cara.backend.data.startGroupSession(group.id), "invalid-input");
      await refusal(cara.backend.data.cancelGroupSession(group.id), "invalid-input");
      await cara.backend.data.endGroupSession(group.id);
      await refusal(cara.backend.data.addGroupMarker(group.id), "invalid-input");
    });

    it("cancels from the lobby", async () => {
      const group = await open();
      await cara.backend.data.cancelGroupSession(group.id);
      const cancelled = await cara.backend.data.getGroupSession(group.id);
      expect(cancelled).toMatchObject({ status: "cancelled", startedAt: null });
      expect(Date.parse(cancelled!.endedAt!)).not.toBeNaN();
      await refusal(cara.backend.data.startGroupSession(group.id), "invalid-input");
    });

    it("lets only the host run it, invited athletes included", async () => {
      const group = await open();
      const other = await h.person("coach");
      for (const person of [ana, other]) {
        await refusal(person.backend.data.startGroupSession(group.id), "permission-denied");
        await refusal(person.backend.data.cancelGroupSession(group.id), "permission-denied");
      }
      await cara.backend.data.startGroupSession(group.id);
      await refusal(ana.backend.data.setGroupPacer(group.id, 2), "permission-denied");
      await refusal(ana.backend.data.addGroupMarker(group.id), "permission-denied");
      await refusal(ana.backend.data.endGroupSession(group.id), "permission-denied");
      await refusal(cara.backend.data.startGroupSession("no-such-group"), "not-found");
      expect(await cara.backend.data.getGroupSession(group.id)).toMatchObject({ status: "live", pacerChanges: [], markers: [] });
    });

    it("tells the host who is invited as soon as they watch the lobby", async () => {
      const group = await open();
      const presence = await new Promise<Record<string, Presence>>((resolve) => {
        const stop = cara.backend.data.watchGroupLive(group.id, {
          onPresence: (p) => {
            queueMicrotask(() => stop());
            resolve(p);
          },
          onFrame: () => {},
        });
      });
      expect(presence).toEqual({ [ana.uid]: "invited", [ben.uid]: "invited" });
    });
  });
}
