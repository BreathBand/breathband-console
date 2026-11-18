"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useBackend } from "@/lib/backend/BackendProvider";
import { describeMode, formatDuration, formatSessionDate } from "@/lib/domain/format";
import { useLoad } from "@/lib/useLoad";
import { WaveformPreview } from "./WaveformPreview";

// /cloud/session/?athlete=<uid>&id=<sessionId>
export default function SessionPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <SessionDetail />
    </Suspense>
  );
}

function SessionDetail() {
  const backend = useBackend();
  const params = useSearchParams();
  const athleteId = params.get("athlete");
  const sessionId = params.get("id");
  const key = athleteId && sessionId ? `session:${athleteId}/${sessionId}` : null;

  const session = useLoad(key, () => backend.data.getSession(athleteId!, sessionId!));
  const loaded = session.status === "ready" ? session.data : null;
  const waveform = useLoad(loaded && `waveform:${key}`, () => backend.data.getWaveform(loaded!));

  const back = (
    <Link href={`/cloud/sessions/?athlete=${encodeURIComponent(athleteId ?? "")}`}>← All sessions</Link>
  );

  if (!key) return <p className="error">This link is missing a session.</p>;
  if (session.status === "loading") return <p className="muted">Loading session…</p>;
  if (session.status === "error" || !session.data) {
    return (
      <div className="stack">
        {back}
        <p className="error">This session doesn&apos;t exist or you don&apos;t have access to it.</p>
      </div>
    );
  }

  const s = session.data;
  return (
    <div className="stack">
      {back}
      <h1>{formatSessionDate(s.startedAt)}</h1>
      <p className="muted">
        {describeMode(s)} · {formatDuration(s.durationSec)} · recorded with app {s.appVersion}
      </p>

      <dl className="row card" style={{ gap: 32 }}>
        {s.scores && (
          <>
            <Stat label="Overall" value={`${s.scores.overall}%`} />
            <Stat label="Depth" value={`${s.scores.depth}%`} />
            <Stat label="Timing" value={`${s.scores.timing}%`} />
          </>
        )}
        <Stat label="Resp. rate" value={s.respirationRateBpm ? `${s.respirationRateBpm} BPM` : "–"} />
      </dl>

      <section className="card stack">
        <h2>Breathing</h2>
        {waveform.status === "ready" ? (
          <WaveformPreview waveform={waveform.data} />
        ) : waveform.status === "error" ? (
          <p className="error">Couldn&apos;t load the breathing signal.</p>
        ) : (
          <p className="muted">Loading signal…</p>
        )}
      </section>

      {s.note && (
        <section className="card">
          <h2>Note</h2>
          <p>{s.note}</p>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="muted">{label}</dt>
      <dd style={{ fontSize: "1.5rem", fontWeight: 700 }}>{value}</dd>
    </div>
  );
}
