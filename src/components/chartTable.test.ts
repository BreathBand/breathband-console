import { describe, expect, it } from "vitest";
import { chartSummary, compareSummary, compareTable, periodBarsTable, timeTrendTable } from "./chartTable";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1, 12);
const date = (t: number) => `day${Math.round((t - T0) / DAY) + 1}`;
const score = (v: number) => v.toFixed(1);

describe("timeTrendTable", () => {
  it("sorts points by time and gives the label, formatted value and target note", () => {
    const table = timeTrendTable(
      [
        { t: T0 + 2 * DAY, v: 7.25, label: "Tue 3 Nov · Paced 5-5" },
        { t: T0, v: 4, label: "Sun 1 Nov · Paced 4-6", out: true },
        { t: T0 + DAY, v: 8, label: "Mon 2 Nov · Paced 5-5", out: false },
      ],
      score,
    );
    expect(table.headers).toEqual(["Session", "Value", "Target"]);
    expect(table.rows).toEqual([
      ["Sun 1 Nov · Paced 4-6", "4.0", "Outside the target"],
      ["Mon 2 Nov · Paced 5-5", "8.0", ""],
      ["Tue 3 Nov · Paced 5-5", "7.3", ""],
    ]);
  });

  it("gives no rows for no points", () => {
    expect(timeTrendTable([], score).rows).toEqual([]);
  });
});

describe("periodBarsTable", () => {
  it("gives one row per bar with its label and the value plus unit", () => {
    const table = periodBarsTable(
      [
        { value: 3, label: "Week of 2 Nov · 42 min" },
        { value: 0, label: "Week of 9 Nov · 0 min" },
      ],
      "sessions",
    );
    expect(table.headers).toEqual(["Period", "Value"]);
    expect(table.rows).toEqual([
      ["Week of 2 Nov · 42 min", "3 sessions"],
      ["Week of 9 Nov · 0 min", "0 sessions"],
    ]);
  });
});

describe("compareTable", () => {
  const series = [
    { name: "Timing", values: [6, null, 7.5] },
    { name: "Depth", values: [null, 5, 8] },
  ];
  const starts = [T0, T0 + 7 * DAY, T0 + 14 * DAY];

  it("gives one row per bucket and one column per series, with a dash for null", () => {
    const table = compareTable(series, starts, "Week of", score, date);
    expect(table.headers).toEqual(["Period", "Timing", "Depth"]);
    expect(table.rows).toEqual([
      ["Week of day1", "6.0", "–"],
      ["Week of day8", "–", "5.0"],
      ["Week of day15", "7.5", "8.0"],
    ]);
  });

  it("gives just the date when the period word is empty", () => {
    const table = compareTable(series, starts, "", score, date);
    expect(table.rows.map((r) => r[0])).toEqual(["day1", "day8", "day15"]);
  });
});

describe("chartSummary", () => {
  it("gives the count, date range and lowest, highest and latest value", () => {
    const text = chartSummary({
      points: [
        { t: T0 + 4 * DAY, v: 6 },
        { t: T0, v: 5 },
        { t: T0 + 2 * DAY, v: 9 },
        { t: T0 + 3 * DAY, v: 3 },
      ],
      format: (v) => `${v} br/min`,
      date,
    });
    expect(text).toBe("4 values from day1 to day5. Lowest 3 br/min, highest 9 br/min, latest 6 br/min.");
  });

  it("names a single day once", () => {
    expect(chartSummary({ points: [{ t: T0, v: 7 }], format: score, date })).toBe(
      "1 value on day1. Lowest 7.0, highest 7.0, latest 7.0.",
    );
  });

  it("says when there is nothing to summarise", () => {
    expect(chartSummary({ points: [], format: score, date })).toBe("No values in this period.");
  });
});

describe("compareSummary", () => {
  it("summarises each series that has values", () => {
    const text = compareSummary(
      [
        { name: "Timing", values: [6, null, 7.5] },
        { name: "Depth", values: [null, null, null] },
      ],
      [T0, T0 + 7 * DAY, T0 + 14 * DAY],
      score,
      date,
    );
    expect(text).toBe("Timing: 2 values from day1 to day15. Lowest 6.0, highest 7.5, latest 7.5.");
  });

  it("says when no series has values", () => {
    expect(compareSummary([{ name: "Timing", values: [null] }], [T0], score, date)).toBe("No values in this period.");
  });
});
