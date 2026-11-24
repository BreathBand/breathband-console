import { Fragment } from "react";
import { formatScore, scoreWord, type Headline, type ScoreBand } from "@/lib/domain/scores";
import type { TransitionScores } from "@/lib/domain/types";

export function Dot({ band }: { band: ScoreBand }) {
  return <i className="dot" data-band={band} aria-hidden="true" />;
}

/** "7 ● Good": the number, then a colour dot and a word, so colour is never the only cue. */
export function Score({ value, compact = false }: { value: number; compact?: boolean }) {
  const { word, band } = scoreWord(value);
  return (
    <span className="score">
      <span className="score-n">{formatScore(value)}</span>
      <span className="score-w">
        <Dot band={band} />
        {compact ? <span className="sr-only">{word}</span> : word}
      </span>
    </span>
  );
}

/** The headline for a session in a list: a 1–10 score, a legacy %, or the breathing rate of an open session. */
export function HeadlineScore({ headline, compact = false }: { headline: Headline; compact?: boolean }) {
  if (headline.kind === "transition") return <Score value={headline.value} compact={compact} />;
  if (headline.kind === "legacy") {
    return (
      <span className="score" title="Recorded with the earlier 0–100% scoring">
        <span className="score-n">{headline.text}</span>
        <span className="score-w">
          <Dot band={headline.band} />
          {compact ? <span className="sr-only">legacy score</span> : "legacy"}
        </span>
      </span>
    );
  }
  return (
    <span className="score">
      <span className="score-n">{headline.text}</span>
      <span className="score-w">br/min</span>
    </span>
  );
}

/** Direction glyph: the non-colour cue for inhale (up, above the line) and exhale (down, below). */
export function Arrow({ dir, size = 10 }: { dir: "in" | "out"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true" style={{ flex: "none" }}>
      <path d={dir === "in" ? "M5 1 9.5 8.5h-9Z" : "M5 9 .5 1.5h9Z"} fill={`var(--c-${dir})`} />
    </svg>
  );
}

export function DirHead({ dir, suffix }: { dir: "in" | "out"; suffix?: string }) {
  return (
    <span className="dir">
      <Arrow dir={dir} />
      {dir === "in" ? "Inhale" : "Exhale"}
      {suffix && ` ${suffix}`}
    </span>
  );
}

/** Timing and depth for inhale and exhale; smoothness underneath when the session has it. */
export function TransitionTable({ scores }: { scores: TransitionScores }) {
  const rows: [string, TransitionScores["timing"], boolean][] = [
    ["Timing", scores.timing, false],
    ["Depth", scores.depth, false],
  ];
  if (scores.smoothness) rows.push(["Smoothness", scores.smoothness, true]);
  return (
    <table className="table sc">
      <thead>
        <tr>
          <th>
            <span className="sr-only">Score</span>
          </th>
          <th className="num">
            <DirHead dir="in" />
          </th>
          <th className="num">
            <DirHead dir="out" />
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, pair, secondary]) => (
          <tr key={label} className={secondary ? "secondary" : undefined}>
            <td>
              {label}
              {secondary && <span className="sr-only"> (not part of the total)</span>}
            </td>
            <td className="num">
              <Score value={pair.inhale} />
            </td>
            <td className="num">
              <Score value={pair.exhale} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The 10…1 scale with the session's sub-scores highlighted. */
export function ScaleStrip({ hits }: { hits: number[] }) {
  const cells = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  return (
    <Fragment>
      <div className="scale" aria-hidden="true">
        {cells.map((n) => (
          <i key={n} className={hits.includes(n) ? "hit" : undefined}>
            {n}
          </i>
        ))}
      </div>
      <div className="scale-ends label">
        <span>Within 10% of the pacer</span>
        <span>90% or more off</span>
      </div>
    </Fragment>
  );
}
