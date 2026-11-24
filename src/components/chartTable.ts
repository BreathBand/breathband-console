export const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });

type DateFormat = (t: number) => string;
type ValueFormat = (v: number) => string;

export interface ChartRow {
  key: string;
  head: string;
  cells: string[];
}

export interface ChartTable {
  columns: string[];
  rows: ChartRow[];
}

export const OUTSIDE_TARGET = "Outside the target";
export const NO_VALUE = "–";
export const NOTHING = "Nothing in this period.";

export function timeTrendTable(
  points: { t: number; v: number; label: string; out?: boolean }[],
  format: ValueFormat,
): ChartTable {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const anyOut = sorted.some((p) => p.out);
  return {
    columns: anyOut ? ["Session", "Value", "Target"] : ["Session", "Value"],
    rows: sorted.map((p, i) => ({
      key: `${p.t}-${i}`,
      head: p.label,
      cells: anyOut ? [format(p.v), p.out ? OUTSIDE_TARGET : ""] : [format(p.v)],
    })),
  };
}

export function periodBarsTable(bars: { start: number; value: number; label: string }[], unit: string): ChartTable {
  return {
    columns: ["Period", "Value"],
    rows: bars.map((b) => ({ key: String(b.start), head: b.label, cells: [`${b.value} ${unit}`] })),
  };
}

export function compareTable(
  series: { id: string; name: string; values: (number | null)[] }[],
  starts: number[],
  format: ValueFormat,
  periodWord: string,
  date: DateFormat = shortDate,
): ChartTable {
  return {
    columns: ["Period", ...series.map((s) => s.name)],
    rows: starts.map((t, i) => ({
      key: String(t),
      head: `${periodWord} ${date(t)}`.trim(),
      cells: series.map((s) => {
        const v = s.values[i];
        return v === null || v === undefined ? NO_VALUE : format(v);
      }),
    })),
  };
}

export function valueRange(values: number[], format: ValueFormat): string {
  if (!values.length) return "";
  return `lowest ${format(Math.min(...values))}, highest ${format(Math.max(...values))}, latest ${format(values[values.length - 1])}`;
}

export function chartSummary({
  count,
  noun,
  t0,
  t1,
  values,
  format,
  date = shortDate,
}: {
  count: number;
  noun: string;
  t0: number;
  t1: number;
  values: number[];
  format: ValueFormat;
  date?: DateFormat;
}): string {
  if (count === 0) return NOTHING;
  const head = `${count} ${count === 1 ? noun : `${noun}s`} from ${date(t0)} to ${date(t1)}.`;
  const range = valueRange(values, format);
  return range ? `${head} ${range[0].toUpperCase()}${range.slice(1)}.` : head;
}

export function compareSummary(
  series: { name: string; values: (number | null)[] }[],
  starts: number[],
  format: ValueFormat,
  date: DateFormat = shortDate,
): string {
  const present = series.map((s) => ({ name: s.name, values: s.values.filter((v): v is number => v !== null && v !== undefined) }));
  const count = present.reduce((n, s) => n + s.values.length, 0);
  if (count === 0 || !starts.length) return NOTHING;
  const head = chartSummary({ count, noun: "point", t0: starts[0], t1: starts[starts.length - 1], values: [], format, date });
  const parts = present.filter((s) => s.values.length).map((s) => `${s.name}: ${valueRange(s.values, format)}.`);
  return [head, ...parts].join(" ");
}
