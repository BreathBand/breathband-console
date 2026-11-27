"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { ErrorState, Skeleton } from "@/components/States";
import { BackendError } from "@/lib/backend";
import { useBackend } from "@/lib/backend/BackendProvider";
import { track } from "@/lib/track";
import { formatDay } from "@/lib/domain/format";
import { invitePracticeChoices } from "@/lib/domain/invite-context";
import { templateLine, type ProTemplateId } from "@/lib/domain/pro-templates";
import { aPerson } from "@/lib/domain/terminology";
import type { CoachInvite } from "@/lib/domain/types";
import { useLoad } from "@/lib/useLoad";
import { qrShape } from "./invite-qr";
import { useProKind, useTerms } from "./useTerms";
import "./join/join.css";
import "./dashboard/dashboard.css";

type InviteState = CoachInvite["status"] | "expired";

const STATE_TEXT: Record<InviteState, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  revoked: "Revoked",
  expired: "Expired",
};

/** Pending invites past their date can't be accepted any more. */
export function inviteState(
  invite: Pick<CoachInvite, "status" | "expiresAt">,
  now: Date,
): InviteState {
  return invite.status === "pending" &&
    Date.parse(invite.expiresAt) <= now.getTime()
    ? "expired"
    : invite.status;
}

const isEmail = (contact: string) => contact.includes("@");

