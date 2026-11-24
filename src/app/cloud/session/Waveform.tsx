"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { useSvgId } from "@/components/charts";
import { formatDuration } from "@/lib/domain/format";
import type { Waveform } from "@/lib/domain/types";
import type { BreathDeviation, WaveFrame } from "@/lib/domain/waveform";

// The session waveform, the per-breath deviation strip under it, and the
// whole-session scrubber. All three share the same left/right padding so
// their time axes line up.

export const WAVE_PAD = { l: 56, r: 12 };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Samples between t0 and t1 as an SVG path, thinned to about `maxPoints`. */
function tracePath(
  values: number[],
  hz: number,
  t0: number,
  t1: number,
  X: (t: number) => number,
  Y: (v: number) => number,
  maxPoints: number,
): string {
  const i0 = Math.max(0, Math.floor(t0 * hz));
  const i1 = Math.min(values.length - 1, Math.ceil(t1 * hz));
  const step = Math.max(1, Math.floor((i1 - i0) / maxPoints));
  let d = "";
  for (let i = i0; i <= i1; i += step) d += `${d ? "L" : "M"}${X(i / hz)} ${Y(values[i])}`;
  return d;
}

function tickStep(span: number): number {
  return span <= 12 ? 2 : span <= 35 ? 5 : span <= 70 ? 10 : span <= 400 ? 60 : 120;
}

/** The user's trace against the pacer: inhale above the dashed midline in red, exhale below in blue. */
export function WaveChart({
  waveform,
  frame,
  t0,
  t1,
  width,
  height = 200,
}: {
  waveform: Waveform;
  frame: WaveFrame;
  t0: number;
  t1: number;
  width: number;
  height?: number;
}) {
  const pad = { ...WAVE_PAD, t: 8, b: 22 };
  const box = { x: pad.l, y: pad.t, w: width - pad.l - pad.r, h: height - pad.t - pad.b };
  const X = (t: number) => r1(box.x + ((t - t0) / (t1 - t0)) * box.w);
  const Y = (v: number) => r1(box.y + box.h / 2 - ((v - frame.midline) / frame.range) * (box.h / 2));
  const midY = Y(frame.midline);
  const clipIn = useSvgId("in");
  const clipOut = useSvgId("out");

  const span = t1 - t0;
  const step = tickStep(span);
  const ticks: number[] = [];
  for (let t = Math.ceil(t0 / step) * step; t <= t1 + 1e-6; t += step) ticks.push(t);

  const maxPoints = box.w * 1.5;
  const user = tracePath(waveform.user, frame.hz, t0, t1, X, Y, maxPoints);
  const pacer = waveform.pacer && tracePath(waveform.pacer, frame.hz, t0, t1, X, Y, maxPoints);
  const markers = waveform.markers.map((i) => i / frame.hz).filter((t) => t >= t0 && t <= t1);

  return (
    <svg
      className="chart wave"
      width={width}
      height={height}
      role="img"
      aria-label={`Breathing ${waveform.pacer ? "against the pacer " : ""}from ${formatDuration(t0)} to ${formatDuration(t1)}. Inhale above the midline, exhale below.`}
    >
      <defs>
        <clipPath id={clipIn}>
          <rect x={0} y={0} width={width} height={midY} />
        </clipPath>
        <clipPath id={clipOut}>
          <rect x={0} y={midY} width={width} height={height - midY} />
        </clipPath>
      </defs>
      {ticks.map((t) => (
        <line key={t} className="grid" x1={X(t)} x2={X(t)} y1={box.y} y2={box.y + box.h} />
      ))}
      <line className="midline" x1={box.x} x2={box.x + box.w} y1={midY} y2={midY} />
      {pacer && <path className="pacer" d={pacer} strokeWidth={span <= 70 ? 7 : 4} />}
      <path className="trace-in" d={user} clipPath={`url(#${clipIn})`} />
      <path className="trace-out" d={user} clipPath={`url(#${clipOut})`} />
      {markers.map((t) => (
        <g key={t}>
          <line className="marker" x1={X(t)} x2={X(t)} y1={box.y} y2={box.y + box.h} />
          <text className="marker-lbl" x={X(t) + 4} y={box.y + 12}>
            Marker
          </text>
        </g>
      ))}
      <text className="lane-lbl" x={pad.l - 8} y={box.y + 12} textAnchor="end">
        IN
      </text>
      <text className="lane-lbl" x={pad.l - 8} y={box.y + box.h - 3} textAnchor="end">
        OUT
      </text>
      {ticks.map((t) => (
        <text key={t} x={X(t)} y={height - 5} textAnchor="middle">
          {formatDuration(t)}
        </text>
      ))}
    </svg>
  );
}

