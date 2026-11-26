"use client";

import Link from "next/link";
import { RateBars, TrendChart, type TrendPoint } from "@/components/charts";
import { Icon } from "@/components/Icon";
import { Measured } from "@/components/Measured";
import { Progress, StatusChip } from "@/components/Progress";
import { Dot, TransitionTable } from "@/components/Score";
import { EmptyState } from "@/components/States";
import { activity, daysAgoText } from "@/lib/domain/activity";
import { describeAssignment, dueText, isOpen, timeAgo } from "@/lib/domain/coaching";
import { describeMode, formatDay, formatLongDay, formatTime } from "@/lib/domain/format";
import { formatScore, scoreWord } from "@/lib/domain/scores";
import type { Workspace } from "./AthleteWorkspace";
import { PRO_WORD } from "./home/tailor";

const TREND_LENGTH = 12;

/** Headline numbers, trends, current practice and the latest conversation for one athlete. */
export function AthleteOverview({ ws }: { ws: Workspace }) {
  const { sessions, self, name, now, targets } = ws;

  if (sessions.length === 0) {
    return self ? (
      <EmptyState title="No sessions yet">
        <ol className="steps-list">
          <li>Get the Breathband app on your phone or tablet.</li>
          <li>Pair your band and calibrate it.</li>
          <li>Record a session. It appears here once the app uploads it.</li>
        </ol>
      </EmptyState>
    ) : (
      <EmptyState title={`${name} hasn't recorded a session yet`}>
        <p className="muted">Sessions appear here once their app uploads them. You can set practice for them now.</p>
        <Link className="button" data-size="small" href={ws.tabHref("plan", true)}>
          <Icon name="plan" size={16} />
          Assign practice
        </Link>
      </EmptyState>
    );
  }

  const a = activity(sessions, now, ws.rules, targets);
  const [latest, previous] = a.scored;
  const recent = a.scored.slice(0, 5);
  const average = recent.reduce((sum, s) => sum + s.scores.total, 0) / (recent.length || 1);

  const pacedPoints: TrendPoint[] = a.scored
    .slice(0, TREND_LENGTH)
    .reverse()
    .map((s) => ({
      value: s.scores.total,
      label: formatDay(s.startedAt, undefined, false),
      title: `${formatDay(s.startedAt)}, ${describeMode(s)}: ${formatScore(s.scores.total)}`,
    }));
  const openPoints: TrendPoint[] = sessions
    .filter((s) => s.mode === "open" && s.respirationRateBpm !== null)
    .slice(0, TREND_LENGTH)
    .reverse()
    .map((s) => ({
      value: s.respirationRateBpm!,
      label: formatDay(s.startedAt, undefined, false),
      title: `${formatDay(s.startedAt)}: ${s.respirationRateBpm} br/min`,
    }));

  return (
    <div className="review">
      {self && a.flags.length > 0 && (
        <ul className="flags" aria-label="Reminders">
          {a.flags.map((f) => (
            <li key={f.kind} data-kind={f.kind}>
              <Icon name="info" size={18} />
              {f.text}
            </li>
          ))}
        </ul>
      )}

      <div className="stats">
        <section className="pane hero" aria-label="Latest Total Breath Score">
          <span className="lbl">Latest Total Breath Score</span>
          {latest ? (
            <>
              <span className="n">{formatScore(latest.scores.total)}</span>
              <span className="w">
                <Dot band={scoreWord(latest.scores.total).band} />
                {scoreWord(latest.scores.total).word}
              </span>
              <span className="d">
                {previous
                  ? `${latest.scores.total >= previous.scores.total ? "+" : "−"}${formatScore(Math.abs(latest.scores.total - previous.scores.total))} vs ${formatDay(previous.startedAt, undefined, false)} · `
                  : ""}
                <Link href={ws.sessionHref(latest.id)}>{formatDay(latest.startedAt)}</Link>
              </span>
            </>
          ) : (
            <span className="d">No scored sessions yet</span>
          )}
        </section>
        <section className="pane stat">
          <span className="lbl">Last 7 days</span>
          <span className="n">{a.lastWeek}</span>
          <span className="d">{a.lastWeek === 1 ? "session" : "sessions"}</span>
        </section>
        <section className="pane stat">
          <span className="lbl">Last session</span>
          <span className="n sm">{daysAgoText(a.daysSince!)}</span>
          <span className="d">
            <Link href={ws.sessionHref(a.newest!.id)}>
              {describeMode(a.newest!)} · {formatTime(a.newest!.startedAt)}
            </Link>
          </span>
        </section>
        <section className="pane stat">
          <span className="lbl">Average, last {recent.length || 5} scored</span>
          <span className="n">{recent.length ? formatScore(Math.round(average * 10) / 10) : "–"}</span>
          <span className="d">Total Breath Score</span>
        </section>
      </div>

      <section className="pane pane-pad" aria-label="Trends">
        <div className="trends">
          <div>
            <div className="pane-h">
              <h2>Paced · Total Breath Score</h2>
              <span className="meta">
                {pacedPoints.length ? `Last ${pacedPoints.length} scored sessions` : "None scored yet"}
              </span>
            </div>
            {pacedPoints.length > 0 ? (
              <Measured height={128}>{(width) => <TrendChart points={pacedPoints} width={width} />}</Measured>
            ) : (
              <p className="muted chart-empty">Paced sessions scored 1–10 appear here.</p>
            )}
          </div>
          <div>
            <div className="pane-h">
              <h2>Open · breathing rate</h2>
              <span className="meta">
                br/min, shaded {targets.rateLow}–{targets.rateHigh}
              </span>
            </div>
            {openPoints.length > 0 ? (
              <Measured height={128}>
                {(width) => <RateBars points={openPoints} lo={targets.rateLow} hi={targets.rateHigh} width={width} />}
              </Measured>
            ) : (
              <p className="muted chart-empty">No open sessions yet.</p>
            )}
          </div>
        </div>
      </section>

      <div className="ov-low">
        {latest ? (
          <section className="pane pane-pad" aria-label="Latest scored session">
            <div className="pane-h">
              <h2>
                Latest scored · {describeMode(latest)} · {formatLongDay(latest.startedAt)}
              </h2>
              <Link className="link" href={ws.sessionHref(latest.id)}>
                Open the review
                <Icon name="chevronRight" size={18} />
              </Link>
            </div>
            <div className="latest-table">
              <TransitionTable scores={latest.scores} />
            </div>
          </section>
        ) : (
          <section className="pane pane-pad">
            <p className="muted">No scored sessions yet.</p>
          </section>
        )}
        <div className="stack">
          <PracticeCard ws={ws} />
          <ConversationCard ws={ws} />
        </div>
      </div>
    </div>
  );
}

