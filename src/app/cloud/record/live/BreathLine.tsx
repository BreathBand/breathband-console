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
  label: string;
}

function token(el: Element, name: string, fallback: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/**
 * The line view: your breath scrolling right to left, red rising and blue
 * falling. Paced, the pacer runs on ahead of "now" so you can see the next
 * turn coming; open, the midline and the ±3 % guides (a normal breath is about
 * 6 % peak to trough) stand in for it. Markers are drawn as numbered lines.
 */
export function BreathLine({ read, halfCycleS, markers, windowS = 24, label }: BreathLineProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
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
      const ahead = halfCycleS ? windowS * 0.35 : 0;
      const from = now - (windowS - ahead);
      const x = (t: number) => ((t - from) / windowS) * w;
      const range = PACER_AMPLITUDE_PCT * 2.6;
      const y = (pct: number) => h / 2 - (pct / range) * (h / 2) * 0.92;

      const ink2 = token(canvas, "--c-ink-3", "#77726a");
      const band = token(canvas, "--c-well", "#211f1d");
      ctx.fillStyle = band;
      ctx.fillRect(0, y(PACER_AMPLITUDE_PCT), w, y(-PACER_AMPLITUDE_PCT) - y(PACER_AMPLITUDE_PCT));
      ctx.strokeStyle = ink2;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      for (const g of [PACER_AMPLITUDE_PCT, 0, -PACER_AMPLITUDE_PCT]) {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y(g)) + 0.5);
        ctx.lineTo(w, Math.round(y(g)) + 0.5);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      if (halfCycleS) {
        ctx.strokeStyle = token(canvas, "--pacer-line", "rgba(238,235,228,.38)");
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let px = 0; px <= w; px += 3) {
          const t = from + (px / w) * windowS;
          const v = -PACER_AMPLITUDE_PCT * Math.cos((Math.PI * Math.max(0, t)) / halfCycleS);
          if (px === 0) ctx.moveTo(px, y(v));
          else ctx.lineTo(px, y(v));
        }
        ctx.stroke();
      }

      const nowX = x(now);
      ctx.strokeStyle = token(canvas, "--c-ink-2", "#aaa59c");
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(nowX) + 0.5, 0);
      ctx.lineTo(Math.round(nowX) + 0.5, h);
      ctx.stroke();

      ctx.font = `600 12px ${token(canvas, "--f-sans", "sans-serif")}`;
      markers().forEach((m, i) => {
        const mx = x(m / SAMPLE_RATE_HZ);
        if (mx < 0 || mx > w) return;
        ctx.strokeStyle = token(canvas, "--c-ink", "#eeebe4");
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(Math.round(mx) + 0.5, 18);
        ctx.lineTo(Math.round(mx) + 0.5, h);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = token(canvas, "--c-ink", "#eeebe4");
        ctx.fillText(`Marker ${i + 1}`, mx + 6, 14);
      });

      const first = Math.max(0, Math.floor(from * SAMPLE_RATE_HZ));
      const seen = data.slice(first);
      if (seen.length < 2) return;
      const dirs = directions(seen);
      const inC = token(canvas, "--c-in", "#e8644f");
      const outC = token(canvas, "--c-out", "#6f97e0");
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      let up = dirs[0];
      ctx.strokeStyle = up ? inC : outC;
      ctx.beginPath();
      ctx.moveTo(x((first) / SAMPLE_RATE_HZ), y(seen[0]));
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
      ctx.fillStyle = up ? inC : outC;
      ctx.beginPath();
      ctx.arc(nowX, y(seen[seen.length - 1]), 6, 0, Math.PI * 2);
      ctx.fill();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [read, halfCycleS, markers, windowS]);

  return <canvas ref={ref} className="breath-line" role="img" aria-label={label} />;
}