const signed = (v: number, unit: string) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}${unit}`;

/** Per-breath timing and depth difference from the pacer, aligned under WaveChart. */
export function DeviationStrip({
  breaths,
  t0,
  t1,
  width,
  halfCycle,
}: {
  breaths: BreathDeviation[];
  t0: number;
  t1: number;
  width: number;
  halfCycle: number;
}) {
  const laneH = 28;
  const gap = 8;
  const height = laneH * 2 + gap;
  const box = { x: WAVE_PAD.l, w: width - WAVE_PAD.l - WAVE_PAD.r };
  const X = (t: number) => r1(box.x + ((t - t0) / (t1 - t0)) * box.w);
  const inView = breaths.filter((b) => b.tPeak >= t0 && b.tPeak <= t1);
  const barW = Math.max(3, Math.min(8, (box.w / Math.max(1, ((t1 - t0) / (halfCycle * 2)) * 2)) * 0.35));

  const lanes = [
    { label: "Timing", y0: 0, max: Math.max(0.4, halfCycle * 0.25), unit: " s", in: "inLag", out: "outLag", words: ["late", "early"] },
    { label: "Depth", y0: laneH + gap, max: 25, unit: "%", in: "inDepth", out: "outDepth", words: ["deeper", "shallower"] },
  ] as const;

  return (
    <svg
      className="chart"
      width={width}
      height={height}
      role="img"
      aria-label="Per-breath difference from the pacer. Timing: bars up are late, down are early. Depth: bars up are deeper, down are shallower."
    >
      {lanes.map((lane) => {
        const mid = lane.y0 + laneH / 2;
        const half = laneH / 2 - 2;
        return (
          <g key={lane.label}>
            <line className="grid" x1={box.x} x2={box.x + box.w} y1={mid} y2={mid} />
            <text className="lane-lbl" x={WAVE_PAD.l - 8} y={mid + 4} textAnchor="end">
              {lane.label}
            </text>
            {inView.flatMap((b) =>
              (["in", "out"] as const).map((dir) => {
                const value = b[dir === "in" ? lane.in : lane.out];
                const clamped = Math.max(-lane.max, Math.min(lane.max, value));
                const h = Math.max(1.5, (Math.abs(clamped) / lane.max) * half);
                const t = dir === "in" ? b.tPeak : b.tTrough;
                if (t > t1) return null;
                return (
                  <rect
                    key={`${b.n}${dir}`}
                    x={r1(X(t) - barW / 2)}
                    y={r1(clamped >= 0 ? mid - h : mid)}
                    width={r1(barW)}
                    height={r1(h)}
                    rx={1}
                    className={`dev-${dir}`}
                  >
                    <title>
                      {`Breath ${b.n}, ${dir === "in" ? "inhale" : "exhale"} ${lane.label.toLowerCase()}: ${signed(value, lane.unit)}${value === 0 ? "" : ` ${value > 0 ? lane.words[0] : lane.words[1]}`}`}
                    </title>
                  </rect>
                );
              }),
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Whole-session overview with the visible window framed. Drag, click or use the arrow keys to move it. */
export function SessionScrubber({
  waveform,
  frame,
  t0,
  span,
  width,
  onChange,
}: {
  waveform: Waveform;
  frame: WaveFrame;
  t0: number;
  span: number;
  width: number;
  onChange: (t0: number) => void;
}) {
  const height = 30;
  const box = { x: WAVE_PAD.l, w: width - WAVE_PAD.l - WAVE_PAD.r };
  const { duration } = frame;
  const X = (t: number) => r1(box.x + (t / duration) * box.w);
  const Y = (v: number) => r1(height / 2 - ((v - frame.midline) / frame.range) * (height / 2 - 3));
  const clipIn = useSvgId("sin");
  const clipOut = useSvgId("sout");
  const d = tracePath(waveform.user, frame.hz, 0, duration, X, Y, box.w);
  const maxStart = Math.max(0, duration - span);
  const clampStart = (t: number) => Math.max(0, Math.min(maxStart, t));
  const x0 = X(t0);
  const x1 = X(Math.min(duration, t0 + span));

  const moveTo = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - rect.left - box.x) / box.w) * duration;
    onChange(clampStart(t - span / 2));
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const nudge = e.shiftKey ? span : span / 4;
    const next =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? t0 - nudge
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? t0 + nudge
          : e.key === "PageUp"
            ? t0 - span
            : e.key === "PageDown"
              ? t0 + span
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? maxStart
                  : null;
    if (next === null) return;
    e.preventDefault();
    onChange(clampStart(next));
  };

  return (
    <svg
      className="chart scrubber"
      width={width}
      height={height}
      role="slider"
      tabIndex={0}
      aria-label="Part of the session shown above"
      aria-valuemin={0}
      aria-valuemax={Math.round(maxStart)}
      aria-valuenow={Math.round(t0)}
      aria-valuetext={`${formatDuration(t0)} to ${formatDuration(t0 + span)} of ${formatDuration(duration)}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons & 1) moveTo(e);
      }}
      onKeyDown={onKeyDown}
    >
      <defs>
        <clipPath id={clipIn}>
          <rect x={0} y={0} width={width} height={height / 2} />
        </clipPath>
        <clipPath id={clipOut}>
          <rect x={0} y={height / 2} width={width} height={height / 2} />
        </clipPath>
      </defs>
      <rect className="well" x={box.x} y={0} width={box.w} height={height} rx={3} />
      <path className="trace-in thin" d={d} clipPath={`url(#${clipIn})`} />
      <path className="trace-out thin" d={d} clipPath={`url(#${clipOut})`} />
      <rect className="dim" x={box.x} y={0} width={Math.max(0, x0 - box.x)} height={height} />
      <rect className="dim" x={x1} y={0} width={Math.max(0, box.x + box.w - x1)} height={height} />
      <rect className="window" x={x0} y={1} width={Math.max(2, x1 - x0)} height={height - 2} rx={3} />
      <text x={WAVE_PAD.l - 8} y={height / 2 + 4} textAnchor="end">
        {formatDuration(0)}
      </text>
    </svg>
  );
}

/** Breaths whose inhale peak falls in the window, as a table. */
export function BreathTable({ breaths, t0, t1 }: { breaths: BreathDeviation[]; t0: number; t1: number }) {
  const rows = breaths.filter((b) => b.tPeak >= t0 && b.tPeak <= t1);
  if (rows.length === 0) return <p className="muted">No complete breaths in this part of the session.</p>;
  return (
    <div className="bt-scroll">
      <table className="table bt">
        <thead>
          <tr>
            <th>Breath</th>
            <th className="num">Inhale timing</th>
            <th className="num">Exhale timing</th>
            <th className="num">Inhale depth</th>
            <th className="num">Exhale depth</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.n}>
              <td>{b.n}</td>
              <td className="num">{signed(b.inLag, " s")}</td>
              <td className="num">{signed(b.outLag, " s")}</td>
              <td className="num">{signed(b.inDepth, "%")}</td>
              <td className="num">{signed(b.outDepth, "%")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
