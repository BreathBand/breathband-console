"use client";

import { useEffect, useRef } from "react";

export interface LiveTraceProps {
  /** Returns the samples to draw, oldest first. Read on every animation frame. */
  read: () => readonly number[];
  /** How many of the newest samples fill the width. */
  window: number;
  height: number;
  /** Fixed vertical range; without it the trace scales to what is on screen. */
  range?: { min: number; max: number };
  /** Horizontal guides at these values (in the same units as the samples). */
  guides?: readonly number[];
  lineWidth?: number;
  label: string;
  className?: string;
}

const SMOOTH = 5;
const HOLD = 3;

/**
 * Rising (true) or falling per sample, from a short moving average and only
 * switching once the new direction has held for a few samples, so sensor
 * noise doesn't flicker the colour.
 */
export function directions(data: readonly number[]): boolean[] {
  const smooth = data.map((_, i) => {
    const from = Math.max(0, i - SMOOTH + 1);
    let sum = 0;
    for (let j = from; j <= i; j++) sum += data[j];
    return sum / (i - from + 1);
  });
  const out: boolean[] = [];
  let state = data.length > 1 ? data[Math.min(data.length - 1, SMOOTH)] >= data[0] : true;
  let streak = 0;
  for (let i = 0; i < data.length; i++) {
    const up = i === 0 ? state : smooth[i] >= smooth[i - 1];
    streak = up === state ? 0 : streak + 1;
    if (streak >= HOLD) {
      state = up;
      streak = 0;
    }
    out.push(state);
  }
  return out;
}

function cssVar(el: Element, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/**
 * A breath trace drawn live on a canvas: red while the reading rises (breathing
 * in), blue while it falls (breathing out), so direction is carried by colour
 * and by slope. Decorative for screen readers; the page states the numbers.
 */
export function LiveTrace({ read, window: span, height, range, guides, lineWidth = 2, label, className }: LiveTraceProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const ratio = globalThis.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(w * ratio);
        canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, w, height);
      const all = read();
      const data = all.slice(Math.max(0, all.length - span));
      let lo = range?.min ?? Infinity;
      let hi = range?.max ?? -Infinity;
      if (!range) {
        for (const v of data) {
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        const pad = Math.max((hi - lo) * 0.15, 1e-6);
        lo -= pad;
        hi += pad;
      }
      const y = (v: number) => height - ((v - lo) / (hi - lo || 1)) * height;
      const x = (i: number) => (i / Math.max(1, span - 1)) * w;
      const offset = span - data.length;

      if (guides?.length) {
        ctx.strokeStyle = cssVar(canvas, "--trace-guide", "rgba(128,128,128,.35)");
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        for (const g of guides) {
          ctx.beginPath();
          ctx.moveTo(0, Math.round(y(g)) + 0.5);
          ctx.lineTo(w, Math.round(y(g)) + 0.5);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      if (data.length < 2) return;
      const inColour = cssVar(canvas, "--trace-in", "#e8644f");
      const outColour = cssVar(canvas, "--trace-out", "#6f97e0");
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const dirs = directions(data);
      let rising = dirs[0];
      ctx.beginPath();
      ctx.strokeStyle = rising ? inColour : outColour;
      ctx.moveTo(x(offset), y(data[0]));
      for (let i = 1; i < data.length; i++) {
        const up = dirs[i];
        ctx.lineTo(x(offset + i), y(data[i]));
        if (up !== rising && i < data.length - 1) {
          ctx.stroke();
          rising = up;
          ctx.beginPath();
          ctx.strokeStyle = rising ? inColour : outColour;
          ctx.moveTo(x(offset + i), y(data[i]));
        }
      }
      ctx.stroke();
      const last = data[data.length - 1];
      ctx.fillStyle = rising ? inColour : outColour;
      ctx.beginPath();
      ctx.arc(x(offset + data.length - 1), y(last), lineWidth + 1.5, 0, Math.PI * 2);
      ctx.fill();
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [read, span, height, range, guides, lineWidth]);

  return (
    <canvas
      ref={ref}
      className={`live-trace${className ? ` ${className}` : ""}`}
      style={{ height, width: "100%", display: "block" }}
      role="img"
      aria-label={label}
    />
  );
}