/** The page an invited athlete opens. */
export function joinUrl(code: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/cloud/join/?code=${encodeURIComponent(code)}`;
}

function message(coachName: string, url: string): string {
  return `${coachName} would like to see your Breathband sessions in BreathCloud. Open this link to choose what to share: ${url}`;
}

function smsHref(phone: string, body: string): string {
  return `sms:${phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(body)}`;
}

function mailHref(email: string, coachName: string, body: string): string {
  const subject = `${coachName} invited you to share your Breathband sessions`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Invite an athlete by text or email: the coach types a name and a phone
 * number or email, gets a link to send, and sees what happened to earlier
 * invites. Nothing is shared until the athlete opens the link and accepts.
 */
export function InviteAthlete({
  coachId,
  onChange,
}: {
  coachId: string;
  onChange: () => void;
}) {
  const backend = useBackend();
  const t = useTerms();
  const [now, setNow] = useState(() => new Date());
  const invites = useLoad(`coach-invites:${coachId}`, () =>
    backend.data.listCoachInvites(coachId),
  );
  const [created, setCreated] = useState<CoachInvite | null>(null);

  // Athletes accept on their own devices: look again when the coach comes back
  // to this tab, and refresh the roster if someone has accepted meanwhile.
  const accepted = useRef<Set<string> | null>(null);
  const retry = invites.retry;
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        setNow(new Date());
        retry();
      }
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [retry]);
  const list = invites.status === "ready" ? invites.data : null;
  useEffect(() => {
    if (!list) return;
    const ids = new Set(
      list.filter((i) => i.status === "accepted").map((i) => i.code),
    );
    const before = accepted.current;
    accepted.current = ids;
    if (before && [...ids].some((id) => !before.has(id))) onChange();
  }, [list, onChange]);

  return (
    <section
      className="pane pane-pad inv"
      aria-labelledby="invite-athlete-h"
      id="invite-athlete"
    >
      <div className="pane-h">
        <h2 id="invite-athlete-h">Invite {aPerson(t)} by text or email</h2>
        <span className="meta">Links last 14 days</span>
      </div>
      <p className="muted small-text inv-explain">
        Nothing is shared until the {t.one} opens the link, sees exactly what
        you&apos;ll see, chooses whether you get their breathing curves or
        scores only, and accepts.
      </p>

      {created ? (
        <CreatedLink invite={created} onAnother={() => setCreated(null)} />
      ) : (
        <InviteForm
          coachId={coachId}
          onCreated={(invite) => {
            setCreated(invite);
            invites.retry();
          }}
        />
      )}

      <div className="inv-sent">
        <h3 className="inv-sent-h">Sent invites</h3>
        {invites.status === "loading" ? (
          <Skeleton lines={2} label="Loading invites…" />
        ) : invites.status === "error" ? (
          <ErrorState
            error={invites.error}
            what="your invites"
            onRetry={invites.retry}
          />
        ) : invites.data.length === 0 ? (
          <p className="muted small-text">None yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="table inv-table">
              <thead>
                <tr>
                  <th>{t.One}</th>
                  <th>Sent to</th>
                  <th>Sent</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invites.data.map((invite) => (
                  <InviteRow
                    key={invite.code}
                    coachId={coachId}
                    invite={invite}
                    state={inviteState(invite, now)}
                    onRevoked={() => {
                      if (created?.code === invite.code) setCreated(null);
                      invites.retry();
                      onChange();
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export function InviteForm({
  coachId,
  onCreated,
}: {
  coachId: string;
  onCreated: (invite: CoachInvite) => void;
}) {
  const backend = useBackend();
  const t = useTerms();
  // T-0123: practice set with the invite becomes the person's first session once they accept.
  const choices = invitePracticeChoices(useProKind());
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [practice, setPractice] = useState<ProTemplateId | "">("");
  const [status, setStatus] = useState<{ busy: boolean; error: string }>({
    busy: false,
    error: "",
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus({ busy: true, error: "" });
    try {
      const invite = await backend.data.createCoachInvite(coachId, {
        athleteName: name,
        contact,
        ...(practice ? { practice } : {}),
      });
      track(backend, "invite_sent", { by: contact.includes("@") ? "email" : "phone", practice: Boolean(practice) });
      setName("");
      setContact("");
      setPractice("");
      setStatus({ busy: false, error: "" });
      onCreated(invite);
    } catch (err) {
      setStatus({
        busy: false,
        error:
          err instanceof BackendError && err.code === "invalid-input"
            ? `Enter the ${t.one}'s name and a valid email address or phone number.`
            : "Couldn't create the invite. Try again.",
      });
    }
  }

  return (
    <form className="inv-form" onSubmit={submit} noValidate>
      <label className="field inv-name">
        {t.One}&apos;s name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          maxLength={80}
          placeholder="Jordan Lee"
        />
      </label>
      <label className="field inv-contact">
        Phone number or email
        <input
          required
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          autoComplete="off"
          maxLength={120}
          placeholder="+1 555 0142 or jordan@example.com"
          aria-invalid={status.error ? true : undefined}
          aria-describedby={status.error ? "inv-error" : undefined}
        />
      </label>
      {choices.length > 0 && (
        <label className="field inv-practice">
          First practice (optional)
          <select value={practice} onChange={(e) => setPractice(e.target.value as ProTemplateId | "")}>
            <option value="">None for now</option>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {templateLine(c)}
              </option>
            ))}
          </select>
        </label>
      )}
      <button className="button" type="submit" disabled={status.busy}>
        <Icon name="plus" size={18} />
        {status.busy ? "Creating…" : "Create invite link"}
      </button>
      {status.error && (
        <p id="inv-error" role="alert" className="error inv-error">
          {status.error}
        </p>
      )}
    </form>
  );
}

