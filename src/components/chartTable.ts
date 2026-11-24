export type DateFormat = (t: number) => string;
export type ValueFormat = (v: number) => string;

export const shortDate: DateFormat = (t) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export interface ChartTableData {
  headers: string[];
  rows: string[][];
}

export function timeTrendTable(
  points: { t: number; v: number; label: string; out?: boolean }[],
  format: ValueFormat,
): ChartTableData {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  return {
    headers: ["Session", "Value", "Target"],
    rows: sorted.map((p) => [p.label, format(p.v), p.out ? "Outside the target" : ""]),
  };
}

export function periodBarsTable(bars: { value: number; label: string }[], unit: string): ChartTableData {
  return {
    headers: ["Period", "Value"],
    rows: bars.map((b) => [b.label, `${b.value} ${unit}`]),
  };
}

export function compareTable(
  series: { name: string; values: (number | null)[] }[],
  starts: number[],
  periodWord: string,
  format: ValueFormat,
  date: DateFormat = shortDate,
): ChartTableData {
  return {
    headers: ["Period", ...series.map((s) => s.name)],
    rows: starts.map((t, i) => [
      `${periodWord} ${date(t)}`.trim(),
      ...series.map((s) => {
        const v = s.values[i];
        return v === null || v === undefined ? "–" : format(v);
      }),
    ]),
  };
}

export function chartSummary({
  points,
  format,
  date = shortDate,
}: {
  points: { t: number; v: number }[];
  format: ValueFormat;
  date?: DateFormat;
}): string {
  if (!points.length) return "No values in this period.";
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const values = sorted.map((p) => p.v);
  const first = date(sorted[0].t);
  const last = date(sorted[sorted.length - 1].t);
  const count = `${sorted.length} ${sorted.length === 1 ? "value" : "values"}`;
  const range = first === last ? `on ${first}` : `from ${first} to ${last}`;
  return `${count} ${range}. Lowest ${format(Math.min(...values))}, highest ${format(Math.max(...values))}, latest ${format(values[values.length - 1])}.`;
}

export function compareSummary(
  series: { name: string; values: (number | null)[] }[],
  starts: number[],
  format: ValueFormat,
  date: DateFormat = shortDate,
): string {
  const lines = series
    .map((s) => ({
      name: s.name,
      points: starts.flatMap((t, i) => {
        const v = s.values[i];
        return v === null || v === undefined ? [] : [{ t, v }];
      }),
    }))
    .filter((s) => s.points.length > 0)
    .map((s) => `${s.name}: ${chartSummary({ points: s.points, format, date })}`);
  return lines.length ? lines.join(" ") : "No values in this period.";
}
