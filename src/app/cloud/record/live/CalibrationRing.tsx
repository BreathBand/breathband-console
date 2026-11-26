"use client";

import { useEffect, useRef } from "react";

const SIZE = 440;
const C = SIZE / 2;
const R_EMPTY = 64;
const R_FULL = 196;
/** How close to either end counts as reaching it. */
const REACHED = 0.9;

export interface CalibrationReading {
  /** 0 when fully out, 1 when fully in, relative to the deepest breaths so far. */
  fill: number;
  rising: boolean;
}

type Cue = "fill" | "full" | "empty" | "out";

const CUES: Record<Cue, { word: string; hint: string }> = {
  fill: { word: "Breathe in", hint: "Fill the circle all the way" },
  full: { word: "Full", hint: "Now push it all out" },
  out: { word: "Breathe out", hint: "Empty it completely" },
  empty: { word: "Empty", hint: "Now fill it again" },
};

/**
 * Calibration as a breathing circle, in the pacer's language: a dashed outer
 * ring marks "full" and a small inner ring marks "empty". Your breath is the
 * disc between them, red as it grows and blue as it shrinks. Each ring lights
 * up when you reach it, so the instruction is visible as well as written:
 * fill it to the outer ring, then push it down to the inner one.
 */
export function CalibrationRing({ read }: { read: () => CalibrationReading }) {
  const root = useRef<HTMLDivElement>(null);
  const disc = useRef<SVGCircleElement>(null);
  const word = useRef<HTMLParagraphElement>(null);
  const hint = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let raf = 0;
    let shown: Cue | null = null;
    let smooth = 0;
    let cue: Cue = "fill";
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const { fill, rising } = read();
      const f = Math.max(0, Math.min(1, fill));
      smooth += (f - smooth) * 0.25;
      disc.current?.setAttribute("r", (R_EMPTY + smooth * (R_FULL - R_EMPTY)).toFixed(1));
      if (f >= REACHED) cue = "full";
      else if (f <= 1 - REACHED) cue = "empty";
      else if (cue === "full" && !rising) cue = "out";
      else if (cue === "empty" && rising) cue = "fill";
      else if (cue !== "full" && cue !== "empty") cue = rising ? "fill" : "out";
      if (cue !== shown && root.current && word.current && hint.current) {
        shown = cue;
        root.current.dataset.cue = cue;
        word.current.textContent = CUES[cue].word;
        hint.current.textContent = CUES[cue].hint;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [read]);

  return (
    <div className="cal-ring" ref={root} data-cue="fill">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle cx={C} cy={C} r={R_FULL} className="cr-full" />
        <circle cx={C} cy={C} r={R_EMPTY} className="cr-empty" />
        <circle ref={disc} cx={C} cy={C} r={R_EMPTY} className="cr-disc" />
        <text x={C} y={C - R_FULL - 12} textAnchor="middle" className="cr-label">
          Full
        </text>
        <text x={C} y={C + 5} textAnchor="middle" className="cr-label cr-label-empty">
          Empty
        </text>
      </svg>
      <div className="cr-text">
        <p ref={word} className="cr-word" aria-live="polite">
          Breathe in
        </p>
        <p ref={hint} className="cr-hint">
          Fill the circle all the way
        </p>
      </div>
    </div>
  );
}