/** The new link, ready to copy, scan or send the way the coach reaches this athlete. */
export function CreatedLink({
  invite,
  onAnother,
}: {
  invite: CoachInvite;
  onAnother: () => void;
}) {
  const url = joinUrl(invite.code);
  const body = message(invite.coachName, url);
  const email = isEmail(invite.contact);
  const first = invite.athleteName.split(" ")[0];
  return (
    <div className="inv-created" role="status">
      <p className="ok-text inline">
        <Icon name="check" size={18} />
        Invite for {invite.athleteName} is ready. Send {first} this link:
      </p>
      <div className="inv-share">
        <output className="inv-link">{url}</output>
        <InviteQr url={url} name={invite.athleteName} />
      </div>
      <div className="inv-actions">
        <CopyButton text={url} />
        {email ? (
          <a
            className="button"
            data-size="small"
            href={mailHref(invite.contact, invite.coachName, body)}
          >
            <Icon name="mail" size={16} />
            Send by email
          </a>
        ) : (
          <a
            className="button"
            data-size="small"
            href={smsHref(invite.contact, body)}
          >
            <Icon name="phone" size={16} />
            Send by text
          </a>
        )}
        <button
          type="button"
          className="link small inv-another"
          onClick={onAnother}
        >
          <Icon name="plus" size={14} />
          Invite someone else
        </button>
      </div>
      <p className="label">
        {email ? "Opens your email app" : "Opens your messages app"} with a
        short note to {invite.contact}. The link works until{" "}
        {formatDay(invite.expiresAt)}.
      </p>
    </div>
  );
}

/** The invite link as a QR code, drawn dark on white in either theme so phones can read it. */
function InviteQr({ url, name }: { url: string; name: string }) {
  const qr = qrShape(url);
  return (
    <figure className="inv-qr">
      <svg viewBox={`0 0 ${qr.box} ${qr.box}`} role="img" aria-label={`QR code of the invite link for ${name}`} shapeRendering="crispEdges">
        <rect width={qr.box} height={qr.box} className="inv-qr-ground" />
        <path d={qr.path} className="inv-qr-ink" />
      </svg>
      <figcaption className="label">Or let them scan this with their phone&apos;s camera.</figcaption>
    </figure>
  );
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      className="button"
      data-variant="ghost"
      data-size="small"
      onClick={copy}
      aria-live="polite"
    >
      <Icon name={state === "copied" ? "check" : "share"} size={16} />
      {state === "copied"
        ? "Copied"
        : state === "failed"
          ? "Couldn't copy"
          : "Copy link"}
    </button>
  );
}

function InviteRow({
  coachId,
  invite,
  state,
  onRevoked,
}: {
  coachId: string;
  invite: CoachInvite;
  state: InviteState;
  onRevoked: () => void;
}) {
  const backend = useBackend();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function revoke() {
    setBusy(true);
    setError(false);
    try {
      await backend.data.revokeCoachInvite(coachId, invite.code);
      setConfirming(false);
      onRevoked();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td className="inv-who">{invite.athleteName}</td>
      <td className="sub inv-to">
        <Icon name={isEmail(invite.contact) ? "mail" : "phone"} size={14} />
        {invite.contact}
      </td>
      <td className="sub inv-when">{formatDay(invite.createdAt)}</td>
      <td className="inv-state">
        <span className="chip" data-invite={state}>
          {STATE_TEXT[state]}
        </span>
        {state === "pending" && (
          <span className="label inv-until">
            {" "}
            until {formatDay(invite.expiresAt, undefined, false)}
          </span>
        )}
      </td>
      <td className="inv-row-actions">
        {state === "pending" &&
          (confirming ? (
            <span className="inv-confirm">
              <span className="label">
                Revoke {invite.athleteName.split(" ")[0]}&apos;s link?
              </span>
              <button
                type="button"
                className="button"
                data-variant="danger"
                data-size="small"
                disabled={busy}
                onClick={revoke}
              >
                {busy ? "Revoking…" : "Revoke"}
              </button>
              <button
                type="button"
                className="button"
                data-variant="ghost"
                data-size="small"
                onClick={() => setConfirming(false)}
              >
                Keep
              </button>
            </span>
          ) : (
            <span className="inv-confirm">
              <CopyButton text={joinUrl(invite.code)} />
              <button
                type="button"
                className="button"
                data-variant="ghost"
                data-size="small"
                onClick={() => setConfirming(true)}
              >
                Revoke
              </button>
            </span>
          ))}
        {error && (
          <span className="error small-text" role="alert">
            Couldn&apos;t revoke. Try again.
          </span>
        )}
      </td>
    </tr>
  );
}
