"use client";

import { useSvgId } from "@/components/charts";
import { formatDuration } from "@/lib/domain/format";
import { pacerAt, pacerCue, pacerValue } from "@/lib/domain/group";
import type { GroupSession } from "@/lib/domain/types";

// Charts for a group session. Every trace is on the pacer's scale (−1 fully
// out, 1 fully in) and drawn against seconds since the start, so lanes for
// different athletes line up exactly in time.

type Plan = Pick<GroupSession, "pacerHalfCycleSec" | "pacerChanges">;

const r1 = (n: number) => Math.round(n * 10) / 10;
const LIMIT = 1.35;

/** A trace as path segments, broken wherever a sample is missing. */
function segments(t: number[], v: (number | null)[], X: (t: number) => number, Y: (v: number) => number, t0: number, t1: number) {
  let d = "";
  let pen = false;
  for (let i = 0; i < t.length; i++) {
    const value = v[i];
    if (t[i] < t0 || t[i] > t1 || value === null || value === undefined) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${X(t[i])} ${Y(Math.max(-LIMIT, Math.min(LIMIT, value)))}`;
    pen = true;
  }
  return d;
}

function pacerPath(plan: Plan, t0: number, t1: number, X: (t: number) => number, Y: (v: number) => number) {
  let d = "";
  const step = Math.max(0.05, (t1 - t0) / 300);
  for (let t = Math.max(0, t0); t <= t1 + 1e-6; t += step) d += `${d ? "L" : "M"}${X(t)} ${Y(pacerValue(plan, t))}`;
  return d;
}

export interface Lane {
  id: string;
  label: string;
  /** Seconds since the session started, ascending. */
  t: number[];
  v: (number | null)[];
  /** Shown instead of a trace (curve private, waiting to join…). */
  placeholder?: string;
  dim?: boolean;
}

/**
 * Several athletes on one time axis: a lane each, sharing the gridlines, the
 * pacer and the "now" line, so breaths can be compared one under another.
 */
export function AlignedLanes({
  lanes,
  plan,
  markers,
  t0,
  t1,
  width,
  laneHeight = 64,
  now,
}: {
  lanes: Lane[];
  plan: Plan;
  markers: number[];
  t0: number;
  t1: number;
  width: number;
  laneHeight?: number;
  /** Draws a "now" line at this time (live view). */
  now?: number;
}) {
  const pad = { l: 112, r: 12, t: 6, b: 24 };
  const w = width - pad.l - pad.r;
  const height = pad.t + lanes.length * laneHeight + pad.b;
  const X = (t: number) => r1(pad.l + ((t - t0) / (t1 - t0)) * w);
  const span = t1 - t0;
  const step = span <= 35 ? 5 : span <= 70 ? 10 : span <= 400 ? 60 : 120;
  const ticks: number[] = [];
  for (let t = Math.ceil(t0 / step) * step; t <= t1 + 1e-6; t += step) ticks.push(t);
  const clip = useSvgId("lanes");

  return (
    <svg className="chart lanes" width={width} height={height} role="img" aria-label={`Breathing of ${lanes.length} people on one time axis, ${formatDuration(Math.max(0, t0))} to ${formatDuration(t1)}`}>
      <defs>
        <clipPath id={clip}>
          <rect x={pad.l} y={0} width={w} height={height} />
        </clipPath>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={X(t)} x2={X(t)} y1={pad.t} y2={height - pad.b} />
          <text x={X(t)} y={height - 6} textAnchor="middle">
            {formatDuration(t)}
          </text>
        </g>
      ))}
      {lanes.map((lane, k) => {
        const top = pad.t + k * laneHeight;
        const mid = top + laneHeight / 2;
        const Y = (v: number) => r1(mid - (v / LIMIT) * (laneHeight / 2 - 4));
        const user = lane.placeholder ? "" : segments(lane.t, lane.v, X, Y, t0, t1);
        return (
          <g key={lane.id} className={lane.dim ? "lane is-dim" : "lane"}>
            {k > 0 && <line className="lane-rule" x1={0} x2={width} y1={top} y2={top} />}
            <text className="lane-name" x={0} y={mid + 4}>
              {lane.label}
            </text>
            <g clipPath={`url(#${clip})`}>
              <line className="midline" x1={pad.l} x2={pad.l + w} y1={mid} y2={mid} />
              <path className="pacer" d={pacerPath(plan, t0, t1, X, Y)} />
              {lane.placeholder ? (
                <text className="lane-note" x={pad.l + 8} y={mid + 4}>
                  {lane.placeholder}
                </text>
              ) : (
                <SplitTrace d={user} mid={mid} width={width} height={height} />
              )}
            </g>
          </g>
        );
      })}
      {markers
        .filter((m) => m >= t0 && m <= t1)
        .map((m) => (
          <line key={`m${m}`} className="marker" x1={X(m)} x2={X(m)} y1={pad.t} y2={height - pad.b} />
        ))}
      {now !== undefined && now >= t0 && <line className="now-line" x1={X(now)} x2={X(now)} y1={pad.t} y2={height - pad.b} />}
    </svg>
  );
}

