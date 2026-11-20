import { useId } from "react";

// Small SVG charts drawn at the width they're given (see useElementWidth), so
// condensed labels stay crisp. Colours come from the tokens via CSS classes.

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A stable id usable inside url(#…) references. */
export function useSvgId(prefix: string): string {
  return prefix + useId().replace(/[^a-zA-Z0-9_-]/g, "");
}

export interface TrendPoint {
  value: number;
  /** Short date for the axis, e.g. "8 Nov". */
  label: string;
  /** Spoken/tooltip text for the point. */
  title: string;
}

/** Score per session on the 1–10 scale; the newest point is filled. */
export function TrendChart({ points, width, height = 128 }: { points: TrendPoint[]; width: number; height?: number }) {
  const pad = { l: 24, r: 10, t: 8, b: 20 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const lo = Math.max(1, Math.floor(Math.min(...points.map((p) => p.value))) - 1);
  const hi = 10;
  const X = (i: number) => r1(pad.l + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w));
  const Y = (v: number) => r1(pad.t + ((hi - v) / (hi - lo)) * h);
  const grid = [2, 4, 6, 8, 10].filter((g) => g >= lo);
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(i)} ${Y(p.value)}`).join("");

  return (
    <svg className="chart" width={width} height={height} role="img" aria-label={`Total Breath Score per session: ${points.map((p) => p.title).join("; ")}`}>
      {grid.map((g) => (
        <g key={g}>
          <line className="grid-dash" x1={pad.l} x2={width - pad.r} y1={Y(g)} y2={Y(g)} />
          <text x={0} y={Y(g) + 4}>
            {g}
          </text>
        </g>
      ))}
      <path d={d} className="trend-line" />
      {points.map((p, i) => {
        const last = i === points.length - 1;
        return (
          <circle key={i} cx={X(i)} cy={Y(p.value)} r={last ? 4 : 3} className={last ? "trend-dot is-last" : "trend-dot"}>
            <title>{p.title}</title>
          </circle>
        );
      })}
      <text x={pad.l} y={height - 4}>
        {points[0].label}
      </text>
      {points.length > 1 && (
        <text x={width - pad.r} y={height - 4} textAnchor="end">
          {points[points.length - 1].label}
        </text>
      )}
    </svg>
  );
}

/** Breathing rate per open session, against the typical 12–16 br/min band. */
export function RateBars({ points, width, height = 128 }: { points: TrendPoint[]; width: number; height?: number }) {
  const pad = { l: 24, r: 4, t: 8, b: 20 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const hi = Math.max(20, Math.ceil(Math.max(...points.map((p) => p.value)) / 4) * 4 + 4);
  const Y = (v: number) => r1(pad.t + ((hi - v) / hi) * h);
  const slot = w / points.length;
  const bar = Math.min(14, slot * 0.6);

  return (
    <svg className="chart" width={width} height={height} role="img" aria-label={`Breathing rate per open session: ${points.map((p) => p.title).join("; ")}`}>
      <rect className="band" x={pad.l} y={Y(16)} width={w} height={Y(12) - Y(16)} />
      <line className="band-edge" x1={pad.l} x2={pad.l + w} y1={Y(16)} y2={Y(16)} />
      <line className="band-edge" x1={pad.l} x2={pad.l + w} y1={Y(12)} y2={Y(12)} />
      <text x={0} y={Y(16) + 4}>
        16
      </text>
      <text x={0} y={Y(12) + 4}>
        12
      </text>
      <line className="baseline" x1={pad.l} x2={pad.l + w} y1={Y(0)} y2={Y(0)} />
      {points.map((p, i) => {
        const x = r1(pad.l + slot * i + (slot - bar) / 2);
        return (
          <rect
            key={i}
            x={x}
            y={Y(p.value)}
            width={r1(bar)}
            height={r1(Y(0) - Y(p.value))}
            rx={2}
            className={i === points.length - 1 ? "bar is-last" : "bar"}
          >
            <title>{p.title}</title>
          </rect>
        );
      })}
      <text x={pad.l} y={height - 4}>
        {points[0].label}
      </text>
      {points.length > 1 && (
        <text x={width - pad.r} y={height - 4} textAnchor="end">
          {points[points.length - 1].label}
        </text>
      )}
    </svg>
  );
}

/** Tiny 1–10 trend for table rows. Oldest first. */
export function Sparkline({ values, width = 112, height = 28, label }: { values: number[]; width?: number; height?: number; label: string }) {
  if (values.length === 0) return <span className="muted">–</span>;
  const pad = 4;
  const X = (i: number) => r1(pad + (values.length === 1 ? (width - pad * 2) / 2 : (i / (values.length - 1)) * (width - pad * 2)));
  const Y = (v: number) => r1(pad + ((10 - v) / 9) * (height - pad * 2));
  const last = values.length - 1;
  return (
    <svg className="chart" width={width} height={height} role="img" aria-label={label}>
      <line className="grid-dash" x1={pad} x2={width - pad} y1={Y(7)} y2={Y(7)} />
      <path className="trend-line thin" d={values.map((v, i) => `${i ? "L" : "M"}${X(i)} ${Y(v)}`).join("")} />
      <circle className="trend-dot is-last" cx={X(last)} cy={Y(values[last])} r={3} />
    </svg>
  );
}
