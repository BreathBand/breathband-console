"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { HeadlineScore } from "@/components/Score";
import { describeMode, formatDuration, formatSessionDate, initials } from "@/lib/domain/format";
import { samplePersonLabel } from "@/lib/domain/getting-started";
import { headline } from "@/lib/domain/scores";
import { useTerms } from "../useTerms";
import { SAMPLE_LABEL, SAMPLE_PERSON, sampleSessions } from "../welcome/sample-sessions";
import "./dashboard.css";

const SHOWN = 4;

/**
 * A made-up person on an empty dashboard (planning/v1/02 §4.1 step 11, 03
 * E10), so a new professional sees what a shared practice looks like before
 * anyone joins. Built on screen from T-0109's sample sessions: nothing is
 * stored, and the dashboard stops showing it once a real person joins.
 */
export function SamplePerson() {
  const t = useTerms();
  const [sessions] = useState(() => sampleSessions(new Date()));
  const label = samplePersonLabel(t);
  const latest = sessions[0]?.session;

  return (
    <section className="pane pane-pad sp" aria-labelledby="sp-h">
      <div className="pane-h">
        <h2 id="sp-h">
          {label}: {SAMPLE_PERSON}
        </h2>
        <span className="sample-tag">
          <Icon name="eye" size={14} /> {SAMPLE_LABEL}
        </span>
      </div>
      <p className="muted small-text sp-explain">
        {SAMPLE_PERSON} is made up, to show what you&rsquo;ll see once {t.many} share their sessions with you. Nothing here is in your
        account, and {SAMPLE_PERSON} goes when your first {t.one} joins.
      </p>
      <div className="sp-head">
        <span className="avatar" aria-hidden="true">
          {initials(SAMPLE_PERSON)}
        </span>
        <span className="sp-who">
          <b>{SAMPLE_PERSON}</b>
          <span className="label">{sessions.length} sessions in the last two weeks</span>
        </span>
        {latest && <HeadlineScore headline={headline(latest)} />}
      </div>
      <ul className="feed" aria-label={`${SAMPLE_LABEL} sessions`}>
        {sessions.slice(0, SHOWN).map(({ id, session }) => (
          <li key={id}>
            <span className="feed-body">
              <b>{formatSessionDate(session.startedAt)}</b>
              <span>
                {describeMode(session)} · {formatDuration(session.durationSec)}
              </span>
              {session.note && <q>{session.note}</q>}
            </span>
            <span className="feed-end">
              <HeadlineScore headline={headline(session)} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