function PracticeCard({ ws }: { ws: Workspace }) {
  const open = ws.plans.filter(isOpen);
  return (
    <section className="pane pane-pad" aria-labelledby="practice-h">
      <div className="pane-h">
        <h2 id="practice-h">{ws.self ? `From your ${PRO_WORD[ws.coachKind ?? "coach"]}` : "Practice"}</h2>
        <Link className="link small" href={ws.tabHref("plan", !ws.self && open.length === 0)}>
          {ws.self || open.length > 0 ? "See all" : "Assign practice"}
          <Icon name="chevronRight" size={16} />
        </Link>
      </div>
      {open.length === 0 ? (
        <p className="muted small-text">Nothing set right now.</p>
      ) : (
        <ul className="plans compact">
          {open.map((p) => (
            <li key={p.assignment.id}>
              <span className="plan-what">{describeAssignment(p.assignment)}</span>
              <Progress done={p.done} target={p.assignment.target} status={p.status} />
              <span className="plan-due label">
                {dueText(p.daysLeft)} <StatusChip status={p.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ConversationCard({ ws }: { ws: Workspace }) {
  const latest = ws.comments
    .filter((c) => c.kind === "comment")
    .slice(-3)
    .reverse();
  return (
    <section className="pane pane-pad" aria-labelledby="conversation-h">
      <div className="pane-h">
        <h2 id="conversation-h">Latest comments</h2>
      </div>
      {latest.length === 0 ? (
        <p className="muted small-text">
          {ws.self ? `Comments from your ${PRO_WORD[ws.coachKind ?? "coach"]} show up here.` : "Comment on a session from its review page."}
        </p>
      ) : (
        <ul className="quotes">
          {latest.map((c) => {
            const s = ws.sessions.find((x) => x.id === c.sessionId);
            return (
              <li key={c.id}>
                <q>{c.text}</q>
                <span className="label">
                  {c.authorId === ws.viewerId ? "You" : c.authorName} · {timeAgo(c.createdAt, ws.now)}
                  {s && (
                    <>
                      {" · "}
                      <Link href={`${ws.sessionHref(s.id)}#comments`}>
                        {describeMode(s)}, {formatDay(s.startedAt, undefined, false)}
                      </Link>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
