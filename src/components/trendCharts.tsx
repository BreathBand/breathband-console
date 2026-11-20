"use client";

import { useRouter } from "next/navigation";
import { useState, type PointerEvent, type ReactNode } from "react";

// Time-based charts for trends, comparison and reports. Inline SVG at the
// width they're given, colours from tokens, a hover crosshair and tooltip on
// every chart, and identity never carried by colour alone (shapes, labels).

const r1 = (n: number) => Math.round(n * 10) / 10;
const DAY_MS = 86_400_000;

export function dateTicks(t0: number, t1: number, max: number): number[] {
  const span = (t1 - t0) / DAY_MS;
  const step = span <= 8 ? 1 : span <= 35 ? 7 : span <= 100 ? 14 : 30;
  const out: number[] = [];
  const start = new Date(t0);
  start.setHours(12, 0, 0, 0);
  for (let t = start.getTime(); t <= t1; t += step * DAY_MS) out.push(t);
  return out.length > max ? out.filter((_, i) => i % Math.ceil(out.length / max) === 0) : out;
}

const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** A floating label next to the hovered point, inside the chart's box. */
function Tip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(8, x + 12), width - 188);
  return (
    <div className="viz-tip" style={{ left, top: Math.max(0, y - 10) }} role="status">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- one series over time

export interface TimePoint {
  t: number;
  v: number;
  /** Tooltip heading, e.g. "Thu 19 Nov · Paced 5-5". */
  label: string;
  /** Outside the target: drawn as an amber diamond instead of a dot. */
  out?: boolean;
  href?: string;
}

/**
 * Values at the times they happened (not evenly spaced), with the target as
 * a band or a line. Points outside the target change shape and colour.
 */
export function TimeTrend({
  points,
  t0,
  t1,
  yMin,
  yMax,
  yTicks,
  band,
  line,
  width,
  height = 180,
  format = (v: number) => String(v),
  ariaLabel,
}: {
  points: TimePoint[];
  t0: number;
  t1: number;
  yMin: number;
  yMax: number;
  yTicks: number[];
  /** Shaded range, e.g. the breathing-rate target. */
  band?: { lo: number; hi: number; label: string };
  /** A dashed target line, e.g. the score target. */
  line?: { v: number; label: string };
  width: number;
  height?: number;
  format?: (v: number) => string;
  ariaLabel: string;
}) {
  const router = useRouter();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 30, r: 12, t: 10, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const X = (t: number) => r1(pad.l + ((t - t0) / (t1 - t0)) * w);
  const Y = (v: number) => r1(pad.t + ((yMax - v) / (yMax - yMin)) * h);
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const d = sorted.map((p, i) => `${i ? "L" : "M"}${X(p.t)} ${Y(p.v)}`).join("");
  const ticks = dateTicks(t0, t1, Math.max(2, Math.floor(w / 70)));

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!sorted.length) return;
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    for (let i = 1; i < sorted.length; i++) if (Math.abs(X(sorted[i].t) - x) < Math.abs(X(sorted[best].t) - x)) best = i;
    setHover(Math.abs(X(sorted[best].t) - x) < 40 ? best : null);
  };
  const hp = hover === null ? null : sorted[hover];

  return (
    <div className="viz" style={{ width, height }}>
      <svg
        className="chart"
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onClick={() => hp?.href && router.push(hp.href)}
        style={{ cursor: hp?.href ? "pointer" : undefined }}
      >
        {band && (
          <>
            <rect className="band" x={pad.l} y={Y(band.hi)} width={w} height={Math.max(0, Y(band.lo) - Y(band.hi))} />
            <text className="viz-band-label" x={pad.l + w - 4} y={Y(band.hi) - 4} textAnchor="end">
              {band.label}
            </text>
          </>
        )}
        {yTicks.map((v) => (
          <g key={v}>
            <line className="grid-dash" x1={pad.l} x2={pad.l + w} y1={Y(v)} y2={Y(v)} />
            <text x={pad.l - 6} y={Y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {line && (
          <>
            <line className="viz-target" x1={pad.l} x2={pad.l + w} y1={Y(line.v)} y2={Y(line.v)} />
            {/* Labelled at the start, where the newest points (on the right) can't cover it. */}
            <text className="viz-band-label" x={pad.l + 4} y={Y(line.v) - 5}>
              {line.label}
            </text>
          </>
        )}
        {ticks.map((t) => (
          <text key={t} x={X(t)} y={height - 5} textAnchor="middle">
            {shortDate(t)}
          </text>
        ))}
        {sorted.length > 1 && <path className="trend-line thin" d={d} />}
        {hp && <line className="viz-cross" x1={X(hp.t)} x2={X(hp.t)} y1={pad.t} y2={pad.t + h} />}
        {sorted.map((p, i) => {
          const x = X(p.t);
          const y = Y(p.v);
          const big = i === hover;
          return p.out ? (
            <path
              key={i}
              className="viz-out"
              d={`M${x} ${y - (big ? 7 : 5.5)}l${big ? 7 : 5.5} ${big ? 7 : 5.5}l-${big ? 7 : 5.5} ${big ? 7 : 5.5}l-${big ? 7 : 5.5} -${big ? 7 : 5.5}Z`}
            />
          ) : (
            <circle key={i} className="trend-dot" cx={x} cy={y} r={big ? 5 : 3.5} />
          );
        })}
      </svg>
      {hp && (
        <Tip x={X(hp.t)} y={Y(hp.v)} width={width}>
          <b>{format(hp.v)}</b>
          <span>{hp.label}</span>
          {hp.out && <span className="viz-tip-out">Outside the target</span>}
        </Tip>
      )}
      {sorted.length === 0 && <p className="viz-empty">Nothing in this period.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- counts per day or week

export interface BarDatum {
  start: number;
  end: number;
  value: number;
  label: string;
}

/** Sessions (or minutes) per day or week, with an optional target line. */
export function PeriodBars({
  bars,
  target,
  width,
  height = 150,
  unit,
  ariaLabel,
}: {
  bars: BarDatum[];
  target?: { v: number; label: string };
  width: number;
  height?: number;
  unit: string;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 30, r: 12, t: 12, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.max(1, target?.v ?? 0, ...bars.map((b) => b.value));
  const top = Math.ceil(max * 1.15);
  const Y = (v: number) => r1(pad.t + h - (v / top) * h);
  const slot = w / Math.max(1, bars.length);
  const bw = Math.max(2, Math.min(28, slot - 2));
  const step = Math.max(1, Math.ceil(bars.length / Math.floor(w / 60)));
  const yTicks = top <= 4 ? Array.from({ length: top + 1 }, (_, i) => i) : [0, Math.round(top / 2), top];
  const hb = hover === null ? null : bars[hover];

  return (
    <div className="viz" style={{ width, height }}>
      <svg
        className="chart"
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={(e) => {
          const x = e.clientX - e.currentTarget.getBoundingClientRect().left - pad.l;
          const i = Math.floor(x / slot);
          setHover(i >= 0 && i < bars.length ? i : null);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line className={v === 0 ? "baseline" : "grid-dash"} x1={pad.l} x2={pad.l + w} y1={Y(v)} y2={Y(v)} />
            <text x={pad.l - 6} y={Y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {hb && <rect className="viz-hover-col" x={r1(pad.l + slot * hover!)} y={pad.t} width={r1(slot)} height={h} />}
        {bars.map((b, i) => {
          const x = r1(pad.l + slot * i + (slot - bw) / 2);
          const y = Y(b.value);
          const bh = Y(0) - y;
          return bh > 0 ? (
            <path
              key={b.start}
              className={i === hover ? "bar is-last" : "bar"}
              d={`M${x} ${Y(0)}V${r1(y + Math.min(4, bh))}q0 -${Math.min(4, bh)} ${Math.min(4, bw / 2)} -${Math.min(4, bh)}h${r1(bw - 2 * Math.min(4, bw / 2))}q${Math.min(4, bw / 2)} 0 ${Math.min(4, bw / 2)} ${Math.min(4, bh)}V${Y(0)}Z`}
            />
          ) : null;
        })}
        {target && (
          <>
            <line className="viz-target" x1={pad.l} x2={pad.l + w} y1={Y(target.v)} y2={Y(target.v)} />
            <text className="viz-band-label" x={pad.l + w - 4} y={Y(target.v) - 5} textAnchor="end">
              {target.label}
            </text>
          </>
        )}
        {bars.map((b, i) =>
          i % step === 0 ? (
            <text key={`l${b.start}`} x={r1(pad.l + slot * i + slot / 2)} y={height - 5} textAnchor="middle">
              {shortDate(b.start)}
            </text>
          ) : null,
        )}
      </svg>
      {hb && (
        <Tip x={pad.l + slot * hover! + slot / 2} y={Y(hb.value)} width={width}>
          <b>
            {hb.value} {unit}
          </b>
          <span>{hb.label}</span>
        </Tip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- several athletes

export interface CompareSeries {
  id: string;
  name: string;
  /** 1–6: the colour and marker slot. Follows the athlete, not their rank. */
  slot: number;
  /** One value per bucket; null where there's nothing to show. */
  values: (number | null)[];
}

const SHAPES = ["circle", "square", "triangle", "diamond", "down", "cross"] as const;

function Marker({ slot, x, y, size = 4 }: { slot: number; x: number; y: number; size?: number }) {
  const shape = SHAPES[(slot - 1) % SHAPES.length];
  const s = size;
  const cls = `viz-mark s${slot}`;
  if (shape === "circle") return <circle className={cls} cx={x} cy={y} r={s} />;
  if (shape === "square") return <rect className={cls} x={x - s} y={y - s} width={2 * s} height={2 * s} />;
  if (shape === "triangle") return <path className={cls} d={`M${x} ${y - s - 1}L${x + s + 1} ${y + s}H${x - s - 1}Z`} />;
  if (shape === "diamond") return <path className={cls} d={`M${x} ${y - s - 1}L${x + s + 1} ${y}L${x} ${y + s + 1}L${x - s - 1} ${y}Z`} />;
  if (shape === "down") return <path className={cls} d={`M${x} ${y + s + 1}L${x + s + 1} ${y - s}H${x - s - 1}Z`} />;
  return <path className={cls} d={`M${x - s} ${y - s}L${x + s} ${y + s}M${x + s} ${y - s}L${x - s} ${y + s}`} />;
}

export function SeriesKey({ series }: { series: Pick<CompareSeries, "id" | "name" | "slot">[] }) {
  return (
    <ul className="viz-key">
      {series.map((s) => (
        <li key={s.id}>
          <svg width={22} height={12} aria-hidden="true">
            <line className={`viz-line s${s.slot}`} x1={0} x2={22} y1={6} y2={6} />
            <Marker slot={s.slot} x={11} y={6} size={3.5} />
          </svg>
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/** Up to six athletes on one chart, one line each, labelled at the end. */
export function CompareChart({
  series,
  starts,
  yMin,
  yMax,
  yTicks,
  width,
  height = 260,
  format = (v: number) => String(v),
  band,
  periodWord = "Week of",
  connectGaps = false,
  ariaLabel,
}: {
  series: CompareSeries[];
  /** Bucket start times, oldest first. */
  starts: number[];
  yMin: number;
  yMax: number;
  yTicks: number[];
  width: number;
  height?: number;
  format?: (v: number) => string;
  band?: { lo: number; hi: number; label: string };
  /** Tooltip heading before the bucket's date: "Week of", or "" for days. */
  periodWord?: string;
  /** Draw the line across buckets with no value (sparse data); markers still show only real values. */
  connectGaps?: boolean;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 30, r: 96, t: 12, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const n = starts.length;
  const X = (i: number) => r1(pad.l + (n === 1 ? w / 2 : (i / (n - 1)) * w));
  const Y = (v: number) => r1(pad.t + ((yMax - v) / (yMax - yMin)) * h);
  const step = Math.max(1, Math.ceil(n / Math.floor(w / 64)));

  // Direct labels at each line's last value, nudged apart so they don't collide.
  const ends = series
    .map((s) => {
      const i = s.values.findLastIndex((v) => v !== null);
      return i < 0 ? null : { s, y: Y(s.values[i]!), x: X(i) };
    })
    .filter((e): e is { s: CompareSeries; y: number; x: number } => e !== null)
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 14);

  return (
    <div className="viz" style={{ width, height }}>
      <svg
        className="chart"
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={(e) => {
          const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
          const i = Math.round(((x - pad.l) / w) * (n - 1));
          setHover(i >= 0 && i < n ? i : null);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {band && <rect className="band" x={pad.l} y={Y(band.hi)} width={w} height={Math.max(0, Y(band.lo) - Y(band.hi))} />}
        {yTicks.map((v) => (
          <g key={v}>
            <line className="grid-dash" x1={pad.l} x2={pad.l + w} y1={Y(v)} y2={Y(v)} />
            <text x={pad.l - 6} y={Y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {starts.map((t, i) =>
          i % step === 0 ? (
            <text key={t} x={X(i)} y={height - 5} textAnchor="middle">
              {shortDate(t)}
            </text>
          ) : null,
        )}
        {hover !== null && <line className="viz-cross" x1={X(hover)} x2={X(hover)} y1={pad.t} y2={pad.t + h} />}
        {series.map((s) => {
          let d = "";
          let pen = false;
          s.values.forEach((v, i) => {
            if (v === null) {
              if (!connectGaps) pen = false;
              return;
            }
            d += `${pen ? "L" : "M"}${X(i)} ${Y(v)}`;
            pen = true;
          });
          return (
            <g key={s.id}>
              <path className={`viz-line s${s.slot}`} d={d} />
              {s.values.map((v, i) => (v === null ? null : <Marker key={i} slot={s.slot} x={X(i)} y={Y(v)} size={i === hover ? 5 : 3.5} />))}
            </g>
          );
        })}
        {ends.map((e) => (
          <text key={e.s.id} className="viz-end" x={pad.l + w + 8} y={e.y + 4}>
            {e.s.name}
          </text>
        ))}
      </svg>
      {hover !== null && (
        <Tip x={X(hover)} y={pad.t + 10} width={width}>
          <b>
            {periodWord ? `${periodWord} ` : ""}
            {shortDate(starts[hover])}
          </b>
          {series.map((s) => (
            <span key={s.id} className="viz-tip-row">
              <svg width={12} height={12} aria-hidden="true">
                <Marker slot={s.slot} x={6} y={6} size={3.5} />
              </svg>
              {s.name}: {s.values[hover] === null ? "–" : format(s.values[hover]!)}
            </span>
          ))}
        </Tip>
      )}
    </div>
  );
}
