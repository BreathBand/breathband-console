"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { HeadlineScore } from "@/components/Score";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { describeMode, formatDuration, formatSessionDate } from "@/lib/domain/format";
import { defaultPreferences } from "@/lib/domain/preferences";
import { headline } from "@/lib/domain/scores";
import type { OnboardingChoices, UserProfile } from "@/lib/domain/types";
import { useLoad } from "@/lib/useLoad";
import { SAMPLE_LABEL, SAMPLE_PERSON, sampleSessions, type SampleSession } from "../sample-sessions";
import { Waitlist } from "../Waitlist";

/** /cloud/welcome/sample/ — sample-data mode: a made-up person's sessions, for someone without a band yet. */
export default function SamplePage() {
  const auth = useAuth();
  if (auth.status !== "signed-in" || !auth.profile) return null;
  return <Sample key={auth.profile.uid} profile={auth.profile} />;
}

function Sample({ profile }: { profile: UserProfile }) {
  const backend = useBackend();
  const router = useRouter();
  // The signed-in profile is read once; read it again so the page follows the latest choice.
  const current = useLoad(`profile:${profile.uid}`, () => backend.data.getProfile(profile.uid));
  const [sessions] = useState(() => sampleSessions(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setMode(onboarding: OnboardingChoices, next: string | null) {
    if (current.status !== "ready") return;
    setSaving(true);
    setError(null);
    try {
      const prefs = current.data?.preferences ?? profile.preferences ?? defaultPreferences();
      await backend.data.updateProfile(profile.uid, { preferences: { ...prefs, onboarding } });
      if (next) router.replace(next);
      else {
        setSaving(false);
        current.retry();
      }
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "Couldn't save that. Try again.");
    }
  }

  if (current.status === "loading") return <div className="container page"><Skeleton label="Loading sample sessions…" /></div>;
  if (current.status === "error") return <div className="container page"><ErrorState error={current.error} what="your settings" onRetry={current.retry} /></div>;

  const onboarding = current.data?.preferences?.onboarding;
  const on = onboarding?.sampleData === true;
  const canTurnOn = !onboarding || onboarding.bandRoute === "none";

  if (!on) {
    return (
      <div className="container page sample-page">
        <EmptyState title="Sample mode is off" level={1}>
          <p>Your own sessions are on Home.</p>
          <div className="sample-actions">
            {canTurnOn && (
              <button type="button" className="button" disabled={saving} onClick={() => void setMode({ bandRoute: "none", sampleData: true }, null)}>
                Explore sample sessions
              </button>
            )}
            <Link className="button" data-variant="ghost" href="/cloud/">
              Go to my home
            </Link>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container page sample-page">
      <header className="page-head">
        <div>
          <p className="sample-flag">
            <Icon name="eye" size={16} /> {SAMPLE_LABEL} data
          </p>
          <h1>{SAMPLE_PERSON}&rsquo;s sessions</h1>
          <p className="page-lede">
            {SAMPLE_PERSON} is made up. These sample sessions show what Breathband records and scores, so you can look around before your
            band arrives. They aren&rsquo;t your breathing and are never added to your account.
          </p>
        </div>
      </header>

      <ul className="sample-list" aria-label="Sample sessions">
        {sessions.map((s) => (
          <SampleRow key={s.id} sample={s} />
        ))}
      </ul>

      <section className="sample-band" aria-labelledby="sample-band-h">
        <h2 id="sample-band-h">Get a band</h2>
        <Waitlist email={profile.email} />
        <div className="sample-actions">
          <Link className="button" href="/cloud/device/">
            <Icon name="bluetooth" size={18} />
            I have a band now
          </Link>
          <button type="button" className="button" data-variant="ghost" disabled={saving} onClick={() => void setMode({ bandRoute: "none", sampleData: false }, "/cloud/")}>
            {saving ? "Saving…" : "Leave sample mode"}
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

function SampleRow({ sample }: { sample: SampleSession }) {
  const { session } = sample;
  return (
    <li className="sample-row">
      <div className="sample-row-head">
        <span className="sample-tag">{SAMPLE_LABEL}</span>
        <span className="sample-when">{formatSessionDate(session.startedAt)}</span>
        <span className="sample-what">
          {describeMode(session)} · {formatDuration(session.durationSec)}
        </span>
        <HeadlineScore headline={headline(session)} />
      </div>
      <Curve values={sample.preview} label={`${SAMPLE_LABEL}: the first minute of ${SAMPLE_PERSON}'s breathing`} />
      {session.note && <p className="sample-note">{session.note}</p>}
    </li>
  );
}

/** The first minute of a sample session's breathing, as a plain line. */
function Curve({ values, label }: { values: number[]; label: string }) {
  const width = 600;
  const height = 64;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const d = values
    .map((v, i) => `${i ? "L" : "M"}${((i / Math.max(1, values.length - 1)) * width).toFixed(1)} ${(height - 4 - ((v - lo) / span) * (height - 8)).toFixed(1)}`)
    .join("");
  return (
    <svg className="sample-curve" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={d} />
    </svg>
  );
}
