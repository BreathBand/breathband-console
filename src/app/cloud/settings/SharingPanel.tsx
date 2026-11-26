"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { ErrorState, Skeleton } from "@/components/States";
import { useBackend } from "@/lib/backend/BackendProvider";
import { formatLongDay, initials } from "@/lib/domain/format";
import type { CoachLink, Invite, ShareScope, UserProfile } from "@/lib/domain/types";
import { useLoad } from "@/lib/useLoad";

const SCOPES: { value: ShareScope; label: string; detail: string }[] = [
  { value: "curves", label: "Scores and curves", detail: "Scores, notes and the full breathing curve of every session" },
  { value: "scores", label: "Scores only", detail: "Scores and notes. Your breathing curves stay private" },
];

/** Who can see the athlete's sessions, and invite codes for a new coach. Lives in Settings for athletes. */
export function SharingPanel({ athleteId }: { athleteId: string }) {
  const backend = useBackend();
  const coaches = useLoad(`coaches:${athleteId}`, async () => {
    const people = await backend.data.listCoaches(athleteId);
    const links = await Promise.all(people.map((c) => backend.data.getCoachLink(c.uid, athleteId)));
    return people.map((coach, i) => ({ coach, link: links[i] }));
  });
  const [invite, setInvite] = useState<Invite | null>(null);
  const [inviteScope, setInviteScope] = useState<ShareScope>("curves");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "busy" | "error">("idle");

  async function createInvite() {
    setInviteStatus("busy");
    try {
      setInvite(await backend.data.createInvite(athleteId, inviteScope));
      setInviteStatus("idle");
    } catch {
      setInviteStatus("error");
    }
  }

  return (
    <div className="sharing">
      <p className="muted">
        Coaches you share with can read your sessions, comment and set practice. They can&apos;t change your data.
      </p>
      <div className="sharing-block" aria-labelledby="coaches-h">
        <h3 id="coaches-h">Who can see your sessions</h3>
        {coaches.status === "loading" ? (
          <Skeleton lines={2} />
        ) : coaches.status === "error" ? (
          <ErrorState error={coaches.error} what="your coaches" onRetry={coaches.retry} />
        ) : coaches.data.length === 0 ? (
          <p className="muted">Nobody yet. Create an invite code below and give it to your coach.</p>
        ) : (
          <ul className="people">
            {coaches.data.map(({ coach, link }) => (
              <CoachRow key={coach.uid} athleteId={athleteId} coach={coach} link={link} onChange={coaches.retry} />
            ))}
          </ul>
        )}
      </div>

      <div className="sharing-block" aria-labelledby="invite-h">
        <h3 id="invite-h">
          Invite a coach <small>A code works once and expires after 7 days</small>
        </h3>
        <fieldset className="field scope-pick">
          <legend>What they&apos;ll see</legend>
          <ScopeSeg value={inviteScope} onChange={setInviteScope} />
          <span className="label">{SCOPES.find((s) => s.value === inviteScope)!.detail}. You can change this later.</span>
        </fieldset>
        {invite && (
          <div className="invite-code">
            <span className="label">
              Give this code to your coach ({invite.scope === "curves" ? "scores and curves" : "scores only"})
            </span>
            <output className="code" aria-live="polite">
              {invite.code}
            </output>
            <span className="label">
              Expires{" "}
              {new Date(invite.expiresAt).toLocaleString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
              . They enter it on their Athletes page.
            </span>
          </div>
        )}
        <div className="row">
          <button type="button" className="button" onClick={createInvite} disabled={inviteStatus === "busy"}>
            <Icon name="plus" size={18} />
            {invite ? "Create another code" : "Create invite code"}
          </button>
        </div>
        {inviteStatus === "error" && (
          <p className="error" role="alert">
            Couldn&apos;t create a code. Try again.
          </p>
        )}
      </div>
    </div>
  );
}

function ScopeSeg({ value, onChange, disabled }: { value: ShareScope; onChange: (s: ShareScope) => void; disabled?: boolean }) {
  return (
    <div className="seg" role="group" aria-label="What this coach sees">
      {SCOPES.map((s) => (
        <button key={s.value} type="button" aria-pressed={value === s.value} disabled={disabled} onClick={() => onChange(s.value)}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

function CoachRow({
  athleteId,
  coach,
  link,
  onChange,
}: {
  athleteId: string;
  coach: UserProfile;
  link: CoachLink | null;
  onChange: () => void;
}) {
  const backend = useBackend();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const first = coach.displayName.split(" ")[0];

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      onChange();
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      <span className="avatar" aria-hidden="true">
        {initials(coach.displayName)}
      </span>
      <span className="people-name">
        {coach.displayName}
        <small>
          {coach.email}
          {link && ` · since ${formatLongDay(link.createdAt)}`}
        </small>
      </span>
      {link && (
        <ScopeSeg
          value={link.scope}
          disabled={busy}
          onChange={(scope) =>
            run(() => backend.data.setCoachScope(athleteId, coach.uid, scope), "Couldn't change what they see. Try again.")
          }
        />
      )}
      {confirming ? (
        <span className="row">
          <button
            type="button"
            className="button"
            data-variant="danger"
            data-size="small"
            disabled={busy}
            onClick={() => run(() => backend.data.revokeCoach(athleteId, coach.uid), "Couldn't stop sharing. Try again.")}
          >
            Stop sharing with {first}
          </button>
          <button type="button" className="button" data-variant="ghost" data-size="small" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" className="button" data-variant="ghost" data-size="small" onClick={() => setConfirming(true)}>
          Stop sharing
        </button>
      )}
      {error && (
        <p className="error people-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
