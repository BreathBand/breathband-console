"use client";

import { Fragment } from "react";
import { Arrow, Dot } from "@/components/Score";
import { FIXED_CONSTANTS, OPEN_CONSTANTS } from "@/lib/analysis/config";
import type { PacedResult } from "@/lib/analysis/paced";
import { formatDay, formatDuration } from "@/lib/domain/format";
import { formatScore, isTransitionScores, scoreWord } from "@/lib/domain/scores";
import type { OpenSpanMetrics, SessionSummary, TransitionScores } from "@/lib/domain/types";
import type { BreathDeviation } from "@/lib/domain/waveform";

const SKILL_WORDS = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", expert: "Expert" } as const;

function signedS(v: number | null | undefined): string {
  if (v === null || v === undefined) return "–";
  if (Math.abs(v) < 0.05) return "0 s";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} s`;
}

function signedPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "–";
  if (Math.abs(v) < 0.05) return "0%";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
}

/** "early by 0.3 s", "late by 0.2 s" or "on time", from a mean deviation in SD and the session's SD. */
function timingSentence(sd: number | null, sdTimeS: number): string {
  if (sd === null) return "not measured";
  const s = sd * sdTimeS;
  if (Math.abs(s) < 0.05) return "on time";
  return `${s < 0 ? "early" : "late"} by ${Math.abs(s).toFixed(1)} s`;
}

function depthSentence(sd: number | null): string {
  if (sd === null) return "not measured";
  const pct = sd * FIXED_CONSTANTS.depthSdPctOfMax;
  if (Math.abs(pct) < 0.1) return "right on the pacer";
  return `${Math.abs(pct).toFixed(1)}% of max ${pct > 0 ? "deeper" : "shallower"}`;
}

/** The previous session with a 1–10 total, for "+0.4 vs Mon, Nov 23". */
function previousTotal(session: SessionSummary, sessions: SessionSummary[]) {
  const index = sessions.findIndex((s) => s.id === session.id);
  return sessions.slice(index + 1).find((s) => isTransitionScores(s.scores));
}

/**
 * Method C's result for a paced session (Appendix, "Paced sessions"): the
 * Total Breath Score, timing and depth for the inhale and the exhale, how much
 * of the session was on target, which way the breathing leaned, and the
 * deviation histogram.
 */
export function MethodCScores({ session, sessions, scores }: { session: SessionSummary; sessions: SessionSummary[]; scores: TransitionScores }) {
  const details = session.paced;
  const { word, band } = scoreWord(scores.total);
  const prev = previousTotal(session, sessions);
  const delta = prev && isTransitionScores(prev.scores) ? Math.round((scores.total - prev.scores.total) * 10) / 10 : null;
  const half = session.pacerHalfCycleSec ?? 5;
  const sdTime = FIXED_CONSTANTS.timingSdBreathFraction * 2 * half;
  const skill = session.skillLevel ?? "intermediate";
  const k = OPEN_CONSTANTS.skillBandK[skill];

  return (
    <div className="mc">
      <section className="pane mc-hero" aria-label="Total Breath Score">
        <span className="lbl">Total Breath Score</span>
        <span className="mc-total display">
          {formatScore(scores.total)}
          <small>/10</small>
        </span>
        <span className="w">
          <Dot band={band} />
          {word}
        </span>
        <span className="d">
          {delta === null
            ? "First scored session"
            : `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${formatScore(Math.abs(delta))} vs ${formatDay(prev!.startedAt, undefined, false)}`}
        </span>
      </section>

      <section className="pane pane-pad mc-break" aria-label="Timing and depth">
        <table className="mc-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Measure</span>
              </th>
              <th scope="col">
                <Arrow dir="in" /> Inhale
              </th>
              <th scope="col">
                <Arrow dir="out" /> Exhale
              </th>
              <th scope="col">On target</th>
            </tr>
          </thead>
          <tbody>
            {(["timing", "depth"] as const).map((m) => (
              <tr key={m}>
                <th scope="row">{m === "timing" ? "Timing" : "Depth"}</th>
                {(["inhale", "exhale"] as const).map((p) => (
                  <td key={p}>
                    <span className="mc-n">{formatScore(scores[m][p])}</span>
                    <Dot band={scoreWord(scores[m][p]).band} />
                  </td>
                ))}
                <td>
                  {details ? (
                    <span className="mc-pct">
                      <span className="mc-bar" aria-hidden="true">
                        <i style={{ width: `${details.onTargetPct[m]}%` }} />
                      </span>
                      {Math.round(details.onTargetPct[m])}%
                    </span>
                  ) : (
                    "–"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {details && (
          <ul className="mc-lean">
            <li>
              <b>Timing:</b> breaths in {timingSentence(details.direction.timing.inhale, sdTime)}, breaths out{" "}
              {timingSentence(details.direction.timing.exhale, sdTime)}.
            </li>
            <li>
              <b>Depth:</b> breaths in {depthSentence(details.direction.depth.inhale)}, breaths out {depthSentence(details.direction.depth.exhale)}.
            </li>
            {details.missed + details.double > 0 && (
              <li>
                <b>Missed turns:</b> {details.missed} missed and {details.double} doubled of {details.transitions}, each scored 1.
              </li>
            )}
          </ul>
        )}
      </section>

      {details && (
        <section className="pane pane-pad mc-hist" aria-labelledby="hist-h">
          <div className="pane-h">
            <h2 id="hist-h">How close you were</h2>
            <span className="meta">
              {SKILL_WORDS[skill]} · on target within ±{k} SD
            </span>
          </div>
          <Histogram label="Timing" words={["early", "late"]} bins={details.histogram.timing} k={k} />
          <Histogram label="Depth" words={["shallower", "deeper"]} bins={details.histogram.depth} k={k} />
          <p className="rules">
            Every turn of the pacer is matched to yours. Timing is measured in steps of half a breath ({sdTime} s here), depth in
            steps of {FIXED_CONSTANTS.depthSdPctOfMax}% of your maximum. The closer, the more points, up to <b>10</b>; a turn
            you missed or doubled scores <b>1</b>
            {details.histogram.missedOrDouble > 0 ? ` (${details.histogram.missedOrDouble} this session)` : ""}.
          </p>
        </section>
      )}
    </div>
  );
}

/** One row of the deviation histogram: −1 to +1 SD in quarter steps, the on-target band shaded. */
function Histogram({ label, words, bins, k }: { label: string; words: [string, string]; bins: number[]; k: number }) {
  const { minSd, stepSd } = FIXED_CONSTANTS.deviationHistogram;
  const max = Math.max(1, ...bins);
  const total = bins.reduce((a, b) => a + b, 0);
  return (
    <figure className="hist">
      <figcaption>
        <b>{label}</b>
        <span>
          ← {words[0]} · {words[1]} →
        </span>
      </figcaption>
      <div className="hist-bars" role="img" aria-label={`${label}: ${bins.map((n, i) => `${n} between ${(minSd + i * stepSd).toFixed(2)} and ${(minSd + (i + 1) * stepSd).toFixed(2)} SD`).join(", ")}`}>
        {bins.map((n, i) => {
          const from = minSd + i * stepSd;
          const on = from >= -k - 1e-9 && from + stepSd <= k + 1e-9;
          return (
            <span key={i} className="hist-col" data-on={on || undefined}>
              <i style={{ height: `${(n / max) * 100}%` }} />
              <small>{n || ""}</small>
            </span>
          );
        })}
      </div>
      <div className="hist-axis" aria-hidden="true">
        <span>−1</span>
        <span>0</span>
        <span>+1 SD</span>
      </div>
      <span className="sr-only">{total} turns matched</span>
    </figure>
  );
}

/** Per-turn method-C detail as breath rows the deviation strip understands (depth in % of max). */
export function turnsAsBreaths(result: PacedResult): BreathDeviation[] {
  const out: BreathDeviation[] = [];
  const t = result.transitions;
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i].type !== "peak" || t[i + 1].type !== "trough") continue;
    out.push({
      n: out.length + 1,
      tPeak: t[i].pacer.t,
      tTrough: t[i + 1].pacer.t,
      inLag: t[i].deltaTimeS === null ? 0 : Math.round(t[i].deltaTimeS! * 10) / 10,
      outLag: t[i + 1].deltaTimeS === null ? 0 : Math.round(t[i + 1].deltaTimeS! * 10) / 10,
      inDepth: t[i].deltaDepthPct === null ? 0 : Math.round(t[i].deltaDepthPct! * 10) / 10,
      outDepth: t[i + 1].deltaDepthPct === null ? 0 : Math.round(t[i + 1].deltaDepthPct! * 10) / 10,
    });
  }
  return out;
}

/** Every pacer turn in the window: when it came, how far off you were, and the points. */
export function TurnTable({ result, t0, t1 }: { result: PacedResult; t0: number; t1: number }) {
  const rows = result.transitions.filter((e) => e.pacer.t >= t0 && e.pacer.t <= t1);
  if (rows.length === 0) return <p className="muted">No pacer turns in this part of the session.</p>;
  return (
    <div className="bt-scroll" tabIndex={0} role="region" aria-label="Each turn of the pacer">
      <table className="table bt">
        <thead>
          <tr>
            <th>Turn</th>
            <th>At</th>
            <th className="num">Timing</th>
            <th className="num">Depth</th>
            <th className="num">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.pacer.k} data-missed={e.missed || e.double || undefined}>
              <td>
                <Arrow dir={e.phase === "inhale" ? "in" : "out"} /> {e.phase === "inhale" ? "Top of in" : "Bottom of out"}
              </td>
              <td className="sub">{formatDuration(e.pacer.t)}</td>
              {e.missed || e.double ? (
                <td className="num sub" colSpan={2}>
                  {e.missed ? "Missed" : "Doubled"}
                </td>
              ) : (
                <>
                  <td className="num">{signedS(e.deltaTimeS)}</td>
                  <td className="num">{signedPct(e.deltaDepthPct)}</td>
                </>
              )}
              <td className="num">
                {e.timingPoints} · {e.depthPoints}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SEGMENT_WORDS = { before: "Before", between: "Between", after: "After" } as const;

/** The Appendix metrics for an open session, with the marker segments side by side. */
export function OpenScores({ session }: { session: SessionSummary }) {
  const open = session.open!;
  const m = open.whole;
  const rateOk = m ? m.rateBpm >= FIXED_CONSTANTS.normalRateBpm.min && m.rateBpm <= FIXED_CONSTANTS.normalRateBpm.max : false;
  return (
    <div className="mc mc-open">
      <section className="pane mc-hero" aria-label="Breathing rate">
        <span className="lbl">Breathing rate</span>
        <span className="mc-total display">
          {m ? formatScore(m.rateBpm) : "–"}
          <small>br/min</small>
        </span>
        <span className="w">
          {m ? (
            <>
              <Dot band={rateOk ? "ok" : "low"} />
              {rateOk ? "In the normal range" : m.rateBpm > FIXED_CONSTANTS.normalRateBpm.max ? "Faster than normal" : "Slower than normal"}
            </>
          ) : (
            "Fewer than three breaths"
          )}
        </span>
        <span className="d">
          Normal at rest: {FIXED_CONSTANTS.normalRateBpm.min}–{FIXED_CONSTANTS.normalRateBpm.max} · {open.breaths} breaths
        </span>
      </section>
      <section className="pane pane-pad mc-metrics" aria-label="Breathing metrics">
        {m ? <MetricGrid m={m} /> : <p className="muted">Too few breaths to measure rhythm and depth.</p>}
      </section>
      {open.segments.length > 0 && (
        <section className="pane pane-pad mc-segs" aria-labelledby="segs-h">
          <div className="pane-h">
            <h2 id="segs-h">Around your markers</h2>
            <span className="meta">{open.segments.length === 2 ? "Before and after" : "Before, between and after"}</span>
          </div>
          <div className="table-scroll">
            <table className="table segs">
              <thead>
                <tr>
                  <th>Part</th>
                  <th className="num">Rate</th>
                  <th className="num">In : out</th>
                  <th className="num">Depth</th>
                  <th className="num">Normal rate</th>
                  <th className="num">Breaths</th>
                </tr>
              </thead>
              <tbody>
                {open.segments.map((s) => (
                  <tr key={s.name}>
                    <td>
                      <b>{SEGMENT_WORDS[s.name]}</b>{" "}
                      <span className="muted">
                        {formatDuration(s.fromS)}–{formatDuration(s.toS)}
                      </span>
                    </td>
                    {s.metrics ? (
                      <Fragment>
                        <td className="num">{formatScore(s.metrics.rateBpm)}</td>
                        <td className="num">1 : {s.metrics.ieRatio.toFixed(1)}</td>
                        <td className="num">{s.metrics.depthPct.toFixed(1)}%</td>
                        <td className="num">{Math.round(s.metrics.normalRatePct)}%</td>
                      </Fragment>
                    ) : (
                      <td className="num sub" colSpan={4}>
                        Too few breaths
                      </td>
                    )}
                    <td className="num">{s.breaths}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function MetricGrid({ m }: { m: OpenSpanMetrics }) {
  const items: { label: string; value: string; note?: string }[] = [
    { label: "In : out", value: `1 : ${m.ieRatio.toFixed(1)}`, note: "1 : 2 is typical" },
    { label: "Inhale", value: `${m.inhaleS.toFixed(1)} s` },
    { label: "Exhale", value: `${m.exhaleS.toFixed(1)} s` },
    { label: "Depth", value: `${m.depthPct.toFixed(1)}%`, note: "of your max" },
    { label: "Inhale depth", value: `${m.inhaleDepthPct.toFixed(1)}%` },
    { label: "Exhale depth", value: `${m.exhaleDepthPct.toFixed(1)}%` },
    { label: "Depth index", value: `${Math.round(m.depthIndex)}`, note: "100 = normal depth" },
    { label: "Normal rate", value: `${Math.round(m.normalRatePct)}%`, note: "of breaths" },
    { label: "Normal depth", value: `${Math.round(m.normalDepthPct)}%`, note: "of breaths" },
  ];
  return (
    <dl className="metric-grid">
      {items.map((i) => (
        <div key={i.label}>
          <dt>{i.label}</dt>
          <dd>
            {i.value}
            {i.note && <small>{i.note}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
