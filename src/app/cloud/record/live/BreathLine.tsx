"use client";

import { useEffect, useRef } from "react";
import { directions } from "@/components/LiveTrace";
import { PACER_AMPLITUDE_PCT } from "@/lib/analysis/synth";
import { SAMPLE_RATE_HZ } from "@/lib/device/config";

export interface BreathLineProps {
  /** The recording so far in % of max, read every frame. */
  read: () => readonly number[];
  /** Paced: the pacer's half cycle. Open: null (midline and ±3 % guides instead). */
  halfCycleS: number | null;
  /** Marker sample indices (open sessions). */
  markers: () => readonly number[];
  /** Seconds of history on screen. */
  windowS?: number;
  /** Draw the labels and per-turn feedback (the full view); off for small strips. */
  annotate?: boolean;
  label: string;
}

/** How one of your turning points compared with the pacer's, or with the normal depth in open sessions. */
export interface TurnFeedback {
  /** Seconds into the recording of your turning point. */
  t: number;
  level: number;
  kind: "peak" | "trough";
  /** Paced only: you minus the pacer, in seconds (negative is early). */
  dt: number | null;
  /** Paced: depth beyond the pacer's ±3 % (positive is deeper). Open: peak-to-trough depth in % of max. */
  depth: number;
  /** Open only: this breath's length in seconds. */
  breathS: number | null;
}

const SMOOTH = 5;

function smoothAt(data: readonly number[], i: number): number {
  const from = Math.max(0, i - SMOOTH + 1);
  let sum = 0;
  for (let j = from; j <= i; j++) sum += data[j];
  return sum / (i - from + 1);
}

/**
 * Your turning point near one pacer turn: the highest (peak) or lowest
 * (trough) smoothed sample within the window. Null until the window has
 * passed, so feedback appears once the turn is complete.
 */
export function pacedTurn(data: readonly number[], k: number, halfCycleS: number, rateHz = SAMPLE_RATE_HZ): TurnFeedback | null {
  const tPacer = k * halfCycleS;
  const reach = Math.min(2.5, halfCycleS * 0.6);
  const from = Math.max(0, Math.floor((tPacer - reach) * rateHz));
  const to = Math.floor((tPacer + reach) * rateHz);
  if (to >= data.length || from >= to) return null;
  const kind = k % 2 === 1 ? "peak" : "trough";
  const sign = kind === "peak" ? 1 : -1;
  let best = from;
  for (let i = from; i <= to; i++) if (sign * smoothAt(data, i) > sign * smoothAt(data, best)) best = i;
  const level = smoothAt(data, best);
  const t = best / rateHz;
  return { t, level, kind, dt: t - tPacer, depth: sign * level - PACER_AMPLITUDE_PCT, breathS: null };
}

/** Peaks and troughs of an open recording on the smoothed signal, at least 0.6 s apart and 1 % of max deep. */
export function openTurns(data: readonly number[], fromIndex: number, rateHz = SAMPLE_RATE_HZ): TurnFeedback[] {
  const turns: { i: number; v: number; kind: "peak" | "trough" }[] = [];
  const minGap = Math.round(0.6 * rateHz);
  for (let i = Math.max(1, fromIndex); i < data.length - minGap; i++) {
    const v = smoothAt(data, i);
    let isPeak = true;
    let isTrough = true;
    for (let j = i - minGap; j <= i + minGap; j++) {
      if (j === i || j < 0) continue;
      const w = smoothAt(data, j);
      if (w > v) isPeak = false;
      if (w < v) isTrough = false;
    }
    if (!isPeak && !isTrough) continue;
    const kind = isPeak ? "peak" : "trough";
    const last = turns[turns.length - 1];
    if (last && last.kind === kind) {
      if ((kind === "peak" && v > last.v) || (kind === "trough" && v < last.v)) turns[turns.length - 1] = { i, v, kind };
      continue;
    }
    if (last && Math.abs(v - last.v) < 1) continue;
    turns.push({ i, v, kind });
  }
  const out: TurnFeedback[] = [];
  for (let n = 1; n < turns.length; n++) {
    const cur = turns[n];
    if (cur.kind !== "peak") continue;
    const prevTrough = turns[n - 1];
    const prevPeak = turns.slice(0, n - 1).reverse().find((x) => x.kind === "peak");
    out.push({
      t: cur.i / rateHz,
      level: cur.v,
      kind: "peak",
      dt: null,
      depth: cur.v - prevTrough.v,
      breathS: prevPeak ? (cur.i - prevPeak.i) / rateHz : null,
    });
  }
  return out;
}

