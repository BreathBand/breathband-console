"use client";

import { useEffect, useRef } from "react";
import { PACER_AMPLITUDE_PCT } from "@/lib/analysis/synth";

const SIZE = 420;
const R_MIN = 70;
const R_MAX = 190;

/** Radius for a level from −1 (all the way out) to 1 (all the way in). */
const radius = (level: number) => R_MIN + ((Math.max(-1.6, Math.min(1.6, level)) + 1) / 2) * (R_MAX - R_MIN);

export interface PacerFrame {
  /** Seconds since the pacer's first inhale. */
  t: number;
  /** The athlete's newest reading in % of max, or null before calibration. */
  userPct: number | null;
}

/**
 * The circle pacer: a ring that grows as you breathe in and shrinks as you
 * breathe out, with a filled disc for your own breath inside it, so matching
 * the ring is the whole task. Red while the pacer breathes in, blue out.
 * Updated every frame through refs, not React state.
 */
export function PacerCircle({ halfCycleS, frame }: { halfCycleS: number; frame: () => PacerFrame }) {
  const ring = useRef<SVGCircleElement>(null);
  const you = useRef<SVGCircleElement>(null);
  const word = useRef<HTMLParagraphElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastWord = "";
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const { t, userPct } = frame();
      const pacerLevel = -Math.cos((Math.PI * t) / halfCycleS);
      const inhaling = Math.floor(t / halfCycleS) % 2 === 0;
      ring.current?.setAttribute("r", radius(pacerLevel).toFixed(1));
      if (userPct !== null) you.current?.setAttribute("r", radius(userPct / PACER_AMPLITUDE_PCT).toFixed(1));
      const w = inhaling ? "Breathe in" : "Breathe out";
      if (w !== lastWord && word.current && root.current) {
        lastWord = w;
        word.current.textContent = w;
        root.current.dataset.phase = inhaling ? "in" : "out";
      }
      if (count.current) count.current.textContent = String(Math.ceil(halfCycleS - (t % halfCycleS)));
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [halfCycleS, frame]);

  return (
    <div className="pacer-circle" ref={root} data-phase="in">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R_MAX} className="pc-max" />
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R_MIN} className="pc-min" />
        <circle ref={you} cx={SIZE / 2} cy={SIZE / 2} r={R_MIN} className="pc-you" />
        <circle ref={ring} cx={SIZE / 2} cy={SIZE / 2} r={R_MIN} className="pc-ring" />
      </svg>
      <div className="pc-label">
        <p ref={word} className="pc-word" aria-live="polite">
          Breathe in
        </p>
        <span ref={count} className="pc-count mono" aria-hidden="true">
          {halfCycleS}
        </span>
      </div>
    </div>
  );
}
