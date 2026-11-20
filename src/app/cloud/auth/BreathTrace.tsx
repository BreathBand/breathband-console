import { useId } from "react";

// A calm, looping picture of a paced 5-5 session: the grey pacer scrolls
// past a "now" line, a dot rides it up (breathe in) and down (breathe out),
// and the breathing curve trails behind in red while rising and blue while
// falling. Pure SVG + CSS (see auth.css); prefers-reduced-motion freezes it.
// Decorative only: the page says everything it shows in words.

const P = 160; // one breath (10 s) in SVG units
const W = 480; // visible width: three breaths
const NOW = 320; // the "now" line
const MID = 92;
const AMP = 62;
const LAG = 7; // the breather trails the pacer slightly
const TAU = Math.PI * 2;

const pacerPath = (() => {
  let d = "";
  for (let x = 0; x <= W + P; x += 4) {
    const y = MID + AMP * Math.cos((TAU * x) / P);
    d += `${x ? "L" : "M"}${x} ${y.toFixed(1)}`;
  }
  return d;
})();

/** The breathing curve, split into rising (inhale) and falling (exhale) runs. Periodic in P so the loop is seamless. */
const breathPaths = (() => {
  const runs: { inhale: boolean; d: string }[] = [];
  for (let x = 0; x <= W + P; x += 2) {
    const theta = (TAU * (x - LAG)) / P;
    const depth = 0.9 + 0.05 * Math.sin((2 * TAU * x) / P + 1);
    const wobble = 1.4 * Math.sin((7 * TAU * x) / P) + 0.8 * Math.sin((11 * TAU * x) / P + 2);
    const y = MID + AMP * depth * Math.cos(theta) + wobble;
    const phase = (((theta % TAU) + TAU) % TAU) / TAU;
    const inhale = phase < 0.5;
    const point = `${x} ${y.toFixed(1)}`;
    const last = runs[runs.length - 1];
    if (!last || last.inhale !== inhale) {
      if (last) last.d += `L${point}`;
      runs.push({ inhale, d: `M${point}` });
    } else {
      last.d += `L${point}`;
    }
  }
  return {
    inhale: runs.filter((r) => r.inhale).map((r) => r.d).join(""),
    exhale: runs.filter((r) => !r.inhale).map((r) => r.d).join(""),
  };
})();

export function BreathTrace() {
  const clip = useId();
  return (
    <div className="bc-trace" aria-hidden="true">
      <div className="bc-trace-head">
        <span className="bc-trace-title">Paced 5-5</span>
        <span className="bc-trace-legend">
          <span className="bc-key" data-k="in">
            <i />▲ Inhale
          </span>
          <span className="bc-key" data-k="out">
            <i />▼ Exhale
          </span>
          <span className="bc-key" data-k="pacer">
            <i />
            Pacer
          </span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${MID * 2}`} className="bc-trace-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <clipPath id={clip}>
            <rect x="0" y="0" width={NOW} height={MID * 2} />
          </clipPath>
        </defs>
        <line className="bc-trace-mid" x1="0" x2={W} y1={MID} y2={MID} />
        <text className="bc-trace-axis" x="2" y="22">
          IN
        </text>
        <text className="bc-trace-axis" x="2" y={MID * 2 - 10}>
          OUT
        </text>
        <g className="bc-trace-scroll">
          <path className="bc-trace-pacer" d={pacerPath} />
        </g>
        <g clipPath={`url(#${clip})`}>
          <g className="bc-trace-scroll">
            <path className="bc-trace-in" d={breathPaths.inhale} />
            <path className="bc-trace-out" d={breathPaths.exhale} />
          </g>
        </g>
        <line className="bc-trace-now" x1={NOW} x2={NOW} y1="8" y2={MID * 2 - 8} />
        <circle className="bc-trace-dot" cx={NOW} cy={MID + AMP} r="7" />
      </svg>
      <div className="bc-trace-foot">
        <span className="bc-phase" data-phase="in">
          ▲ Breathe in
        </span>
        <span className="bc-phase" data-phase="out">
          ▼ Breathe out
        </span>
        <span className="bc-trace-static">5 s in · 5 s out</span>
      </div>
    </div>
  );
}
