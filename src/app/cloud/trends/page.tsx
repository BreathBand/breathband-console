"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Measured } from "@/components/Measured";
import { Score } from "@/components/Score";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { CompareChart, SeriesKey, type CompareSeries } from "@/components/trendCharts";
import { useAuth } from "@/lib/backend/BackendProvider";
import { compareCsv } from "@/lib/domain/csv";
import { formatScore } from "@/lib/domain/scores";
import { bucketAverage, bucketRate, buckets, inPeriod, periodStats, type PeriodStats } from "@/lib/domain/trends";
import { downloadText, slug } from "@/lib/download";
import { athleteHref } from "../links";
import { useTeam, type TeamMember } from "../useTeam";
import { useTerms } from "../useTerms";

const MAX = 6;
const PERIODS = [
  { days: 28, label: "4 weeks" },
  { days: 91, label: "13 weeks" },
  { days: 182, label: "26 weeks" },
] as const;
const METRICS = [
  { id: "score", label: "Total Breath Score", note: "Weekly average of paced sessions" },
  { id: "count", label: "Sessions", note: "Sessions per week" },
  { id: "rate", label: "Breathing rate", note: "Weekly average of open sessions, br/min" },
] as const;
type Metric = (typeof METRICS)[number]["id"];

// /cloud/trends/ — several athletes on one chart, week by week.
export default function TrendsPage() {
  const auth = useAuth();
  if (auth.status !== "signed-in") return null;
  if (auth.profile?.role !== "coach") {
    return (
      <div className="container">
        <EmptyState title="Comparing athletes is for coaches">
          <p className="muted">
            Your own trends are on the <Link href="/cloud/sessions/?tab=trends">Trends</Link> tab.
          </p>
        </EmptyState>
      </div>
    );
  }
  return <Compare coachId={auth.user.uid} />;
}

