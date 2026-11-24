"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { Icon, Mark } from "@/components/Icon";
import { Measured } from "@/components/Measured";
import { Progress, StatusChip } from "@/components/Progress";
import { Arrow, Dot, HeadlineScore } from "@/components/Score";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { PeriodBars, TimeTrend } from "@/components/trendCharts";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import {
  assignmentProgress,
  describeAssignment,
  type AssignmentProgress,
} from "@/lib/domain/coaching";
import {
  describeMode,
  formatDay,
  formatDuration,
  formatLongDay,
} from "@/lib/domain/format";
import {
  formatScore,
  headline,
  isLegacyScores,
  isTransitionScores,
  scoreWord,
} from "@/lib/domain/scores";
import {
  buckets,
  inPeriod,
  rangeLabel,
  RANGES,
  summarize,
  type RangeDays,
} from "@/lib/domain/trends";
import {
  DEFAULT_TARGETS,
  type AthleteTargets,
  type SessionSummary,
  type UserProfile,
} from "@/lib/domain/types";
import { useLoad } from "@/lib/useLoad";
import { athleteHref, sessionHref } from "../links";
import "./report.css";

const DAY_MS = 86_400_000;
/** Chart width on paper: A4 portrait less the page margins (182 mm ≈ 688 CSS px). */
const PRINT_WIDTH = 680;
const NOTE_LENGTH = 70;

// /cloud/report/?athlete=<uid>&days=30 — a printable progress report of one
// athlete over a period. Athletes leave out `athlete` for their own.
export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportRoute />
    </Suspense>
  );
}

function ReportRoute() {
  const auth = useAuth();
  const params = useSearchParams();
  if (auth.status !== "signed-in") return null;
  const requested = params.get("athlete");
  const days: RangeDays =
    RANGES.find((r) => String(r.days) === params.get("days"))?.days ?? 30;
  const viewer = auth.profile;
  const coach = viewer?.role === "coach";

  if (coach && !requested)
    return <ChooseAthlete coachId={auth.user.uid} days={days} />;
  const athleteId = requested || auth.user.uid;
  return (
    <Report
      key={athleteId}
      athleteId={athleteId}
      days={days}
      viewerId={auth.user.uid}
      viewerName={viewer?.displayName ?? auth.user.email}
      viewerIsCoach={coach}
      linkAthlete={Boolean(requested)}
    />
  );
}

