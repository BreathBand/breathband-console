"use client";

import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { asksMood, moodTrend, moodTrendLine, MOOD_WORDS, type SessionMood } from "@/lib/domain/mood";
import { useLoad } from "@/lib/useLoad";
import { examLine, nextExam } from "./focus";
import "./focus.css";

/**
 * Focus's mood trend on Home (J6): how the mood moves from before a session to
 * after, over the last two weeks. Nothing when the check-in is off; a hint
 * until a session has both check-ins.
 */
export function FocusMood() {
  const auth = useAuth();
  const backend = useBackend();
  const uid = auth.status === "signed-in" ? auth.user.uid : null;
  const on = auth.status === "signed-in" && asksMood(auth.profile?.preferences);
  const checkins = useLoad(uid && on ? `mood:${uid}` : null, () => backend.data.listMoodCheckins(uid!));
  if (!on || checkins.status !== "ready") return null;
  const trend = moodTrend(checkins.data, new Date());
  if (!trend) {
    return (
      <div className="home-mood" data-empty="true">
        <p className="home-small">Check in on your mood before and after a session to see how breathing moves it.</p>
      </div>
    );
  }
  return (
    <div className="home-mood">
      <MoodBars sessions={trend.recent} />
      <p>
        <span className="label">Mood, last 2 weeks</span>
        <span>{moodTrendLine(trend)}</span>
        <span className="home-small">
          {trend.sessions} {trend.sessions === 1 ? "session" : "sessions"} with both check-ins
        </span>
      </p>
    </div>
  );
}

const BAR_W = 12;
const H = 44;
const y = (mood: number) => 4 + ((5 - mood) / 4) * (H - 8);

/** Each recent session as a stroke from the mood before (hollow) to after (filled), oldest on the left. */
function MoodBars({ sessions }: { sessions: SessionMood[] }) {
  const width = sessions.length * BAR_W;
  const label = `Before and after, oldest first: ${sessions.map((s) => `${MOOD_WORDS[s.before]} to ${MOOD_WORDS[s.after]}`).join("; ")}.`;
  return (
    <svg className="mood-bars" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={label}>
      {sessions.map((s, i) => {
        const x = i * BAR_W + BAR_W / 2;
        const way = s.change > 0 ? "up" : s.change < 0 ? "down" : "same";
        return (
          <g key={s.sessionId} data-way={way}>
            <line x1={x} x2={x} y1={y(s.before)} y2={y(s.after)} />
            <circle className="mood-before" cx={x} cy={y(s.before)} r={2.5} />
            <circle className="mood-after" cx={x} cy={y(s.after)} r={3} />
          </g>
        );
      })}
    </svg>
  );
}

/** Focus's exam countdown on Home, from the exam dates given at onboarding. Nothing without one ahead. */
export function FocusExams() {
  const auth = useAuth();
  const prefs = auth.status === "signed-in" ? auth.profile?.preferences : null;
  const dates = prefs?.goal === "focus" ? (prefs.goalDetails?.focus?.examDates ?? []) : [];
  const exam = nextExam(dates, new Date());
  if (!exam) return null;
  const when = new Date(`${exam.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return (
    <p className="home-exam">
      <b>{examLine(exam)}</b> <span className="home-small">{when}{exam.later > 0 ? `, then ${exam.later} more` : ""}</span>
    </p>
  );
}