/** A trace coloured by side of the midline: inhale (above) red, exhale (below) blue. */
function SplitTrace({ d, mid, width, height }: { d: string; mid: number; width: number; height: number }) {
  const above = useSvgId("above");
  const below = useSvgId("below");
  if (!d) return null;
  return (
    <>
      <defs>
        <clipPath id={above}>
          <rect x={0} y={0} width={width} height={mid} />
        </clipPath>
        <clipPath id={below}>
          <rect x={0} y={mid} width={width} height={height - mid} />
        </clipPath>
      </defs>
      <path className="trace-in" d={d} clipPath={`url(#${above})`} />
      <path className="trace-out" d={d} clipPath={`url(#${below})`} />
    </>
  );
}

/** One athlete's last few seconds against the pacer, for their card. */
export function MiniTrace({
  t,
  v,
  plan,
  t1,
  span = 20,
  width,
  height = 84,
}: {
  t: number[];
  v: (number | null)[];
  plan: Plan;
  t1: number;
  span?: number;
  width: number;
  height?: number;
}) {
  const t0 = t1 - span;
  const X = (x: number) => r1(((x - t0) / span) * width);
  const mid = height / 2;
  const Y = (x: number) => r1(mid - (x / LIMIT) * (mid - 3));
  return (
    <svg className="chart mini" width={width} height={height} role="img" aria-label={`Last ${span} seconds of breathing against the pacer`}>
      <line className="midline" x1={0} x2={width} y1={mid} y2={mid} />
      <path className="pacer" d={pacerPath(plan, t0, t1, X, Y)} />
      <SplitTrace d={segments(t, v, X, Y, t0, t1)} mid={mid} width={width} height={height} />
    </svg>
  );
}

/** The shared pacer, big: a circle that fills on the inhale and empties on the exhale. */
export function PacerRing({ plan, t, size = 220 }: { plan: Plan; t: number; size?: number }) {
  const v = pacerValue(plan, t);
  const { dir, secondsLeft } = pacerCue(plan, t);
  const c = size / 2;
  const rMin = size * 0.2;
  const rMax = size * 0.46;
  const r = rMin + ((v + 1) / 2) * (rMax - rMin);
  const half = pacerAt(plan, t);
  return (
    <div className="pacer-ring" data-dir={dir}>
      <div className="ring-box" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle className="ring-guide" cx={c} cy={c} r={rMax} />
          <circle className="ring-guide inner" cx={c} cy={c} r={rMin} />
          <circle className="ring-fill" cx={c} cy={c} r={r1(r)} />
        </svg>
        <span className="ring-cue" aria-hidden="true">
          {Math.ceil(secondsLeft)}
        </span>
      </div>
      <b className="ring-word">{dir === "in" ? "Breathe in" : "Breathe out"}</b>
      <p className="label ring-caption">
        Pacer {half}-{half} · {half} s in, {half} s out
      </p>
    </div>
  );
}

/** The athlete's breath (filled) inside the pacer's circle (outline), small. */
export function MiniRing({ value, pacer, size = 56 }: { value: number | null; pacer: number; size?: number }) {
  const c = size / 2;
  const rr = (x: number) => r1(size * 0.14 + ((Math.max(-1.2, Math.min(1.2, x)) + 1.2) / 2.4) * size * 0.34);
  return (
    <svg className="mini-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="ring-pacer" cx={c} cy={c} r={rr(pacer)} />
      {value !== null && <circle className="ring-user" data-dir={value >= 0 ? "in" : "out"} cx={c} cy={c} r={rr(value)} />}
    </svg>
  );
}
