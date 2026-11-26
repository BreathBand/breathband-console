"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { SAMPLE_RATE_HZ } from "@/lib/device/config";
import { formatScore, scoreWord } from "@/lib/domain/scores";
import type { BreathGoal, MoodScore } from "@/lib/domain/types";
import type { BuiltSession } from "@/lib/recording";
import { coaching, onTargetShare, rateChange, rateWord, resultsEmphasis } from "../../results/tone";
import { MoodFaces } from "./MoodFaces";

/** "0.4 s early", "0.2 s late", "on time". */
function timingWords(s: number | undefined): string {
  if (s === undefined || Math.abs(s) < 0.05) return "on time";
  return `${Math.abs(s).toFixed(1)} s ${s < 0 ? "early" : "late"}`;
}

function meanOf(...values: (number | undefined)[]): number | undefined {
  const known = values.filter((v): v is number => v !== undefined);
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : undefined;
}

/** "1.2 % shallower", "0.8 % deeper", "on depth". */
function depthWords(pct: number | undefined): string {
  if (pct === undefined || Math.abs(pct) < 0.1) return "right on depth";
  return `${Math.abs(pct).toFixed(1)} % of max ${pct < 0 ? "shallower" : "deeper"}`;
}

/**
 * The score after Stop, with a note to save. The person's goal decides what
 * leads (results/tone.ts): Train sees every number, Focus the headline and how
 * much was on target (or the rate falling), Calm the headline, its word and
 * one tip; everyone gets one coaching line in their goal's tone. The scores
 * are the same for all of them.
 */
