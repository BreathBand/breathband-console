import { describe, expect, it } from "vitest";
import { chartSummary, compareSummary, compareTable, periodBarsTable, timeTrendTable } from "./chartTable";

const day = (d: number) => new Date(2026, 10, d, 12).getTime();
const date = (t: number) => `${new Date(t).getDate()} Nov`;
const score = (v: number) => v.toFixed(1);

describe("timeTrendTable", () => {
  const points = [
    { t: day(9), v: 7, label: "Mon 9 Nov · Paced 5-5" },
    { t: day(3), v: 4.5, label: "Tue 3 Nov · Paced 6-6", out: true },
    { t: day(6), v: 8, label: "Fri 6 Nov · Paced 5-5", out: false },
  ];

  it("sorts the points by time and keeps the tooltip label", () => {
    expect(timeTrendTable(points, score).rows.map((r) => r.head)).toEqual([
      "Tue 3 Nov · Paced 6-6",
      "Fri 6 Nov · Paced 5-5",
      "Mon 9 Nov · Paced 5-5",
    ]);
  });

  it("formats each value like the chart and marks points outside the target", () => {
    const table = timeTrendTable(points, score);
    expect(table.columns).toEqual(["Session", "Value", "Target"]);
    expect(table.rows.map((r) => r.cells)).toEqual([
      ["4.5", "Outside the target"],
      ["8.0", ""],
      ["7.0", ""],
    ]);
  });

  it("leaves the target column out when no point is outside it", () => {
    const table = timeTrendTable([{ t: day(2), v: 14, label: "Mon 2 Nov" }], (v) => `${v} br/min`);
    expect(table.columns).toEqual(["Session", "Value"]);
    expect(table.rows).toEqual([{ key: `${day(2)}-0`, head: "Mon 2 Nov", cells: ["14 br/min"] }]);
  });

  it("does not reorder the caller's points", () => {
    const input = [...points];
    timeTrendTable(input, score);
    expect(input).toEqual(points);
  });
});

describe("periodBarsTable", () => {
  it("gives one row per bar with its label and the value plus unit", () => {
    const table = periodBarsTable(
      [
        { start: day(2), value: 3, label: "Week of Mon 2 Nov · 30 min" },
        { start: day(9), value: 0, label: "Week of Mon 9 Nov · 0 min" },
      ],
      "sessions",
    );
    expect(table.columns).toEqual(["Period", "Value"]);
    expect(table.rows).toEqual([
      { key: String(day(2)), head: "Week of Mon 2 Nov · 30 min", cells: ["3 sessions"] },
      { key: String(day(9)), head: "Week of Mon 9 Nov · 0 min", cells: ["0 sessions"] },
    ]);
  });

  it("gives no rows for no bars", () => {
    expect(periodBarsTable([], "sessions").rows).toEqual([]);
  });
});

describe("compareTable", () => {
  const series = [
    { id: "timing", name: "Timing", values: [6, null, 7.5] },
    { id: "depth", name: "Depth", values: [null, 5, 8] },
  ];
  const starts = [day(2), day(9), day(16)];

  it("gives one row per bucket and one column per series, with a dash for no value", () => {
    const table = compareTable(series, starts, score, "Week of", date);
    expect(table.columns).toEqual(["Period", "Timing", "Depth"]);
    expect(table.rows.map((r) => [r.head, ...r.cells])).toEqual([
      ["Week of 2 Nov", "6.0", "–"],
      ["Week of 9 Nov", "–", "5.0"],
      ["Week of 16 Nov", "7.5", "8.0"],
    ]);
  });

  it("heads the row with the date alone when there is no period word", () => {
    expect(compareTable(series, starts, score, "", date).rows[0].head).toBe("2 Nov");
  });
});

describe("chartSummary", () => {
  it("gives the count, the date range and the lowest, highest and latest value", () => {
    expect(chartSummary({ count: 3, noun: "point", t0: day(2), t1: day(23), values: [4.5, 8, 7], format: score, date })).toBe(
      "3 points from 2 Nov to 23 Nov. Lowest 4.5, highest 8.0, latest 7.0.",
    );
  });

  it("uses the singular for one", () => {
    expect(chartSummary({ count: 1, noun: "bar", t0: day(2), t1: day(2), values: [3], format: (v) => `${v} sessions`, date })).toBe(
      "1 bar from 2 Nov to 2 Nov. Lowest 3 sessions, highest 3 sessions, latest 3 sessions.",
    );
  });

  it("says there is nothing when the count is 0", () => {
    expect(chartSummary({ count: 0, noun: "point", t0: day(2), t1: day(23), values: [], format: score, date })).toBe(
      "Nothing in this period.",
    );
  });
});

describe("compareSummary", () => {
  it("counts the values and gives each series its lowest, highest and latest", () => {
    expect(
      compareSummary(
        [
          { name: "Timing", values: [6, null, 7.5] },
          { name: "Depth", values: [null, 5, 4] },
          { name: "Empty", values: [null, null, null] },
        ],
        [day(2), day(9), day(16)],
        score,
        date,
      ),
    ).toBe("4 points from 2 Nov to 16 Nov. Timing: lowest 6.0, highest 7.5, latest 7.5. Depth: lowest 4.0, highest 5.0, latest 4.0.");
  });

  it("says there is nothing when every value is missing", () => {
    expect(compareSummary([{ name: "Timing", values: [null] }], [day(2)], score, date)).toBe("Nothing in this period.");
  });
});
