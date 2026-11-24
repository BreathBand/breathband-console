import { describe, expect, it } from "vitest";
import { dayKey, dueText, isOpen, lastDays, timeAgo, type AssignmentProgress, type AssignmentStatus } from "./coaching";
import type { Assignment } from "./types";

const plan: Assignment = {
  id: "p",
  coachId: "c",
  athleteId: "x",
  createdAt: "2026-11-15T09:00:00.000Z",
  mode: "paced",
  pacerHalfCycleSec: 5,
  durationSec: 300,
  target: 3,
  dueAt: "2026-11-22T23:00:00.000Z",
  note: "",
  cancelled: false,
};

const progress = (status: AssignmentStatus): AssignmentProgress => ({
  assignment: plan,
  counted: [],
  done: 0,
  status,
  daysLeft: 1,
});

describe("isOpen", () => {
  it("is open while active or behind", () => {
    expect(isOpen(progress("active"))).toBe(true);
    expect(isOpen(progress("behind"))).toBe(true);
  });

  it("is closed once done, missed or cancelled", () => {
    expect(isOpen(progress("done"))).toBe(false);
    expect(isOpen(progress("missed"))).toBe(false);
    expect(isOpen(progress("cancelled"))).toBe(false);
  });
});

describe("dueText", () => {
  it("says today, tomorrow and how many days ago", () => {
    expect(dueText(1)).toBe("Due today");
    expect(dueText(2)).toBe("Due tomorrow");
    expect(dueText(-2)).toBe("Was due 3 days ago");
  });
});

describe("timeAgo", () => {
  const now = new Date(2026, 10, 24, 12, 0);
  const before = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it("says just now under a minute", () => {
    expect(timeAgo(before(20_000), now)).toBe("just now");
    expect(timeAgo(before(-60_000), now)).toBe("just now");
  });

  it("counts minutes, then hours", () => {
    expect(timeAgo(before(5 * 60_000), now)).toBe("5 min ago");
    expect(timeAgo(before(3 * 3_600_000), now)).toBe("3 h ago");
  });

  it("says yesterday, then counts days", () => {
    expect(timeAgo(before(26 * 3_600_000), now)).toBe("yesterday");
    expect(timeAgo(before(48 * 3_600_000), now)).toBe("2 days ago");
  });
});

describe("dayKey", () => {
  it("keys a Date by its local day", () => {
    expect(dayKey(new Date(2026, 10, 8, 7, 36))).toBe("2026-11-08");
  });

  it("keys an ISO string by the local day it falls on", () => {
    expect(dayKey(new Date(2026, 10, 8, 23, 59).toISOString())).toBe("2026-11-08");
    expect(dayKey(new Date(2026, 0, 3, 0, 1).toISOString())).toBe("2026-01-03");
  });
});

describe("lastDays", () => {
  const now = new Date(2026, 10, 24, 7, 30);
  const days = lastDays(now, 3);

  it("gives count days, oldest first, ending today", () => {
    expect(days).toHaveLength(3);
    expect(days.map(dayKey)).toEqual(["2026-11-22", "2026-11-23", "2026-11-24"]);
    expect(dayKey(days[days.length - 1])).toBe(dayKey(now));
  });

  it("puts each day at local noon", () => {
    for (const d of days) {
      expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([12, 0, 0, 0]);
    }
  });

  it("crosses a month boundary", () => {
    expect(lastDays(new Date(2026, 2, 1, 9, 0), 2).map(dayKey)).toEqual(["2026-02-28", "2026-03-01"]);
  });
});
