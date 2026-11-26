import { describe, expect, it } from "vitest";
import { examLine, nextExam } from "./focus";

// Local noon, so the day count doesn't depend on the machine's time zone.
const NOW = new Date(2026, 10, 26, 12, 0, 0);

describe("nextExam", () => {
  it("counts whole days to the soonest exam ahead, and how many follow", () => {
    expect(nextExam(["2027-01-12", "2026-12-15", "2026-11-01"], NOW)).toEqual({ date: "2026-12-15", days: 19, later: 1 });
  });

  it("counts an exam today as 0 and tomorrow as 1", () => {
    expect(nextExam(["2026-11-26"], NOW)).toMatchObject({ days: 0, later: 0 });
    expect(nextExam(["2026-11-27"], NOW)).toMatchObject({ days: 1 });
  });

  it("is null with no exam ahead, ignoring dates it can't read", () => {
    expect(nextExam([], NOW)).toBeNull();
    expect(nextExam(["2026-11-25", "not a date"], NOW)).toBeNull();
  });
});

describe("examLine", () => {
  it("says today, tomorrow or the days left", () => {
    expect(examLine({ date: "2026-11-26", days: 0, later: 0 })).toBe("Exam today.");
    expect(examLine({ date: "2026-11-27", days: 1, later: 0 })).toBe("Exam tomorrow.");
    expect(examLine({ date: "2026-12-15", days: 19, later: 1 })).toBe("Exam in 19 days.");
  });
});
