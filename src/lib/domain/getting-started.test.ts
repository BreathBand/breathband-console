import { describe, expect, it } from "vitest";
import {
  COACH_INVITE_GOAL,
  gettingStarted,
  samplePersonLabel,
  showChecklist,
  showSamplePerson,
  type GettingStartedFacts,
} from "./getting-started";
import { nounsFor } from "./terminology";

const NOTHING: GettingStartedFacts = { people: 0, pendingInvites: 0, ownSessions: 0, squads: 0, practiceSet: 0, targetsSet: 0, classSessions: 0 };
const facts = (patch: Partial<GettingStartedFacts>): GettingStartedFacts => ({ ...NOTHING, ...patch });
const done = (items: { id: string; done: boolean }[]) => Object.fromEntries(items.map((i) => [i.id, i.done]));

describe("the checklist per kind (planning/v1/02 §4.1 step 11)", () => {
  it("coach: invite three athletes, record your own session, set a squad, assign the first practice", () => {
    const items = gettingStarted("coach", NOTHING, nounsFor("athletes"));
    expect(items.map((i) => i.label)).toEqual(["Invite 3 athletes", "Record your own session", "Set a squad", "Assign the first practice"]);
    expect(items.every((i) => !i.done)).toBe(true);
  });

  it("clinician: invite a client, try a session yourself, assign a between-visits plan", () => {
    const items = gettingStarted("clinician", NOTHING, nounsFor("clients"));
    expect(items.map((i) => i.label)).toEqual(["Invite a client", "Try a session yourself", "Assign a between-visits plan"]);
    expect(items[1].detail).toBe("Do what you'll ask your clients to do.");
  });

  it("educator: invite your class, try a session yourself, run a class session, set a weekly target", () => {
    const items = gettingStarted("educator", NOTHING, nounsFor("students"));
    expect(items.map((i) => i.label)).toEqual(["Invite your class", "Try a session yourself", "Run a class session", "Set a weekly target"]);
  });

  it("uses the professional's own word for people", () => {
    expect(gettingStarted("coach", NOTHING, nounsFor("clients"))[0].label).toBe("Invite 3 clients");
    expect(gettingStarted("clinician", NOTHING, nounsFor("athletes"))[0].label).toBe("Invite an athlete");
  });
});

describe("done-state", () => {
  it("a coach's invite item needs three people reached: joined plus invites still open", () => {
    const two = gettingStarted("coach", facts({ people: 1, pendingInvites: 1 }), nounsFor("athletes"));
    expect(two[0]).toMatchObject({ done: false, detail: expect.stringMatching(/^2 of 3 so far/) });
    const three = gettingStarted("coach", facts({ people: 1, pendingInvites: 2 }), nounsFor("athletes"));
    expect(three[0]).toMatchObject({ done: true, detail: expect.stringMatching(/^3 of 3 so far/) });
    const more = gettingStarted("coach", facts({ pendingInvites: 7 }), nounsFor("athletes"));
    expect(more[0].detail).toMatch(new RegExp(`^${COACH_INVITE_GOAL} of ${COACH_INVITE_GOAL} so far`));
  });

  it("a clinician's or educator's invite item is done with one invite out, or one person joined", () => {
    expect(done(gettingStarted("clinician", facts({ pendingInvites: 1 }), nounsFor("clients"))).invite).toBe(true);
    expect(done(gettingStarted("educator", facts({ people: 1 }), nounsFor("students"))).invite).toBe(true);
    expect(done(gettingStarted("clinician", NOTHING, nounsFor("clients"))).invite).toBe(false);
  });

  it("each other item follows its own fact", () => {
    const all = facts({ people: 3, ownSessions: 1, squads: 1, practiceSet: 2, targetsSet: 1, classSessions: 1 });
    expect(Object.values(done(gettingStarted("coach", all, nounsFor("athletes"))))).toEqual([true, true, true, true]);
    expect(Object.values(done(gettingStarted("clinician", all, nounsFor("clients"))))).toEqual([true, true, true]);
    expect(Object.values(done(gettingStarted("educator", all, nounsFor("students"))))).toEqual([true, true, true, true]);

    expect(done(gettingStarted("coach", facts({ ownSessions: 1 }), nounsFor("athletes")))).toEqual({
      invite: false,
      "try-session": true,
      squad: false,
      "first-practice": false,
    });
    expect(done(gettingStarted("educator", facts({ targetsSet: 1 }), nounsFor("students")))).toEqual({
      invite: false,
      "try-session": false,
      "class-session": false,
      "weekly-target": true,
    });
  });
});

describe("when the checklist and the sample person show", () => {
  it("the checklist shows for a professional with a kind while anything is left to do", () => {
    const open = gettingStarted("clinician", NOTHING, nounsFor("clients"));
    const finished = gettingStarted("clinician", facts({ pendingInvites: 1, ownSessions: 1, practiceSet: 1 }), nounsFor("clients"));
    expect(showChecklist("clinician", open)).toBe(true);
    expect(showChecklist("clinician", finished)).toBe(false);
  });

  it("older coach accounts without a kind (the demo coach) never see it", () => {
    expect(showChecklist(null, gettingStarted("coach", NOTHING, nounsFor("athletes")))).toBe(false);
    expect(showChecklist(undefined, gettingStarted("coach", NOTHING, nounsFor("athletes")))).toBe(false);
  });

  it("the sample person shows only with zero real people; open invites don't hide it", () => {
    expect(showSamplePerson(0)).toBe(true);
    expect(showSamplePerson(1)).toBe(false);
    expect(showSamplePerson(4)).toBe(false);
  });

  it("is labelled in the professional's words", () => {
    expect(samplePersonLabel(nounsFor("clients"))).toBe("Sample client");
    expect(samplePersonLabel(nounsFor("students"))).toBe("Sample student");
  });
});