export function Results({
  built,
  tooShort,
  title,
  goal,
  streakDays,
  askMood = false,
  moodBefore = null,
  onSave,
  onDiscard,
  onRestart,
}: {
  built: BuiltSession | null;
  tooShort: boolean;
  title: string;
  goal: BreathGoal | null;
  /** Days in a row with a session, this one included. */
  streakDays: number;
  /** Focus with the mood check-in on (J6): ask how they feel now, and name the change in the line. */
  askMood?: boolean;
  /** The mood picked before Begin, if any. */
  moodBefore?: MoodScore | null;
  onSave: (note: string, moodAfter: MoodScore | null) => Promise<void>;
  onDiscard: () => void;
  onRestart: () => void;
}) {
  const [note, setNote] = useState("");
  const [moodAfter, setMoodAfter] = useState<MoodScore | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emphasis = resultsEmphasis(goal);
  const rates = useMemo(
    () => (built?.open && emphasis.rateChange ? rateChange(built.waveform.user, SAMPLE_RATE_HZ) : null),
    [built, emphasis.rateChange],
  );

  if (tooShort || !built) {
    return (
      <section className="inst-step">
        <h1>Too short to score</h1>
        <p>A session needs at least 20 seconds of breathing to be scored. Nothing has been saved.</p>
        <div className="inst-actions">
          <button type="button" className="button" data-size="large" onClick={onRestart}>
            Start again
          </button>
          <button type="button" className="button" data-variant="ghost" onClick={onDiscard}>
            Back to setup
          </button>
        </div>
      </section>
    );
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(note, askMood ? moodAfter : null);
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "The session couldn't be saved.");
    }
  };

  const { session, paced, open } = built;
  const total = paced?.scores.total;
  const mood = askMood ? { before: moodBefore, after: moodAfter } : null;
  const coach = coaching({ goal, session, streakDays, turns: paced?.transitions, rates, mood });
  const share = emphasis.share ? onTargetShare(session) : null;
  const rate = open?.whole.metrics?.rateBpm;

  let detail: ReactNode = null;
  if (paced) {
    detail = (
      <div className="res-detail">
        <table className="res-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Score</span>
              </th>
              <th scope="col">
                <span className="tri in" aria-hidden="true">▲</span> Inhale
              </th>
              <th scope="col">
                <span className="tri out" aria-hidden="true">▼</span> Exhale
              </th>
              <th scope="col">On target</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Timing</th>
              <td>{formatScore(paced.scores.timing.inhale)}</td>
              <td>{formatScore(paced.scores.timing.exhale)}</td>
              <td>{Math.round(paced.onTargetPct.timing)}%</td>
            </tr>
            <tr>
              <th scope="row">Depth</th>
              <td>{formatScore(paced.scores.depth.inhale)}</td>
              <td>{formatScore(paced.scores.depth.exhale)}</td>
              <td>{Math.round(paced.onTargetPct.depth)}%</td>
            </tr>
          </tbody>
        </table>
        <ul className="res-notes">
          <li>
            <Icon name="timer" size={18} />
            Breaths in turned {timingWords(paced.direction.timing.inhale?.s)}, breaths out {timingWords(paced.direction.timing.exhale?.s)}.
          </li>
          <li>
            <Icon name="lungs" size={18} />
            Your breathing was {depthWords(meanOf(paced.direction.depth.inhale?.pctOfMax, paced.direction.depth.exhale?.pctOfMax))} than the
            pacer.
          </li>
          {paced.counts.missed + paced.counts.double > 0 && (
            <li>
              <Icon name="alert" size={18} />
              {paced.counts.missed} missed and {paced.counts.double} doubled turns out of {paced.counts.pacer}.
            </li>
          )}
        </ul>
      </div>
    );
  } else if (open?.whole.metrics) {
    detail = (
      <div className="res-detail">
        <dl className="res-open">
          <div>
            <dt>Rhythm, in to out</dt>
            <dd>1 : {open.whole.metrics.ieRatio.toFixed(1)}</dd>
          </div>
          <div>
            <dt>Depth</dt>
            <dd>{open.whole.metrics.depthPct.toFixed(1)}% of max</dd>
          </div>
          <div>
            <dt>Breaths at a normal rate</dt>
            <dd>{Math.round(open.whole.metrics.normalRatePct)}%</dd>
          </div>
          <div>
            <dt>Breaths</dt>
            <dd>{open.whole.breaths}</dd>
          </div>
        </dl>
        {open.segments.length > 0 && (
          <ul className="res-notes">
            {open.segments.map((s) => (
              <li key={s.name}>
                <Icon name="marker" size={18} />
                <span>
                  <b>{s.name[0].toUpperCase() + s.name.slice(1)}</b>:{" "}
                  {s.metrics
                    ? `${Math.round(s.metrics.rateBpm)} br/min, ${s.metrics.depthPct.toFixed(1)}% deep`
                    : "too few breaths to measure"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <section className="inst-results" data-goal={goal ?? undefined} data-density={emphasis.density} aria-labelledby="res-h">
      <div className="res-score">
        <p className="res-kicker" id="res-h">
          {title} · {Math.floor(session.durationSec / 60)}:{String(session.durationSec % 60).padStart(2, "0")}
        </p>
        {total !== undefined ? (
          <>
            <p className="res-total display">
              {formatScore(total)}
              <small>/10</small>
            </p>
            <p className="res-word">
              <i className="dot" data-band={scoreWord(total).band} aria-hidden="true" />
              {scoreWord(total).word} · Total Breath Score
            </p>
          </>
        ) : (
          <>
            <p className="res-total display">
              {rate !== undefined ? Math.round(rate) : "–"}
              <small>br/min</small>
            </p>
            <p className="res-word">
              {rate === undefined
                ? "Fewer than three breaths were found"
                : emphasis.density === "full"
                  ? "Breathing rate"
                  : `Breathing rate · ${rateWord(rate)}`}
            </p>
          </>
        )}
        {share !== null && (
          <p className="res-share">
            <b className="display">{share}%</b> of the session on target
          </p>
        )}
        {emphasis.rateChange && rates && (
          <p className="res-share">
            <b className="display">
              {rates.from} → {rates.to}
            </b>{" "}
            br/min, start to end
          </p>
        )}
        {coach.line && <p className="res-line">{coach.line}</p>}
        {coach.tip && (
          <p className="res-tip">
            <Icon name="info" size={18} />
            {coach.tip}
          </p>
        )}
      </div>

      {detail &&
        (emphasis.detailsOpen ? (
          detail
        ) : (
          <details className="res-more">
            <summary>All the numbers</summary>
            {detail}
          </details>
        ))}

      <div className="res-save">
        {askMood && <MoodFaces question="And now, how do you feel?" value={moodAfter} onChange={setMoodAfter} />}
        <label className="field">
          Note <span className="muted">(optional)</span>
          <textarea
            rows={3}
            value={note}
            maxLength={2000}
            placeholder="How did it feel? Anything that got in the way?"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="inst-actions">
          <button type="button" className="button" data-size="large" onClick={save} disabled={saving} aria-busy={saving || undefined}>
            {saving ? "Saving…" : "Save session"}
          </button>
          <button type="button" className="button" data-variant="ghost" onClick={onDiscard} disabled={saving}>
            Discard
          </button>
        </div>
      </div>
    </section>
  );
}
