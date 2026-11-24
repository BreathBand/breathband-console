import { describe, expect, it } from "vitest";
import { compareCsv, type CompareCsvRow } from "./csv";
import type { PeriodStats } from "./trends";

const HEADER =
  "Athlete,Sessions,A week,Average score,Change,On target,Scored,Breathing rate (br/min),Weakest part,Weakest part score";

function stats(over: Partial<PeriodStats> = {}): PeriodStats {
  return {
    count: 12,
    minutes: 60,
    scoredCount: 10,
    average: 7.4,
    best: null,
    onTarget: 6,
    weakest: { label: "exhale timing", value: 6.2 },
    openCount: 2,
    rateAverage: 13.5,
    rateOutside: 0,
    perWeek: 3,
    ...over,
  };
}

const lines = (csv: string) => csv.split("\r\n");

describe("compareCsv", () => {
  it("starts with the header", () => {
    expect(lines(compareCsv([]))[0]).toBe(HEADER);
    expect(compareCsv([])).toBe(HEADER + "\r\n");
  });

  it("writes the table's values in column order", () => {
    const row: CompareCsvRow = { name: "Alex Morgan", stats: stats(), change: -0.6 };
    expect(lines(compareCsv([row]))[1]).toBe("Alex Morgan,12,3,7.4,-0.6,6,10,13.5,exhale timing,6.2");
  });

  it("leaves blank cells for a missing average, change, rate and weakest part", () => {
    const row: CompareCsvRow = {
      name: "Sam Lee",
      stats: stats({ count: 2, scoredCount: 0, onTarget: 0, average: null, rateAverage: null, weakest: null, perWeek: 0.5 }),
      change: null,
    };
    expect(lines(compareCsv([row]))[1]).toBe("Sam Lee,2,0.5,,,0,0,,,");
  });

  it("quotes names with commas or quotes", () => {
    const row: CompareCsvRow = { name: 'Morgan, "Alex"', stats: stats(), change: 0 };
    expect(lines(compareCsv([row]))[1].startsWith('"Morgan, ""Alex""",12,')).toBe(true);
  });

  it("writes one line per row in the given order and ends with CRLF", () => {
    const csv = compareCsv([
      { name: "Zoe", stats: stats(), change: null },
      { name: "Ann", stats: stats(), change: null },
      { name: "Kim", stats: stats(), change: null },
    ]);
    expect(csv.endsWith("\r\n")).toBe(true);
    const out = lines(csv.slice(0, -2));
    expect(out).toHaveLength(4);
    expect(out.slice(1).map((l) => l.split(",")[0])).toEqual(["Zoe", "Ann", "Kim"]);
  });
});
