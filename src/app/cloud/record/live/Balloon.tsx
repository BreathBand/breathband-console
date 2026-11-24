"use client";

import { useEffect, useRef } from "react";

/**
 * The calibration balloon: it fills as you breathe in and empties as you
 * breathe out, scaled to the deepest breaths seen so far, so the instruction
 * ("breathe in until the balloon is full") explains itself.
 */
export function Balloon({ read }: { read: () => { fill: number; rising: boolean } }) {
  const body = useRef<SVGGElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const { fill, rising } = read();
      const s = 0.45 + 0.55 * Math.max(0, Math.min(1, fill));
      body.current?.setAttribute("transform", `translate(120 150) scale(${s.toFixed(3)}) translate(-120 -150)`);
      if (root.current) root.current.dataset.phase = rising ? "in" : "out";
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [read]);

  return (
    <div className="balloon" ref={root} data-phase="in">
      <svg viewBox="0 0 240 300" aria-hidden="true">
        <path d="M120 152 C 116 190 128 220 118 296" className="balloon-string" />
        <g ref={body}>
          <path d="M120 10 C 60 10 28 58 28 102 C 28 148 72 142 112 150 L 106 160 L 134 160 L 128 150 C 168 142 212 148 212 102 C 212 58 180 10 120 10 Z" className="balloon-body" />
          <path d="M78 52 C 70 62 64 76 64 90" className="balloon-shine" />
        </g>
      </svg>
    </div>
  );
}
