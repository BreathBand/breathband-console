"use client";

import Link from "next/link";
import { BackendError } from "@/lib/backend";
import { useBackend } from "@/lib/backend/BackendProvider";
import { describeMode, formatDuration, formatSessionDate } from "@/lib/domain/format";
import { useLoad } from "@/lib/useLoad";

export function SessionList({ athleteId }: { athleteId: string }) {
  const backend = useBackend();
  const sessions = useLoad(`sessions:${athleteId}`, () => backend.data.listSessions(athleteId));

  if (sessions.status === "loading") return <p className="muted">Loading sessions…</p>;
  if (sessions.status === "error") {
    const denied = sessions.error instanceof BackendError && sessions.error.code === "permission-denied";
    return (
      <p className="error">
        {denied ? "You don't have access to this athlete's sessions." : "Couldn't load sessions."}
      </p>
    );
  }
  if (sessions.data.length === 0) {
    return (
      <p className="muted">
        No sessions yet. Record one in the Breathband app and it will appear here.
      </p>
    );
  }

  return (
    <ul className="list">
      {sessions.data.map((s) => (
        <li key={s.id} className="card row" style={{ justifyContent: "space-between" }}>
          <Link
            href={`/cloud/session/?athlete=${encodeURIComponent(athleteId)}&id=${encodeURIComponent(s.id)}`}
          >
            {formatSessionDate(s.startedAt)}
          </Link>
          <span className="muted">
            {describeMode(s)} · {formatDuration(s.durationSec)}
          </span>
          <span>{s.scores ? `${s.scores.overall}%` : `${s.respirationRateBpm ?? "–"} BPM`}</span>
        </li>
      ))}
    </ul>
  );
}
