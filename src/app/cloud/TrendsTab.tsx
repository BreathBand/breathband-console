"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { Measured } from "@/components/Measured";
import { CompareChart, PeriodBars, SeriesKey, TimeTrend } from "@/components/trendCharts";
import { useBackend } from "@/lib/backend/BackendProvider";
import { describeMode, formatDay } from "@/lib/domain/format";
import { formatScore, isTransitionScores } from "@/lib/domain/scores";
import { buckets, inPeriod, RANGES, summarize, type RangeDays } from "@/lib/domain/trends";
import { DEFAULT_TARGETS, type AthleteTargets } from "@/lib/domain/types";
import type { Workspace } from "./AthleteWorkspace";

const DAY_MS = 86_400_000;
const mean = (v: number[]) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null);

/**
 * Trends over a chosen period against the coach's targets, with a plain-words
 * summary on top. Coaches set the targets here; athletes see them.
 */
export function TrendsTab({ ws }: { ws: Workspace }) {
  const [days, setDays] = useState<RangeDays>(30);
  const targets = ws.targets;

  const now = ws.now;
  const t1 = now.getTime();
  const t0 = t1 - days * DAY_MS;
  const sessions = inPeriod(ws.sessions, now, days);
  const { current, previous, sentences } = summarize(ws.sessions, now, days, targets);
  const scored = sessions.filter((s) => isTransitionScores(s.scores));
  const open = sessions.filter((s) => s.mode === "open" && s.respirationRateBpm !== null);
  const bins = buckets(ws.sessions, now, days);
  const weekly = days > 31;
  // Sub-scores per week from a month up, so the lines aren't mostly gaps.
  const partBins = days >= 30 ? buckets(ws.sessions, now, days, "week") : bins;

  const scorePoints = scored.map((s) => {
    const total = isTransitionScores(s.scores) ? s.scores.total : 0;
    return {
      t: Date.parse(s.startedAt),
      v: total,
      label: `${formatDay(s.startedAt)} · ${describeMode(s)}`,
      out: total < targets.score,
      href: ws.sessionHref(s.id),
    };
  });
  const lowest = Math.min(targets.score, ...scorePoints.map((p) => p.v));
  const scoreMin = Math.max(0, Math.floor(lowest - 1));
  const ratePoints = open.map((s) => ({
    t: Date.parse(s.startedAt),
    v: s.respirationRateBpm!,
    label: `${formatDay(s.startedAt)} · Open`,
    out: s.respirationRateBpm! < targets.rateLow || s.respirationRateBpm! > targets.rateHigh,
    href: ws.sessionHref(s.id),
  }));
  const rateMax = Math.max(20, targets.rateHigh + 4, ...ratePoints.map((p) => p.v + 2));
  const parts = [
    { id: "timing", name: "Timing", slot: 1 },
    { id: "depth", name: "Depth", slot: 3 },
  ];
  const partSeries = parts.map((p) => ({
    ...p,
    values: partBins.map((b) =>
      mean(
        b.sessions.flatMap((s) =>
          isTransitionScores(s.scores) ? [(s.scores[p.id as "timing" | "depth"].inhale + s.scores[p.id as "timing" | "depth"].exhale) / 2] : [],
        ),
      ),
    ),
  }));
  const delta = (a: number | null, b: number | null) =>
    a === null || b === null ? "" : ` · ${a - b >= 0 ? "+" : "−"}${formatScore(Math.abs(Math.round((a - b) * 10) / 10))} on the period before`;

  return (
    <div className="review">
      <div className="toolbar trends-bar">
        <div className="seg" role="group" aria-label="Period">
          {RANGES.map((r) => (
            <button key={r.days} type="button" aria-pressed={days === r.days} onClick={() => setDays(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
        <span className="label">
          {formatDay(new Date(t0).toISOString())} – {formatDay(now.toISOString())}
        </span>
        <Link className="button toolbar-end" data-variant="ghost" data-size="small" href={reportHref(ws, days)}>
          <Icon name="print" size={16} />
          Progress report
        </Link>
      </div>

      <div className="trends-top">
        <section className="pane pane-pad summary" aria-labelledby="summary-h">
          <div className="pane-h">
            <h2 id="summary-h">Summary</h2>
            <span className="meta">Written from the sessions in this period</span>
          </div>
          <ul className="summary-lines">
            {sentences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="mini-stats">
            <div>
              <span className="lbl">Sessions</span>
              <b>{current.count}</b>
              <span className="d">
                {current.count - previous.count >= 0 ? "+" : "−"}
                {Math.abs(current.count - previous.count)} on the period before
              </span>
            </div>
            <div>
              <span className="lbl">Average score</span>
              <b>{current.average === null ? "–" : formatScore(current.average)}</b>
              <span className="d">{delta(current.average, previous.average).replace(" · ", "") || "Total Breath Score"}</span>
            </div>
            <div>
              <span className="lbl">On target</span>
              <b>
                {current.onTarget}
                <small> of {current.scoredCount}</small>
              </b>
              <span className="d">scored at {formatScore(targets.score)} or more</span>
            </div>
            <div>
              <span className="lbl">Breathing rate</span>
              <b>{current.rateAverage === null ? "–" : formatScore(current.rateAverage)}</b>
              <span className="d">br/min in open sessions</span>
            </div>
          </div>
        </section>
        <Targets ws={ws} targets={targets} coachName={ws.coachName} />
      </div>

      <div className="trend-grid">
        <section className="pane pane-pad" aria-labelledby="t-score-h">
          <div className="pane-h">
            <h2 id="t-score-h">Total Breath Score</h2>
            <span className="meta">
              Each paced session · <i className="key-diamond" aria-hidden="true" /> under the target
            </span>
          </div>
          <Measured height={200}>
            {(width) => (
              <TimeTrend
                width={width}
                height={200}
                points={scorePoints}
                t0={t0}
                t1={t1}
                yMin={scoreMin}
                yMax={10}
                yTicks={[2, 4, 6, 8, 10].filter((v) => v >= scoreMin)}
                line={{ v: targets.score, label: `Target ${formatScore(targets.score)}` }}
                format={formatScore}
                ariaLabel={`Total Breath Score for ${scorePoints.length} paced sessions, target ${targets.score}`}
              />
            )}
          </Measured>
        </section>

        <section className="pane pane-pad" aria-labelledby="t-parts-h">
          <div className="pane-h">
            <h2 id="t-parts-h">Timing and depth</h2>
            <span className="meta">{days >= 30 ? "Weekly" : "Daily"} average, inhale and exhale together</span>
          </div>
          <SeriesKey series={parts} />
          <Measured height={200}>
            {(width) => (
              <CompareChart
                width={width}
                height={200}
                series={partSeries}
                starts={partBins.map((b) => b.start)}
                periodWord={days >= 30 ? "Week of" : ""}
                connectGaps
                yMin={scoreMin}
                yMax={10}
                yTicks={[2, 4, 6, 8, 10].filter((v) => v >= scoreMin)}
                format={formatScore}
                ariaLabel="Average timing and depth scores over the period"
              />
            )}
          </Measured>
        </section>

        <section className="pane pane-pad" aria-labelledby="t-rate-h">
          <div className="pane-h">
            <h2 id="t-rate-h">Breathing rate</h2>
            <span className="meta">
              Each open session · shaded {targets.rateLow}–{targets.rateHigh} br/min target
            </span>
          </div>
          <Measured height={200}>
            {(width) => (
              <TimeTrend
                width={width}
                height={200}
                points={ratePoints}
                t0={t0}
                t1={t1}
                yMin={0}
                yMax={Math.ceil(rateMax / 4) * 4}
                yTicks={[0, 8, 16, 24, 32].filter((v) => v <= rateMax)}
                band={{ lo: targets.rateLow, hi: targets.rateHigh, label: `${targets.rateLow}–${targets.rateHigh}` }}
                format={(v) => `${v} br/min`}
                ariaLabel={`Breathing rate for ${ratePoints.length} open sessions, target ${targets.rateLow} to ${targets.rateHigh}`}
              />
            )}
          </Measured>
        </section>

        <section className="pane pane-pad" aria-labelledby="t-count-h">
          <div className="pane-h">
            <h2 id="t-count-h">Sessions {weekly ? "per week" : "per day"}</h2>
            <span className="meta">{weekly ? `Target ${targets.sessionsPerWeek} a week` : `${current.minutes} minutes in all`}</span>
          </div>
          <Measured height={200}>
            {(width) => (
              <PeriodBars
                width={width}
                height={200}
                bars={bins.map((b) => ({
                  start: b.start,
                  end: b.end,
                  value: b.sessions.length,
                  label: `${weekly ? "Week of " : ""}${formatDay(new Date(b.start).toISOString())} · ${Math.round(b.sessions.reduce((n, s) => n + s.durationSec, 0) / 60)} min`,
                }))}
                target={weekly ? { v: targets.sessionsPerWeek, label: `Target ${targets.sessionsPerWeek}` } : undefined}
                unit="sessions"
                ariaLabel={`Sessions ${weekly ? "per week" : "per day"} over the period`}
              />
            )}
          </Measured>
        </section>
      </div>
      <p className="label">
        Hover a point for details; click one to open that session. The same sessions are listed on the{" "}
        <Link href={ws.tabHref("sessions")}>Sessions</Link> tab.
      </p>
    </div>
  );
}

export function reportHref(ws: Pick<Workspace, "self" | "athleteId">, days: number): string {
  return ws.self ? `/cloud/report/?days=${days}` : `/cloud/report/?athlete=${encodeURIComponent(ws.athleteId)}&days=${days}`;
}

/** The coach's targets for this athlete: editable by the coach, shown to the athlete. */
function Targets({ ws, targets, coachName }: { ws: Workspace; targets: AthleteTargets; coachName?: string }) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="pane pane-pad targets" aria-labelledby="targets-h">
      <div className="pane-h">
        <h2 id="targets-h">Targets</h2>
        {!ws.self && !editing && (
          <button type="button" className="link small" onClick={() => setEditing(true)}>
            <Icon name="pencil" size={14} />
            Change
          </button>
        )}
      </div>
      {editing ? (
        <TargetsForm ws={ws} targets={targets} onDone={() => setEditing(false)} />
      ) : (
        <>
          <dl className="facts">
            <dt>Total Breath Score</dt>
            <dd>{formatScore(targets.score)} or more</dd>
            <dt>Breathing rate</dt>
            <dd>
              {targets.rateLow}–{targets.rateHigh} br/min in open sessions
            </dd>
            <dt>Sessions</dt>
            <dd>{targets.sessionsPerWeek} a week</dd>
          </dl>
          <p className="label">
            {ws.self
              ? coachName
                ? `Set by ${coachName}. Charts mark sessions outside them.`
                : "The usual starting targets. A coach can set yours."
              : `${ws.name.split(" ")[0]} sees these too. Sessions outside them are marked on the charts and can raise a flag.`}
          </p>
        </>
      )}
    </section>
  );
}

function TargetsForm({ ws, targets, onDone }: { ws: Workspace; targets: AthleteTargets; onDone: () => void }) {
  const backend = useBackend();
  const [t, setT] = useState(targets);
  const [status, setStatus] = useState<{ busy: boolean; error: string }>({ busy: false, error: "" });
  const num = (key: keyof AthleteTargets) => (e: { target: { value: string } }) => setT({ ...t, [key]: Number(e.target.value) });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus({ busy: true, error: "" });
    try {
      await backend.data.setTargets(ws.viewerId, ws.athleteId, t);
      ws.reload();
      onDone();
    } catch {
      setStatus({ busy: false, error: "Check the numbers: a score from 1 to 10, a rate range low to high, 1–21 sessions." });
    }
  }

  return (
    <form className="targets-form" onSubmit={submit}>
      <label className="field">
        Score target
        <input type="number" min={1} max={10} step={0.5} required value={t.score} onChange={num("score")} />
      </label>
      <label className="field">
        Rate from
        <input type="number" min={4} max={39} step={1} required value={t.rateLow} onChange={num("rateLow")} />
      </label>
      <label className="field">
        Rate to
        <input type="number" min={5} max={40} step={1} required value={t.rateHigh} onChange={num("rateHigh")} />
      </label>
      <label className="field">
        Sessions a week
        <input type="number" min={1} max={21} step={1} required value={t.sessionsPerWeek} onChange={num("sessionsPerWeek")} />
      </label>
      {status.error && (
        <p className="error wide-field" role="alert">
          {status.error}
        </p>
      )}
      <div className="row wide-field">
        <button type="submit" className="button" data-size="small" disabled={status.busy}>
          {status.busy ? "Saving…" : "Save targets"}
        </button>
        <button type="button" className="button" data-variant="ghost" data-size="small" onClick={() => setT(DEFAULT_TARGETS)}>
          Reset to usual
        </button>
        <button type="button" className="button" data-variant="ghost" data-size="small" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