function Compare({ coachId }: { coachId: string }) {
  const [now] = useState(() => new Date());
  const team = useTeam(coachId, now);
  const terms = useTerms();
  const [days, setDays] = useState<number>(91);
  const [metric, setMetric] = useState<Metric>("score");
  // athleteId → colour slot. Slots stick to the athlete while they stay picked,
  // so adding or removing someone never repaints the others.
  const [picked, setPicked] = useState<Map<string, number> | null>(null);

  if (team.status === "loading") {
    return (
      <div className="container review">
        <Skeleton lines={8} label={`Loading your ${terms.many}…`} />
      </div>
    );
  }
  if (team.status === "error") {
    return (
      <div className="container review">
        <ErrorState error={team.error} what={`your ${terms.many}`} onRetry={team.retry} />
      </div>
    );
  }

  const { members, squads } = team.data;
  const initial = new Map(members.slice(0, MAX).map((m, i) => [m.profile.uid, i + 1]));
  const chosen = picked ?? initial;
  const toggle = (uid: string) => {
    const next = new Map(chosen);
    if (next.has(uid)) next.delete(uid);
    else if (next.size < MAX) {
      const used = new Set(next.values());
      next.set(uid, [1, 2, 3, 4, 5, 6].find((s) => !used.has(s))!);
    }
    setPicked(next);
  };
  const pickSquad = (ids: string[]) => setPicked(new Map(ids.slice(0, MAX).map((id, i) => [id, i + 1])));

  const bins = buckets([], now, days, "week");
  const starts = bins.map((b) => b.start);
  const series: CompareSeries[] = members
    .filter((m) => chosen.has(m.profile.uid))
    .map((m) => {
      const own = buckets(m.sessions, now, days, "week");
      return {
        id: m.profile.uid,
        name: m.profile.displayName.split(" ")[0],
        slot: chosen.get(m.profile.uid)!,
        values: own.map((b) => (metric === "score" ? bucketAverage(b) : metric === "rate" ? bucketRate(b) : b.sessions.length)),
      };
    })
    .sort((a, b) => a.slot - b.slot);
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const scale =
    metric === "score"
      ? { yMin: Math.max(0, Math.floor(Math.min(10, ...all) - 1)), yMax: 10 }
      : metric === "rate"
        ? { yMin: 0, yMax: Math.max(20, Math.ceil(Math.max(0, ...all) / 4) * 4 + 4) }
        : { yMin: 0, yMax: Math.max(4, Math.ceil(Math.max(0, ...all)) + 1) };
  const ticks = niceTicks(scale.yMin, scale.yMax);
  const info = METRICS.find((m) => m.id === metric)!;
  const periodLabel = PERIODS.find((p) => p.days === days)?.label ?? `${days} days`;
  const rows = compareRows(members, chosen, now, days);
  const downloadCsv = () =>
    downloadText(
      `breathband-compare-${slug(periodLabel)}.csv`,
      compareCsv(rows.map((r) => ({ name: r.m.profile.displayName, stats: r.cur, change: r.change }))),
    );

  return (
    <div className="container review">
      <div className="title-row">
        <h1>Compare {terms.many}</h1>
        <span>Up to {MAX} {terms.many} week by week, on one chart.</span>
      </div>

      <section className="pane pane-pad compare-controls" aria-label="What to compare">
        <div className="toolbar">
          <div className="seg" role="group" aria-label="Measure">
            {METRICS.map((m) => (
              <button key={m.id} type="button" aria-pressed={metric === m.id} onClick={() => setMetric(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button key={p.days} type="button" aria-pressed={days === p.days} onClick={() => setDays(p.days)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <fieldset className="field">
          <legend>
            {terms.Many} ({chosen.size} of {MAX} at most)
          </legend>
          <div className="chip-picks">
            {members.map((m) => {
              const on = chosen.has(m.profile.uid);
              return (
                <label key={m.profile.uid} className="chip-pick" data-on={on || undefined}>
                  <input type="checkbox" checked={on} disabled={!on && chosen.size >= MAX} onChange={() => toggle(m.profile.uid)} />
                  {m.profile.displayName}
                </label>
              );
            })}
          </div>
        </fieldset>
        {squads.length > 0 && (
          <p className="label squad-quick">
            Pick a squad:{" "}
            {squads.map((q) => (
              <button key={q.id} type="button" className="link small" onClick={() => pickSquad(q.athleteIds)}>
                {q.name}
              </button>
            ))}
          </p>
        )}
      </section>

      <section className="pane pane-pad" aria-labelledby="compare-h">
        <div className="pane-h">
          <h2 id="compare-h">{info.label}</h2>
          <span className="meta">{info.note}</span>
        </div>
        {series.length === 0 ? (
          <p className="muted dash-empty">Pick at least one {terms.one}.</p>
        ) : (
          <>
            <SeriesKey series={series} />
            <Measured height={300}>
              {(width) => (
                <CompareChart
                  width={width}
                  height={300}
                  series={series}
                  starts={starts}
                  {...scale}
                  yTicks={ticks}
                  band={metric === "rate" ? { lo: 12, hi: 16, label: "12–16" } : undefined}
                  format={(v) => (metric === "count" ? `${v} sessions` : metric === "rate" ? `${formatScore(v)} br/min` : formatScore(v))}
                  ariaLabel={`${info.label} per week for ${series.map((s) => s.name).join(", ")}`}
                />
              )}
            </Measured>
          </>
        )}
      </section>

      <section className="pane pane-pad" aria-labelledby="compare-table-h">
        <div className="pane-h">
          <h2 id="compare-table-h">Side by side</h2>
          <span className="meta">Over the last {periodLabel}, against each {terms.one}&apos;s own targets</span>
          <button
            type="button"
            className="button toolbar-end"
            data-variant="ghost"
            data-size="small"
            disabled={rows.length === 0}
            onClick={downloadCsv}
          >
            <Icon name="download" size={16} />
            CSV of this table
          </button>
        </div>
        <div className="table-scroll">
          <table className="table compare-table">
            <thead>
              <tr>
                <th>{terms.One}</th>
                <th className="num">Sessions</th>
                <th className="num">A week</th>
                <th className="num">Average score</th>
                <th className="num">Change</th>
                <th className="num">On target</th>
                <th className="num">Breathing rate</th>
                <th>Weakest part</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <CompareRow key={row.m.profile.uid} {...row} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

interface CompareRowData {
  m: TeamMember;
  cur: PeriodStats;
  change: number | null;
}

function compareRows(members: TeamMember[], chosen: Map<string, number>, now: Date, days: number): CompareRowData[] {
  return members
    .filter((m) => chosen.has(m.profile.uid))
    .map((m) => {
      const cur = periodStats(inPeriod(m.sessions, now, days), days, m.targets);
      const prev = periodStats(inPeriod(m.sessions, now, days, 1), days, m.targets);
      const change = cur.average !== null && prev.average !== null ? Math.round((cur.average - prev.average) * 10) / 10 : null;
      return { m, cur, change };
    });
}

function CompareRow({ m, cur, change }: CompareRowData) {
  const terms = useTerms();
  return (
    <tr>
      <Cell label={terms.One}>
        <Link className="row-link" href={athleteHref(m.profile.uid, "trends")}>
          {m.profile.displayName}
        </Link>
      </Cell>
      <Cell label="Sessions" className="num">
        {cur.count}
      </Cell>
      <Cell label="A week" className="num">
        {formatScore(cur.perWeek)}
      </Cell>
      <Cell label="Average score" className="num">
        {cur.average === null ? <span className="muted">–</span> : <Score value={cur.average} />}
      </Cell>
      <Cell label="Change" className="num">
        {change === null ? "–" : `${change >= 0 ? "+" : "−"}${formatScore(Math.abs(change))}`}
      </Cell>
      <Cell label="On target" className="num">
        {cur.onTarget} of {cur.scoredCount}
      </Cell>
      <Cell label="Breathing rate" className="num">
        {cur.rateAverage === null ? "–" : `${formatScore(cur.rateAverage)}/min`}
      </Cell>
      <Cell label="Weakest part" className="sub">
        {cur.weakest ? `${cur.weakest.label} (${formatScore(cur.weakest.value)})` : "–"}
      </Cell>
    </tr>
  );
}

function Cell({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <td className={className}>
      <span className="compare-label" hidden>
        {label}
      </span>
      {children}
    </td>
  );
}

function niceTicks(lo: number, hi: number): number[] {
  const span = hi - lo;
  const step = span <= 5 ? 1 : span <= 10 ? 2 : span <= 24 ? 4 : 8;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}