/** A coach opened the report without saying whose: pick an athlete. */
function ChooseAthlete({ coachId, days }: { coachId: string; days: number }) {
  const backend = useBackend();
  const athletes = useLoad(`report-athletes:${coachId}`, () =>
    backend.data.listAthletes(coachId),
  );
  return (
    <div className="container review rp-choose">
      <div className="title-row">
        <h1>Progress report</h1>
        <span>Choose an athlete</span>
      </div>
      {athletes.status === "loading" ? (
        <Skeleton lines={3} />
      ) : athletes.status === "error" ? (
        <ErrorState
          error={athletes.error}
          what="your athletes"
          onRetry={athletes.retry}
        />
      ) : athletes.data.length === 0 ? (
        <EmptyState title="No athletes yet">
          <p className="muted">
            Reports are for athletes who share with you. Invite one on the{" "}
            <Link href="/cloud/athletes/">Athletes</Link> page.
          </p>
        </EmptyState>
      ) : (
        <ul className="pane people rp-people">
          {athletes.data.map((a) => (
            <li key={a.uid}>
              <Link className="who-cell" href={reportHref(a.uid, days, false)}>
                {a.displayName}
              </Link>
              <Icon name="chevronRight" size={18} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function reportHref(athleteId: string, days: number, self: boolean): string {
  return self
    ? `/cloud/report/?days=${days}`
    : `/cloud/report/?${new URLSearchParams({ athlete: athleteId, days: String(days) })}`;
}

interface ReportData {
  sessions: SessionSummary[];
  athlete: UserProfile | null;
  targets: AthleteTargets;
  /** Who set the targets; null for the usual defaults. */
  targetsBy: string | null;
  /** The coach the report is about the relationship with, if any. */
  coachName: string | null;
  assignments: AssignmentProgress[];
}

function Report({
  athleteId,
  days,
  viewerId,
  viewerName,
  viewerIsCoach,
  linkAthlete,
}: {
  athleteId: string;
  days: RangeDays;
  viewerId: string;
  viewerName: string;
  viewerIsCoach: boolean;
  linkAthlete: boolean;
}) {
  const backend = useBackend();
  const [now] = useState(() => new Date());
  const self = athleteId === viewerId;

  const data = useLoad<ReportData>(
    `report:${viewerId}:${athleteId}`,
    async () => {
      const [sessions, athlete, assignments] = await Promise.all([
        // Two of the longest periods, so the summary can compare with the one before.
        backend.data.listSessions(athleteId, { limit: 2000 }),
        self ? null : backend.data.getProfile(athleteId),
        backend.data.listAssignments(athleteId),
      ]);
      let link = null;
      let coachName: string | null = null;
      if (viewerIsCoach) {
        link = await backend.data.getCoachLink(viewerId, athleteId);
        coachName = viewerName;
      } else if (self) {
        // Athletes see the targets their first coach set, as on the Trends tab.
        const [coach] = await backend.data.listCoaches(athleteId);
        if (coach) {
          link = await backend.data.getCoachLink(coach.uid, athleteId);
          coachName = coach.displayName;
        }
      }
      return {
        sessions,
        athlete,
        targets: link?.targets ?? DEFAULT_TARGETS,
        targetsBy: link?.targets ? coachName : null,
        coachName,
        assignments: assignments.map((a) =>
          assignmentProgress(a, sessions, now),
        ),
      };
    },
  );

  const athleteName =
    data.status === "ready"
      ? self
        ? viewerName
        : (data.data.athlete?.displayName ?? "Athlete")
      : "";
  const back = self
    ? { href: "/cloud/sessions/?tab=trends", label: "Your trends" }
    : viewerIsCoach
      ? {
          href: athleteHref(athleteId, "trends"),
          label: athleteName || "Athlete",
        }
      : { href: "/cloud/", label: "Your sessions" };

  return (
    <div className="container review rp">
      <div className="rp-bar no-print">
        <Link href={back.href} className="link small">
          <Icon name="chevronLeft" size={18} />
          {back.label}
        </Link>
        {data.status !== "error" && (
          <div className="rp-controls">
            <nav className="seg" aria-label="Period">
              {RANGES.map((r) => (
                <Link
                  key={r.days}
                  href={reportHref(athleteId, r.days, !linkAthlete)}
                  aria-current={r.days === days ? "page" : undefined}
                  replace
                  scroll={false}
                >
                  {r.label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              className="button"
              data-size="small"
              onClick={() => window.print()}
              disabled={data.status !== "ready"}
            >
              <Icon name="print" size={16} />
              Print or save as PDF
            </button>
          </div>
        )}
      </div>

      {data.status === "loading" ? (
        <div className="pane pane-pad">
          <Skeleton lines={10} label="Preparing the report…" />
        </div>
      ) : data.status === "error" ? (
        <ErrorState error={data.error} what="the report" onRetry={data.retry} />
      ) : (
        <ReportDocument
          data={data.data}
          days={days}
          now={now}
          athleteId={athleteId}
          athleteName={athleteName}
          viewerName={viewerName}
          viewerIsCoach={viewerIsCoach}
        />
      )}
    </div>
  );
}

function ReportDocument({
  data,
  days,
  now,
  athleteId,
  athleteName,
  viewerName,
  viewerIsCoach,
}: {
  data: ReportData;
  days: RangeDays;
  now: Date;
  athleteId: string;
  athleteName: string;
  viewerName: string;
  viewerIsCoach: boolean;
}) {
  const { targets } = data;
  const t1 = now.getTime();
  const t0 = t1 - days * DAY_MS;
  const span = rangeLabel(days);
  const sessions = inPeriod(data.sessions, now, days);
  const { current, previous, sentences } = summarize(
    data.sessions,
    now,
    days,
    targets,
  );
  const bins = buckets(data.sessions, now, days);
  const weekly = days > 31;
  const legacyCount = sessions.filter((s) => isLegacyScores(s.scores)).length;

  const scorePoints = sessions.flatMap((s) =>
    isTransitionScores(s.scores)
      ? [
          {
            t: Date.parse(s.startedAt),
            v: s.scores.total,
            label: `${formatDay(s.startedAt)} · ${describeMode(s)}`,
            out: s.scores.total < targets.score,
            href: sessionHref(athleteId, s.id),
          },
        ]
      : [],
  );
  const scoreMin = Math.max(
    0,
    Math.floor(Math.min(targets.score, ...scorePoints.map((p) => p.v)) - 1),
  );
  const ratePoints = sessions
    .filter((s) => s.mode === "open" && s.respirationRateBpm !== null)
    .map((s) => ({
      t: Date.parse(s.startedAt),
      v: s.respirationRateBpm!,
      label: `${formatDay(s.startedAt)} · Open`,
      out:
        s.respirationRateBpm! < targets.rateLow ||
        s.respirationRateBpm! > targets.rateHigh,
      href: sessionHref(athleteId, s.id),
    }));
  const rateMax =
    Math.ceil(
      Math.max(20, targets.rateHigh + 4, ...ratePoints.map((p) => p.v + 2)) / 4,
    ) * 4;

  // Practice whose window overlaps the period.
  const plans = data.assignments.filter(
    (p) =>
      Date.parse(p.assignment.createdAt) < t1 &&
      Date.parse(p.assignment.dueAt) >= t0,
  );
  const livePlans = plans.filter((p) => p.status !== "cancelled");
  const practiceDone = livePlans.reduce((n, p) => n + p.done, 0);
  const practiceTarget = livePlans.reduce((n, p) => n + p.assignment.target, 0);

  const change =
    current.average !== null && previous.average !== null
      ? Math.round((current.average - previous.average) * 10) / 10
      : null;
  const countChange = current.count - previous.count;
  const signed = (n: number, f: (n: number) => string = String) =>
    `${n > 0 ? "+" : n < 0 ? "−" : "±"}${f(Math.abs(n))}`;
  const generated = now.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <article className="rp-doc" aria-labelledby="rp-title">
      <header className="rp-head">
        <div className="rp-brand">
          <Mark size={30} />
          <span>
            BreathBand<sup>®</sup>{" "}
            <span className="rp-brand-sub">BreathCloud</span>
          </span>
        </div>
        <h1 id="rp-title">Breathing progress report</h1>
        <p className="rp-who">{athleteName}</p>
        <dl className="rp-meta">
          <div>
            <dt>Period</dt>
            <dd>
              {formatLongDay(new Date(t0).toISOString())} –{" "}
              {formatLongDay(now.toISOString())}{" "}
              <span className="rp-dim">({span})</span>
            </dd>
          </div>
          <div>
            <dt>{viewerIsCoach ? "Prepared by" : "Prepared for"}</dt>
            <dd>{viewerIsCoach ? `${viewerName}, coach` : athleteName}</dd>
          </div>
          {!viewerIsCoach && data.coachName && (
            <div>
              <dt>Coach</dt>
              <dd>{data.coachName}</dd>
            </div>
          )}
          <div>
            <dt>Generated</dt>
            <dd>{generated}</dd>
          </div>
        </dl>
      </header>

      <section className="rp-section" aria-labelledby="rp-summary-h">
        <h2 id="rp-summary-h">Summary</h2>
        <p className="rp-summary">{sentences.join(" ")}</p>
      </section>

      <section className="rp-section rp-kpis" aria-label="Key numbers">
        <Kpi label="Sessions" value={String(current.count)}>
          {signed(countChange)} on the {span} before ·{" "}
          {formatScore(current.perWeek)} a week (target{" "}
          {targets.sessionsPerWeek})
        </Kpi>
        <Kpi label="Minutes" value={String(current.minutes)}>
          {previous.minutes} in the {span} before
        </Kpi>
        <Kpi
          label="Average Total Breath Score"
          value={current.average === null ? "–" : formatScore(current.average)}
          word={
            current.average === null ? undefined : (
              <>
                <Dot band={scoreWord(current.average).band} />
                {scoreWord(current.average).word}
              </>
            )
          }
        >
          {change === null
            ? current.average === null
              ? "No scored sessions"
              : `Nothing scored in the ${span} before`
            : `${signed(change, formatScore)} on the ${span} before`}
        </Kpi>
        <Kpi
          label="On target"
          value={String(current.onTarget)}
          small={`of ${current.scoredCount}`}
        >
          scored sessions at {formatScore(targets.score)} or more
        </Kpi>
        <Kpi
          label="Practice"
          value={practiceTarget ? String(practiceDone) : "–"}
          small={practiceTarget ? `of ${practiceTarget}` : undefined}
        >
          {livePlans.length
            ? `${livePlans.filter((p) => p.status === "done").length} of ${livePlans.length} ${livePlans.length === 1 ? "plan" : "plans"} done`
            : "No practice set in this period"}
        </Kpi>
      </section>

      <section className="rp-section" aria-labelledby="rp-score-h">
        <div className="rp-h">
          <h2 id="rp-score-h">Total Breath Score</h2>
          <span className="rp-dim">
            Each paced session · dashed line: target{" "}
            {formatScore(targets.score)} ·{" "}
            <i className="rp-key-out" aria-hidden="true" /> under the target
          </span>
        </div>
        <Chart height={190}>
          {(width) => (
            <TimeTrend
              width={width}
              height={190}
              points={scorePoints}
              t0={t0}
              t1={t1}
              yMin={scoreMin}
              yMax={10}
              yTicks={[2, 4, 6, 8, 10].filter((v) => v >= scoreMin)}
              line={{
                v: targets.score,
                label: `Target ${formatScore(targets.score)}`,
              }}
              format={formatScore}
              ariaLabel={`Total Breath Score for ${scorePoints.length} paced sessions, target ${targets.score}`}
            />
          )}
        </Chart>
        {legacyCount > 0 && (
          <p className="rp-note">
            {legacyCount} {legacyCount === 1 ? "session was" : "sessions were"}{" "}
            scored the earlier 0–100% way and{" "}
            {legacyCount === 1 ? "isn't" : "aren't"} charted;{" "}
            {legacyCount === 1 ? "it's" : "they're"} in the table below.
          </p>
        )}
      </section>

      <div className="rp-pair">
        <section className="rp-section" aria-labelledby="rp-rate-h">
          <div className="rp-h">
            <h2 id="rp-rate-h">Breathing rate</h2>
            <span className="rp-dim">
              Each open session, br/min · shaded: {targets.rateLow}–
              {targets.rateHigh} target
            </span>
          </div>
          <Chart height={170} half>
            {(width) => (
              <TimeTrend
                width={width}
                height={170}
                points={ratePoints}
                t0={t0}
                t1={t1}
                yMin={0}
                yMax={rateMax}
                yTicks={[0, 8, 16, 24, 32, 40].filter((v) => v <= rateMax)}
                band={{
                  lo: targets.rateLow,
                  hi: targets.rateHigh,
                  label: `${targets.rateLow}–${targets.rateHigh}`,
                }}
                format={(v) => `${formatScore(v)} br/min`}
                ariaLabel={`Breathing rate for ${ratePoints.length} open sessions, target ${targets.rateLow} to ${targets.rateHigh}`}
              />
            )}
          </Chart>
        </section>
        <section className="rp-section" aria-labelledby="rp-count-h">
          <div className="rp-h">
            <h2 id="rp-count-h">Sessions {weekly ? "per week" : "per day"}</h2>
            <span className="rp-dim">
              {weekly
                ? `Dashed line: target ${targets.sessionsPerWeek} a week`
                : `${current.minutes} minutes in all`}
            </span>
          </div>
          <Chart height={170} half>
            {(width) => (
              <PeriodBars
                width={width}
                height={170}
                bars={bins.map((b) => ({
                  start: b.start,
                  end: b.end,
                  value: b.sessions.length,
                  label: `${weekly ? "Week of " : ""}${formatDay(new Date(b.start).toISOString())} · ${Math.round(b.sessions.reduce((n, s) => n + s.durationSec, 0) / 60)} min`,
                }))}
                target={
                  weekly
                    ? {
                        v: targets.sessionsPerWeek,
                        label: `Target ${targets.sessionsPerWeek}`,
                      }
                    : undefined
                }
                unit="sessions"
                ariaLabel={`Sessions ${weekly ? "per week" : "per day"} over the period`}
              />
            )}
          </Chart>
        </section>
      </div>

      <div className="rp-pair rp-pair-text">
        <section className="rp-section" aria-labelledby="rp-targets-h">
          <h2 id="rp-targets-h">Targets in use</h2>
          <dl className="rp-facts">
            <dt>Total Breath Score</dt>
            <dd>{formatScore(targets.score)} or more on paced sessions</dd>
            <dt>Breathing rate</dt>
            <dd>
              {targets.rateLow}–{targets.rateHigh} br/min in open sessions
            </dd>
            <dt>Sessions</dt>
            <dd>{targets.sessionsPerWeek} a week</dd>
          </dl>
          <p className="rp-note">
            {data.targetsBy
              ? `Set by ${data.targetsBy}.`
              : "The usual starting targets; no coach has set others."}
          </p>
        </section>

        <section className="rp-section" aria-labelledby="rp-practice-h">
          <h2 id="rp-practice-h">Practice</h2>
          {plans.length === 0 ? (
            <p className="rp-note">No practice was set during this period.</p>
          ) : (
            <ul className="rp-plans">
              {plans.map((p) => (
                <li key={p.assignment.id}>
                  <div className="rp-plan-top">
                    <b>{describeAssignment(p.assignment)}</b>
                    <StatusChip status={p.status} />
                  </div>
                  <div className="rp-plan-bottom">
                    <Progress
                      done={p.done}
                      target={p.assignment.target}
                      status={p.status}
                    />
                    <span className="rp-dim">
                      {formatDay(p.assignment.createdAt, undefined, false)} –{" "}
                      {formatDay(p.assignment.dueAt, undefined, false)}
                    </span>
                  </div>
                  {p.assignment.note && (
                    <p className="rp-plan-note">{p.assignment.note}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section
        className="rp-section rp-sessions"
        aria-labelledby="rp-sessions-h"
      >
        <div className="rp-h">
          <h2 id="rp-sessions-h">Sessions</h2>
          <span className="rp-dim">
            {sessions.length} in the period, newest first · scores 1–10 ·{" "}
            <Arrow dir="in" /> inhale <Arrow dir="out" /> exhale
          </span>
        </div>
        {sessions.length === 0 ? (
          <p className="rp-note">No sessions in this period.</p>
        ) : (
          <div className="table-scroll">
            <table className="table rp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="num">Length</th>
                  <th>Score</th>
                  <th className="num">
                    Timing <Arrow dir="in" />
                  </th>
                  <th className="num">
                    <Arrow dir="out" />
                    <span className="sr-only">Timing, exhale</span>
                  </th>
                  <th className="num">
                    Depth <Arrow dir="in" />
                  </th>
                  <th className="num">
                    <Arrow dir="out" />
                    <span className="sr-only">Depth, exhale</span>
                  </th>
                  <th className="num">Rate</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <SessionRow key={s.id} session={s} athleteId={athleteId} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="rp-foot">
        <p>
          Breathband is a wellness product for breath training, not a medical
          device.
        </p>
        <p>
          Scores are computed by the Breathband app. Report generated in
          BreathCloud on {generated}.
        </p>
      </footer>
    </article>
  );
}

function Kpi({
  label,
  value,
  small,
  word,
  children,
}: {
  label: string;
  value: string;
  small?: string;
  word?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rp-kpi">
      <span className="rp-kpi-l">{label}</span>
      <span className="rp-kpi-n">
        {value}
        {small && <small> {small}</small>}
        {word && <span className="rp-kpi-w">{word}</span>}
      </span>
      <span className="rp-kpi-d">{children}</span>
    </div>
  );
}

/**
 * A chart at the width of its box on screen, and at a fixed width on paper
 * (an SVG drawn for a 1200 px screen wouldn't fit A4). Only one of the two
 * is displayed at a time.
 */
function Chart({
  height,
  half = false,
  children,
}: {
  height: number;
  half?: boolean;
  children: (width: number) => ReactNode;
}) {
  return (
    <>
      <div className="rp-screen">
        <Measured height={height}>{children}</Measured>
      </div>
      <div className="rp-print" aria-hidden="true">
        {children(half ? PRINT_WIDTH / 2 - 10 : PRINT_WIDTH)}
      </div>
    </>
  );
}

function SessionRow({
  session: s,
  athleteId,
}: {
  session: SessionSummary;
  athleteId: string;
}) {
  const scores = s.scores;
  const note = s.note.trim();
  return (
    <tr>
      <td>
        <Link className="plain" href={sessionHref(athleteId, s.id)}>
          {formatDay(s.startedAt)}
        </Link>
      </td>
      <td className="sub">{describeMode(s)}</td>
      <td className="num">{formatDuration(s.durationSec)}</td>
      <td>
        {scores ? (
          <HeadlineScore headline={headline(s)} compact />
        ) : (
          <span className="rp-dim">–</span>
        )}
      </td>
      {isTransitionScores(scores) ? (
        <>
          <td className="num">{formatScore(scores.timing.inhale)}</td>
          <td className="num">{formatScore(scores.timing.exhale)}</td>
          <td className="num">{formatScore(scores.depth.inhale)}</td>
          <td className="num">{formatScore(scores.depth.exhale)}</td>
        </>
      ) : isLegacyScores(scores) ? (
        <>
          <td
            className="num"
            colSpan={2}
            title="Earlier 0–100% scoring: timing"
          >
            {Math.round(scores.timing)}%
          </td>
          <td className="num" colSpan={2} title="Earlier 0–100% scoring: depth">
            {Math.round(scores.depth)}%
          </td>
        </>
      ) : (
        <td className="num rp-dim" colSpan={4}>
          {s.mode === "open" ? "Open: not scored" : "–"}
        </td>
      )}
      <td className="num">
        {s.respirationRateBpm === null
          ? "–"
          : formatScore(s.respirationRateBpm)}
      </td>
      <td
        className="rp-note-cell"
        title={note.length > NOTE_LENGTH ? note : undefined}
      >
        {note ? (
          note.length > NOTE_LENGTH ? (
            `${note.slice(0, NOTE_LENGTH - 1).trimEnd()}…`
          ) : (
            note
          )
        ) : (
          <span className="rp-dim">–</span>
        )}
      </td>
    </tr>
  );
}