/** "on time", "0.4 s early", "0.2 s late". */
export function timingText(dt: number): string {
  if (Math.abs(dt) < 0.25) return "on time";
  return `${Math.abs(dt).toFixed(1)} s ${dt < 0 ? "early" : "late"}`;
}

/** "on depth", "1.2 % deeper", "0.8 % shallower". */
export function depthText(depth: number): string {
  if (Math.abs(depth) < 0.5) return "on depth";
  return `${Math.abs(depth).toFixed(1)}% ${depth > 0 ? "deeper" : "shallower"}`;
}

function token(el: Element, name: string, fallback: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/** A small rounded tag with one or two lines, kept inside the canvas. */
function tag(ctx: CanvasRenderingContext2D, x: number, y: number, lines: string[], colours: { bg: string; ink: string; edge: string }, w: number, above: boolean) {
  const padX = 7;
  const lineH = 15;
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2;
  const height = lines.length * lineH + 8;
  const left = Math.max(4, Math.min(w - width - 4, x - width / 2));
  const top = above ? y - height - 12 : y + 12;
  ctx.fillStyle = colours.bg;
  ctx.strokeStyle = colours.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colours.ink;
  lines.forEach((l, i) => ctx.fillText(l, left + padX, top + 4 + lineH * (i + 1) - 4));
}

/**
 * The line view: your breath scrolling right to left, red rising and blue
 * falling. Paced, the pacer runs on ahead of "now" so you can see the next
 * turn coming; open, the midline and the ±3 % guides (a normal breath is about
 * 6 % peak to trough) stand in for it. With `annotate`, every guide is named,
 * the next pacer turn is counted down, and each of your turns gets a tag once
 * it's complete: timing and depth against the pacer (paced), or depth and
 * length of the breath (open) — the same things the score is built from.
 */
export function BreathLine({ read, halfCycleS, markers, windowS = 24, annotate = false, label }: BreathLineProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const paced = new Map<number, TurnFeedback>();
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const ratio = globalThis.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
        canvas.width = Math.round(w * ratio);
        canvas.height = Math.round(h * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const data = read();
      const now = data.length / SAMPLE_RATE_HZ;
      const ahead = halfCycleS ? windowS * 0.35 : windowS * 0.08;
      const from = now - (windowS - ahead);
      const left = annotate ? 92 : 0;
      const bottom = annotate ? 24 : 0;
      const plotW = w - left;
      const plotH = h - bottom;
      const x = (t: number) => left + ((t - from) / windowS) * plotW;
      const range = PACER_AMPLITUDE_PCT * (annotate ? 3.2 : 2.6);
      const y = (pct: number) => plotH / 2 - (pct / range) * (plotH / 2) * 0.92;

      const sans = token(canvas, "--f-sans", "sans-serif");
      const ink = token(canvas, "--c-ink", "#eeebe4");
      const ink2 = token(canvas, "--c-ink-2", "#aaa59c");
      const ink3 = token(canvas, "--c-ink-3", "#77726a");
      const inC = token(canvas, "--c-in", "#e8644f");
      const outC = token(canvas, "--c-out", "#6f97e0");
      const pane = token(canvas, "--c-pane", "#191816");
      const rule = token(canvas, "--c-rule", "#2d2a27");
      const low = token(canvas, "--c-low-mark", "#d99a3a");

      // Target band and guides.
      ctx.fillStyle = token(canvas, "--c-well", "#211f1d");
      ctx.fillRect(left, y(PACER_AMPLITUDE_PCT), plotW, y(-PACER_AMPLITUDE_PCT) - y(PACER_AMPLITUDE_PCT));
      ctx.strokeStyle = ink3;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      for (const g of [PACER_AMPLITUDE_PCT, 0, -PACER_AMPLITUDE_PCT]) {
        ctx.beginPath();
        ctx.moveTo(left, Math.round(y(g)) + 0.5);
        ctx.lineTo(w, Math.round(y(g)) + 0.5);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      if (annotate) {
        // The left gutter names what each line means.
        ctx.font = `600 12px ${sans}`;
        ctx.textBaseline = "middle";
        ctx.fillStyle = ink2;
        ctx.fillText("+3% of max", 8, y(PACER_AMPLITUDE_PCT));
        ctx.fillText("Midline", 8, y(0));
        ctx.fillText("−3% of max", 8, y(-PACER_AMPLITUDE_PCT));
        ctx.fillStyle = inC;
        ctx.fillText("▲ Breathing in", 8, y(range * 0.8));
        ctx.fillStyle = outC;
        ctx.fillText("▼ Breathing out", 8, y(-range * 0.8));
        ctx.textBaseline = "alphabetic";
        // Seconds along the bottom, counted back from now.
        ctx.fillStyle = ink3;
        ctx.font = `500 11px ${sans}`;
        ctx.textAlign = "center";
        for (let s = 0; s <= windowS; s += 5) {
          const t = now - s;
          if (x(t) < left + 16) continue;
          ctx.fillText(s === 0 ? "now" : `−${s} s`, x(t), h - 6);
        }
        if (halfCycleS) {
          for (let s = 5; s < ahead; s += 5) ctx.fillText(`+${s} s`, x(now + s), h - 6);
        }
        ctx.textAlign = "left";
      }

      // The pacer, running ahead of now.
      if (halfCycleS) {
        ctx.strokeStyle = token(canvas, "--pacer-line", "rgba(238,235,228,.3)");
        ctx.lineWidth = annotate ? 12 : 10;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let px = left; px <= w; px += 3) {
          const t = from + ((px - left) / plotW) * windowS;
          const v = -PACER_AMPLITUDE_PCT * Math.cos((Math.PI * Math.max(0, t)) / halfCycleS);
          if (px === left) ctx.moveTo(px, y(v));
          else ctx.lineTo(px, y(v));
        }
        ctx.stroke();
        if (annotate) {
          // Label the pacer where it is ahead of you, and count down to its next turn.
          const nextK = Math.floor(now / halfCycleS) + 1;
          const tNext = nextK * halfCycleS;
          const nextIsTop = nextK % 2 === 1;
          const px = Math.min(w - 120, x(tNext));
          ctx.font = `600 12px ${sans}`;
          ctx.fillStyle = ink2;
          ctx.textAlign = "center";
          ctx.fillText("Pacer", x(now + ahead * 0.5), y(0) - 6);
          ctx.fillStyle = ink;
          const v = nextIsTop ? PACER_AMPLITUDE_PCT : -PACER_AMPLITUDE_PCT;
          ctx.fillText(
            `${nextIsTop ? "Top of the breath" : "Bottom of the breath"} in ${Math.max(0, tNext - now).toFixed(1)} s`,
            px,
            nextIsTop ? y(v) - 22 : y(v) + 30,
          );
          ctx.textAlign = "left";
        }
      }

      // Now.
      const nowX = x(now);
      ctx.strokeStyle = ink2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(nowX) + 0.5, 0);
      ctx.lineTo(Math.round(nowX) + 0.5, plotH);
      ctx.stroke();

      ctx.font = `600 12px ${sans}`;
      markers().forEach((m, i) => {
        const mx = x(m / SAMPLE_RATE_HZ);
        if (mx < left || mx > w) return;
        ctx.strokeStyle = ink;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(Math.round(mx) + 0.5, 18);
        ctx.lineTo(Math.round(mx) + 0.5, plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = ink;
        ctx.fillText(`Marker ${i + 1}`, mx + 6, 14);
      });

      // Your breath.
      const first = Math.max(0, Math.floor(from * SAMPLE_RATE_HZ));
      const seen = data.slice(first);
      if (seen.length < 2) return;
      const dirs = directions(seen);
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      let up = dirs[0];
      ctx.strokeStyle = up ? inC : outC;
      ctx.beginPath();
      ctx.moveTo(x(first / SAMPLE_RATE_HZ), y(seen[0]));
      for (let i = 1; i < seen.length; i++) {
        const px = x((first + i) / SAMPLE_RATE_HZ);
        ctx.lineTo(px, y(seen[i]));
        if (dirs[i] !== up && i < seen.length - 1) {
          ctx.stroke();
          up = dirs[i];
          ctx.strokeStyle = up ? inC : outC;
          ctx.beginPath();
          ctx.moveTo(px, y(seen[i]));
        }
      }
      ctx.stroke();
      const lastY = y(seen[seen.length - 1]);
      ctx.fillStyle = up ? inC : outC;
      ctx.beginPath();
      ctx.arc(nowX, lastY, 6, 0, Math.PI * 2);
      ctx.fill();

      if (!annotate) return;
      ctx.font = `700 12px ${sans}`;
      const you = `You · breathing ${up ? "in" : "out"}`;
      const youW = ctx.measureText(you).width + 14;
      ctx.fillStyle = up ? inC : outC;
      ctx.beginPath();
      ctx.roundRect(nowX + 12, lastY - 11, youW, 22, 11);
      ctx.fill();
      ctx.fillStyle = "#121110";
      ctx.fillText(you, nowX + 19, lastY + 4);

      // Feedback tags on each completed turn in view.
      ctx.font = `600 12px ${sans}`;
      const colours = (ok: boolean) => ({ bg: pane, ink: ok ? ink : low, edge: ok ? rule : low });
      if (halfCycleS) {
        const firstK = Math.max(1, Math.floor(from / halfCycleS));
        for (let k = firstK; k * halfCycleS < now; k++) {
          let turn = paced.get(k);
          if (!turn) {
            const found = pacedTurn(data, k, halfCycleS);
            if (!found) continue;
            paced.set(k, found);
            turn = found;
          }
          if (x(turn.t) < left + 30) continue;
          const ok = Math.abs(turn.dt ?? 0) < halfCycleS * 0.15 && Math.abs(turn.depth) < 1;
          ctx.fillStyle = turn.kind === "peak" ? inC : outC;
          ctx.beginPath();
          ctx.arc(x(turn.t), y(turn.level), 4, 0, Math.PI * 2);
          ctx.fill();
          tag(ctx, x(turn.t), y(turn.level), [timingText(turn.dt ?? 0), depthText(turn.depth)], colours(ok), w, turn.kind === "peak");
        }
      } else {
        for (const b of openTurns(data, Math.max(0, first - 6 * SAMPLE_RATE_HZ))) {
          if (x(b.t) < left + 30) continue;
          const ok = b.depth >= 4.5 && b.depth <= 7.5;
          tag(ctx, x(b.t), y(b.level), [`${b.depth.toFixed(1)}% deep`, b.breathS ? `${b.breathS.toFixed(1)} s breath` : "first breath"], colours(ok), w, true);
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [read, halfCycleS, markers, windowS, annotate]);

  return <canvas ref={ref} className="breath-line" role="img" aria-label={label} />;
}
