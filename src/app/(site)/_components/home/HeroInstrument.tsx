"use client";

import { useEffect, useRef, useState } from "react";
import {
  breather,
  breatherPaths,
  clock,
  gridPath,
  pacer,
  pacerPath,
  pacerPhase,
  type Breather,
} from "../../_lib/breath";
import { Tri } from "../ui";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";
import { useTones } from "../useTones";

// A simulated paced session, drawn the way the app's live screen draws it:
// the pacer ring, your breath inside it, and the last 20 seconds as a line.
// Nothing here is the app's signal processing; the "user" is a plausible line
// that follows the pacer a little late.
type Pace = 5 | 2;
const START = 152.6; // 2:32, 2.6 s into an inhale at 5-5
const USER: Breather = { lag: 0.45, amp: 0.93, seed: 1.7 };

// Ring geometry (viewBox -200 -200 400 400)
const R_OUT = 64; // all the way out
const R_IN = 150; // all the way in
const R_TRACK = 178;
const R_TICK = 194;
const CIRC = 2 * Math.PI * R_TRACK;

// Line view (viewBox 0 0 1000 220)
const LW = 1000;
const LH = 220;
const WINDOW = 20;
const NOW = 0.72;
const LINE = { x0: 0, x1: LW, yMid: LH / 2, yAmp: LH / 2 - 18 };

const r1 = (n: number) => Math.round(n * 10) / 10;
const radius = (v: number) => r1(R_OUT + ((R_IN - R_OUT) * (Math.max(-1, Math.min(1, v)) + 1)) / 2);

function frame(t: number, half: Pace) {
  const period = half * 2;
  const p = pacerPhase(t, half);
  const u = breather(t, half, half === 2 ? { ...USER, lag: 0.25 } : USER);
  const into = ((t % period) + period) % period;
  const t0 = t - WINDOW * NOW;
  const t1 = t0 + WINDOW;
  const paths = breatherPaths(t0, t, t0, t1, half, half === 2 ? { ...USER, lag: 0.25 } : USER, LINE, 0.08);
  return {
    pacerR: radius(pacer(t, half)),
    userR: radius(u.y),
    userIn: u.inhale,
    inhale: p.inhale,
    remaining: Math.ceil(p.remaining),
    arcIn: p.inhale ? r1((p.progress * CIRC) / 2) : r1(CIRC / 2),
    arcOut: p.inhale ? 0 : r1((p.progress * CIRC) / 2),
    angle: r1((into / period) * 360),
    grid: gridPath(t0, t1, 1, LINE, 0, LH),
    major: gridPath(t0, t1, 5, LINE, 0, LH),
    pacerLine: pacerPath(t0, t1, half, LINE, 0.08),
    lineIn: paths.inhale,
    lineOut: paths.exhale,
    dotY: Math.round(((LINE.yMid - u.y * LINE.yAmp) / LH) * 10000) / 100, // % of the plot height
  };
}

const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2;
  const major = i % 15 === 0;
  const r0 = R_TICK;
  const r = r0 - (major ? 12 : 6);
  return {
    d: `M${r1(r0 * Math.sin(a))} ${r1(-r0 * Math.cos(a))}L${r1(r * Math.sin(a))} ${r1(-r * Math.cos(a))}`,
    major,
  };
});

/**
 * The hero: a live paced session on an instrument panel. It runs on its own
 * (a timed loop with a pause button), stops off screen and in a hidden tab,
 * and starts paused when the visitor prefers reduced motion. The visitor can
 * switch the pace (5-5 or 2-2) and turn on the app's auditory pacer: a high
 * note at the top of each breath, a low one at the bottom.
 */
export function HeroInstrument() {
  const reduced = usePrefersReducedMotion();
  const [choice, setChoice] = useState<boolean | null>(null); // the visitor's play/pause choice
  const [pace, setPace] = useState<Pace>(5);
  const [notes, setNotes] = useState(false);
  const [visible, setVisible] = useState(true);
  const [docVisible, setDocVisible] = useState(true);
  const [phase, setPhase] = useState({ inhale: true, userIn: true });
  const playing = choice ?? !reduced;
  const running = playing && visible && docVisible;

  const tones = useTones();
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const rootRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(START);
  const clockRef = useRef<HTMLElement>(null);
  const arcInRef = useRef<SVGCircleElement>(null);
  const arcOutRef = useRef<SVGCircleElement>(null);
  const userRef = useRef<SVGCircleElement>(null);
  const pacerRef = useRef<SVGCircleElement>(null);
  const markerRef = useRef<SVGGElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const gridRef = useRef<SVGPathElement>(null);
  const majorRef = useRef<SVGPathElement>(null);
  const pacerLineRef = useRef<SVGPathElement>(null);
  const lineInRef = useRef<SVGPathElement>(null);
  const lineOutRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(node);
    const onVis = () => setDocVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Draws one frame straight to the DOM; returns it so the loop can compare.
  function draw(t: number, half: Pace) {
    const f = frame(t, half);
    pacerRef.current?.setAttribute("r", String(f.pacerR));
    userRef.current?.setAttribute("r", String(f.userR));
    arcInRef.current?.setAttribute("stroke-dasharray", `${f.arcIn} ${CIRC}`);
    arcOutRef.current?.setAttribute("stroke-dasharray", `${f.arcOut} ${CIRC}`);
    markerRef.current?.setAttribute("transform", `rotate(${f.angle})`);
    gridRef.current?.setAttribute("d", f.grid);
    majorRef.current?.setAttribute("d", f.major);
    pacerLineRef.current?.setAttribute("d", f.pacerLine);
    lineInRef.current?.setAttribute("d", f.lineIn);
    lineOutRef.current?.setAttribute("d", f.lineOut);
    if (dotRef.current) dotRef.current.style.top = `${f.dotY}%`;
    if (countRef.current) countRef.current.textContent = `${f.remaining} s`;
    if (clockRef.current) clockRef.current.textContent = clock(t);
    return f;
  }

  // A new pace redraws the current frame at once, running or paused.
  useEffect(() => {
    const f = draw(tRef.current, pace);
    setPhase({ inhale: f.inhale, userIn: f.userIn });
  }, [pace]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let prev = frame(tRef.current, pace);
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tRef.current += dt;
      const f = draw(tRef.current, pace);
      if (f.inhale !== prev.inhale || f.userIn !== prev.userIn) {
        // Top of the breath (in -> out) plays the high note, the bottom the low one.
        if (f.inhale !== prev.inhale && notesRef.current) tones.play(!f.inhale);
        setPhase({ inhale: f.inhale, userIn: f.userIn });
      }
      prev = f;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // tones and draw only read refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, pace]);

  // First paint comes from React; later frames are written to the DOM. These
  // values never change between renders, so React leaves the attributes alone.
  const f0 = frame(START, 5);

  function toggleNotes() {
    const next = !notes;
    if (next) tones.unlock();
    setNotes(next);
  }

  return (
    <div
      ref={rootRef}
      className="h-inst"
      data-phase={phase.inhale ? "in" : "out"}
      data-user={phase.userIn ? "in" : "out"}
    >
      <div className="h-inst-head">
        <div>
          <p className="h-inst-title">Paced {`${pace}-${pace}`}</p>
          <p className="h-inst-sub">Simulated session</p>
        </div>
        <p className="h-inst-clock">
          <span>Elapsed</span>
          <b ref={clockRef}>{clock(START)}</b>
        </p>
      </div>

      <div className="h-ring">
        <span className="h-ring-lb h-ring-lb-out">
          <Tri up={false} /> Out {pace} s
        </span>
        <span className="h-ring-lb h-ring-lb-in">
          In {pace} s <Tri up />
        </span>
        <svg
          viewBox="-200 -200 400 400"
          className="h-ring-svg"
          role="img"
          aria-label={`A simulated Paced ${pace}-${pace} session. The pacer ring grows for ${pace} seconds as you breathe in and shrinks for ${pace} seconds as you breathe out. Your breath is the filled circle inside it, red while breathing in and blue while breathing out, a little behind the pacer.`}
        >
          {TICKS.map((tk, i) => (
            <path key={i} d={tk.d} className={tk.major ? "h-tick h-tick-maj" : "h-tick"} />
          ))}
          <path d={`M0 ${-R_TRACK}A${R_TRACK} ${R_TRACK} 0 0 1 0 ${R_TRACK}`} className="h-track h-track-in" />
          <path d={`M0 ${R_TRACK}A${R_TRACK} ${R_TRACK} 0 0 1 0 ${-R_TRACK}`} className="h-track h-track-out" />
          <circle
            ref={arcInRef}
            r={R_TRACK}
            transform="rotate(-90)"
            className="h-arc h-arc-in"
            strokeDasharray={`${f0.arcIn} ${CIRC}`}
          />
          <circle
            ref={arcOutRef}
            r={R_TRACK}
            transform="rotate(90)"
            className="h-arc h-arc-out"
            strokeDasharray={`${f0.arcOut} ${CIRC}`}
          />
          <circle r={R_IN} className="h-guide" />
          <circle r={R_OUT} className="h-guide" />
          <circle ref={userRef} r={f0.userR} className="h-breath" />
          <circle ref={pacerRef} r={f0.pacerR} className="h-pacer" />
          <g ref={markerRef} transform={`rotate(${f0.angle})`}>
            <circle cy={-R_TRACK} r={7} className="h-marker" />
          </g>
        </svg>
      </div>

      <p className="h-cue" aria-hidden="true">
        <span className="h-cue-arrow">
          <Tri up={phase.inhale} size={14} />
        </span>
        <span className="h-cue-word">{phase.inhale ? "Breathe in" : "Breathe out"}</span>
        <span className="h-cue-n" ref={countRef}>
          {f0.remaining} s
        </span>
      </p>

      <div className="h-line">
        <div className="h-line-y" aria-hidden="true">
          <span className="h-line-in">IN</span>
          <span className="h-line-out">OUT</span>
        </div>
        <div className="h-line-plot">
          <svg viewBox={`0 0 ${LW} ${LH}`} preserveAspectRatio="none" className="h-line-svg" aria-hidden="true">
            <path ref={gridRef} d={f0.grid} className="h-gf" />
            <path ref={majorRef} d={f0.major} className="h-gm" />
            <path d={`M0 ${LH / 2}H${LW}`} className="h-mid" />
            <path ref={pacerLineRef} d={f0.pacerLine} className="h-pc" />
            <path ref={lineInRef} d={f0.lineIn} className="h-li" />
            <path ref={lineOutRef} d={f0.lineOut} className="h-lo" />
            <path d={`M${LW * NOW} 0V${LH}`} className="h-nowline" />
          </svg>
          <span ref={dotRef} className="h-line-dot" style={{ left: `${NOW * 100}%`, top: `${f0.dotY}%` }} />
        </div>
      </div>

      <ul className="h-legend" aria-label="Key">
        <li>
          <i className="h-k h-k-pc" aria-hidden="true" />
          Pacer
        </li>
        <li>
          <i className="h-k h-k-in" aria-hidden="true" />
          Breathing in
        </li>
        <li>
          <i className="h-k h-k-out" aria-hidden="true" />
          Breathing out
        </li>
      </ul>

      <div className="h-inst-ctrl">
        <div className="h-pace" role="group" aria-label="Pace">
          {([5, 2] as const).map((p) => (
            <button
              key={p}
              type="button"
              className="h-ctl h-pace-opt"
              aria-pressed={pace === p}
              onClick={() => setPace(p)}
            >
              {p}-{p}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="h-ctl"
          aria-pressed={notes}
          onClick={toggleNotes}
          title="A high note at the top of each breath, a low note at the bottom"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              d="M6 12.2V3.6l7-1.6v8.4M6 12.2a1.9 1.9 0 1 1-1.9-1.9A1.9 1.9 0 0 1 6 12.2Zm7-1.8a1.9 1.9 0 1 1-1.9-1.9 1.9 1.9 0 0 1 1.9 1.9Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
          Hear the pacer
        </button>
        <button
          type="button"
          className="h-ctl h-ctl-icon"
          onClick={() => setChoice(!playing)}
          aria-label={playing ? "Pause the breathing animation" : "Play the breathing animation"}
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
