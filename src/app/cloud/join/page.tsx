"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { ErrorState, Skeleton } from "@/components/States";
import { BackendError, type CoachInviteLookup } from "@/lib/backend";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { formatLongDay, initials } from "@/lib/domain/format";
import { inviteHeadline, invitePractice, inviteScope, proTitle } from "@/lib/domain/invite-context";
import { templateLine } from "@/lib/domain/pro-templates";
import type { CoachLink, ShareScope } from "@/lib/domain/types";
import { useLoad } from "@/lib/useLoad";
import { PublicJoin } from "./PublicJoin";
import "./join.css";

// /cloud/join/?code=… — an athlete opens a professional's invite link, sees
// who's asking in the professional's own terms and exactly what they would
// see, chooses the scope (starting at what they ask for) and accepts (or
// declines). Signed-out visitors see who's asking first (PublicJoin, T-0129),
// then sign up or sign in and come back here through `?next=`. Someone who hasn't finished setting up goes
// on to onboarding after accepting, with the goal prefilled from the
// professional's kind and their practice as the first session (T-0123,
// planning/v1/02 §3.5); an existing account just confirms the share.
export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <Join />
    </Suspense>
  );
}

type Invite = CoachInviteLookup;

const SCOPES: {
  value: ShareScope;
  label: string;
  detail: string;
  icon: IconName;
}[] = [
  {
    value: "curves",
    label: "Scores and curves",
    detail:
      "Scores, notes and the full breathing curve of every session, so they can see where a breath went off.",
    icon: "share",
  },
  {
    value: "scores",
    label: "Scores only",
    detail: "Scores and notes. Your breathing curves stay private to you.",
    icon: "lock",
  },
];

function Join() {
  const auth = useAuth();
  const params = useSearchParams();
  const code = (params.get("code") ?? "").trim().toUpperCase();
  // Signed out: who's asking, then sign up to accept (T-0129). CloudShell lets this page through.
  if (auth.status === "signed-out") return <PublicJoin code={code} />;
  if (auth.status !== "signed-in") return null;

  if (!code) {
    return (
      <Frame>
        <Outcome
          icon="alert"
          tone="warn"
          title="This link is missing its invite code"
        >
          <p>
            Open the link exactly as your coach sent it, including the part
            after <code>?code=</code>. If it still doesn&apos;t work, ask them
            to send a new one.
          </p>
          <Actions />
        </Outcome>
      </Frame>
    );
  }
  if (auth.profile?.role === "coach") {
    return (
      <Frame>
        <Outcome icon="user" tone="info" title="This link is for the athlete">
          <p>
            Ask them to open it on their phone or computer. They sign in or
            create an account, choose what to share and accept. You&apos;re
            signed in as a coach, so it can&apos;t be accepted here.
          </p>
          <div className="row">
            <Link
              className="button"
              data-size="small"
              href="/cloud/athletes/#invite-athlete"
            >
              <Icon name="athletes" size={16} />
              See your invites
            </Link>
          </div>
        </Outcome>
      </Frame>
    );
  }
  return (
    <JoinInvite
      key={code}
      athleteId={auth.user.uid}
      code={code}
      onboarded={Boolean(auth.profile?.preferences?.onboardedAt)}
    />
  );
}

function JoinInvite({
  athleteId,
  code,
  onboarded,
}: {
  athleteId: string;
  code: string;
  onboarded: boolean;
}) {
  const backend = useBackend();
  const router = useRouter();
  const [now] = useState(() => new Date());
  const [answer, setAnswer] = useState<
    | { kind: "accepted"; link: CoachLink | null; scope: ShareScope }
    | { kind: "declined" }
    | null
  >(null);
  const data = useLoad(`join:${athleteId}:${code}`, async () => {
    const invite = await backend.data.getCoachInvite(code);
    if (!invite) return { invite: null, link: null };
    const coaches = await backend.data.listCoaches(athleteId);
    const link = coaches.some((c) => c.uid === invite.coachId)
      ? await backend.data.getCoachLink(invite.coachId, athleteId)
      : null;
    return { invite, link };
  });

  if (data.status === "loading") {
    return (
      <Frame>
        <div className="pane pane-pad">
          <Skeleton lines={5} label="Opening the invite…" />
        </div>
      </Frame>
    );
  }
  if (data.status === "error") {
    return (
      <Frame>
        <ErrorState error={data.error} what="the invite" onRetry={data.retry} />
      </Frame>
    );
  }

  const { invite, link } = data.data;
  if (!invite) {
    return (
      <Frame>
        <Outcome icon="alert" tone="warn" title="We couldn't find this invite">
          <p>
            The code <code>{code}</code> doesn&apos;t match any invite. Check
            you opened the whole link, or ask your coach to send a new one.
          </p>
          <Actions />
        </Outcome>
      </Frame>
    );
  }

  const coach = invite.coachName;
  const first = coach.split(" ")[0];

  if (answer?.kind === "accepted") {
    const scope = answer.link?.scope ?? answer.scope;
    if (!onboarded) {
      // New here: onboarding next, set up from this invite.
      return (
        <Frame>
          <div className="pane pane-pad">
            <Skeleton lines={3} label="Setting up your account…" />
          </div>
        </Frame>
      );
    }
    return (
      <Frame>
        <Outcome icon="check" tone="ok" title={`You're sharing with ${coach}`}>
          <p>
            {first} can now see your sessions,{" "}
            {scope === "curves"
              ? "with scores and breathing curves"
              : "with scores only"}
            . You can change this or stop sharing at any time under{" "}
            <b>Settings → Coaches and sharing</b>.
          </p>
          <div className="row">
            <Link className="button" data-size="small" href="/cloud/">
              <Icon name="history" size={16} />
              Go to your sessions
            </Link>
            <Link
              className="button"
              data-variant="ghost"
              data-size="small"
              href="/cloud/account/#coaches"
            >
              <Icon name="share" size={16} />
              Review sharing
            </Link>
          </div>
        </Outcome>
      </Frame>
    );
  }
  if (answer?.kind === "declined") {
    return (
      <Frame>
        <Outcome
          icon="close"
          tone="info"
          title={`You declined ${coach}'s invite`}
        >
          <p>
            Nothing was shared. If you change your mind, ask {first} to send a
            new link, or create an invite code yourself under <b>Settings → Coaches and sharing</b>.
          </p>
          <Actions />
        </Outcome>
      </Frame>
    );
  }

  const expired =
    invite.status === "pending" &&
    Date.parse(invite.expiresAt) <= now.getTime();
  if (invite.status !== "pending" || expired) {
    return (
      <Frame>
        <Closed invite={invite} expired={expired} link={link} />
      </Frame>
    );
  }

  return (
    <Consent
      athleteId={athleteId}
      invite={invite}
      link={link}
      onAnswered={(a) => {
        setAnswer(a);
        if (a.kind === "accepted" && !onboarded) {
          router.replace(`/cloud/welcome/?invite=${encodeURIComponent(invite.code)}`);
        }
      }}
      onInvalid={data.retry}
    />
  );
}

/** Already used, declined, revoked or expired: say which, and what to do next. */
function Closed({
  invite,
  expired,
  link,
}: {
  invite: Invite;
  expired: boolean;
  link: CoachLink | null;
}) {
  const coach = invite.coachName;
  const first = coach.split(" ")[0];
  if (link) {
    return (
      <Outcome icon="check" tone="ok" title={`You already share with ${coach}`}>
        <p>
          {first} sees your sessions with{" "}
          {link.scope === "curves"
            ? "scores and breathing curves"
            : "scores only"}
          , since {formatLongDay(link.createdAt)}.{" "}
          {invite.status === "accepted"
            ? ""
            : "This link can't be used any more. "}
          You can change what {first} sees or stop sharing at any time under{" "}
          <b>Settings → Coaches and sharing</b>.
        </p>
        <Actions sharing />
      </Outcome>
    );
  }
  const text: Record<string, { title: string; body: ReactNode }> = {
    expired: {
      title: "This invite has expired",
      body: (
        <>
          Invite links last 14 days, and this one ran out on{" "}
          {formatLongDay(invite.expiresAt)}. Ask {first} to send you a new one.
        </>
      ),
    },
    accepted: {
      title: "This invite has already been used",
      body: (
        <>
          Someone accepted it with another account. If that wasn&apos;t you, ask{" "}
          {first} to send you a new link.
        </>
      ),
    },
    declined: {
      title: "This invite was declined",
      body: (
        <>
          Nothing was shared. If you&apos;ve changed your mind, ask {first} to
          send you a new link, or create an invite code yourself under{" "}
          <b>Settings → Coaches and sharing</b>.
        </>
      ),
    },
    revoked: {
      title: `${coach} cancelled this invite`,
      body: (
        <>
          Nothing was shared. If you were expecting it, ask {first} to send a
          new link.
        </>
      ),
    },
  };
  const t = text[expired ? "expired" : invite.status];
  return (
    <Outcome icon="alert" tone="warn" title={t.title}>
      <p>{t.body}</p>
      <Actions sharing />
    </Outcome>
  );
}

function Consent({
  athleteId,
  invite,
  link,
  onAnswered,
  onInvalid,
}: {
  athleteId: string;
  invite: Invite;
  link: CoachLink | null;
  onAnswered: (
    a:
      | { kind: "accepted"; link: CoachLink | null; scope: ShareScope }
      | { kind: "declined" },
  ) => void;
  onInvalid: () => void;
}) {
  const backend = useBackend();
  // Starts at what the professional asks for; the person can lower it before accepting (§3.5).
  const requested = inviteScope(invite);
  const [scope, setScope] = useState<ShareScope>(link?.scope ?? requested);
  const title = proTitle(invite);
  const practice = invitePractice(invite.coachKind, invite.practice);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [error, setError] = useState("");
  const coach = invite.coachName;
  const first = coach.split(" ")[0];
  const curves = scope === "curves";

  async function respond(accept: boolean) {
    setBusy(accept ? "accept" : "decline");
    setError("");
    try {
      if (accept) {
        const result = await backend.data.respondToCoachInvite(
          athleteId,
          invite.code,
          { accept: true, scope },
        );
        onAnswered({ kind: "accepted", link: result, scope });
      } else {
        await backend.data.respondToCoachInvite(athleteId, invite.code, {
          accept: false,
        });
        onAnswered({ kind: "declined" });
      }
    } catch (e) {
      setBusy(null);
      if (e instanceof BackendError && e.code === "invite-invalid") {
        onInvalid();
        return;
      }
      setError(
        e instanceof BackendError && e.code === "permission-denied"
          ? "Only athlete accounts can accept an invite. Sign in with the account you use in the Breathband app."
          : "Couldn't send your answer. Check your connection and try again.",
      );
    }
  }

  const willSee: { icon: IconName; text: ReactNode }[] = [
    {
      icon: "history",
      text: (
        <>
          <b>All your sessions</b>, including the ones you recorded before
          today, and new ones as the app uploads them: date, type (paced or
          open) and length
        </>
      ),
    },
    {
      icon: "dashboard",
      text: (
        <>
          <b>Scores</b>: Total Breath Score, timing and depth for each inhale
          and exhale, and breathing rate
        </>
      ),
    },
    {
      icon: "note",
      text: (
        <>
          <b>Your session notes</b> and comments on your sessions
        </>
      ),
    },
    {
      icon: "plan",
      text: (
        <>
          <b>Your progress</b> on practice they set, and on the targets they set
          for you
        </>
      ),
    },
    ...(curves
      ? [
          {
            icon: "lungs" as const,
            text: (
              <>
                <b>Your breathing curves</b>: the breath-by-breath signal of
                each session against the pacer
              </>
            ),
          },
        ]
      : []),
  ];
  const wontSee: { icon: IconName; text: ReactNode }[] = [
    ...(curves
      ? []
      : [
          {
            icon: "eyeOff" as const,
            text: (
              <>
                Your breathing curves: with scores only, they stay private to
                you
              </>
            ),
          },
        ]),
    { icon: "eyeOff", text: <>Your band&apos;s calibration readings</> },
    {
      icon: "lock",
      text: <>Your password, email settings or anything else in your account</>,
    },
    {
      icon: "pencil",
      text: (
        <>They can&apos;t change or delete your sessions, scores or notes</>
      ),
    },
  ];
  const canDo: { icon: IconName; text: ReactNode }[] = [
    { icon: "comment", text: <>Comment on your sessions and give kudos</> },
    {
      icon: "plan",
      text: (
        <>
          Set practice, like &ldquo;Paced 5-5, 5 minutes, 4 times by
          Friday&rdquo;
        </>
      ),
    },
    { icon: "group", text: <>Include you in live group sessions they run</> },
    {
      icon: "marker",
      text: <>Set targets for your score, breathing rate and sessions a week</>,
    },
    { icon: "print", text: <>Print a progress report of your sessions</> },
  ];

  return (
    <Frame wide>
      <section className="pane jn-ask" aria-labelledby="jn-title">
        <span className="avatar lg jn-avatar" aria-hidden="true">
          {initials(coach)}
        </span>
        <div className="jn-ask-text">
          <span className="label">Invitation to share from your {title}</span>
          <h1 id="jn-title">{inviteHeadline(coach, invite, requested)}</h1>
          <p className="muted">
            You can change this or stop sharing at any time. Nothing is shared
            until you accept: choose what {first} can see, check exactly what
            that means below, then accept or decline. This link works until{" "}
            {formatLongDay(invite.expiresAt)}.
          </p>
        </div>
      </section>

      {link && (
        <p className="jn-notice" role="note">
          <Icon name="info" size={18} />
          <span>
            You already share with {first} (
            {link.scope === "curves" ? "scores and curves" : "scores only"},
            since {formatLongDay(link.createdAt)}). Accepting sets what {first}{" "}
            sees to your choice below. You can also change it under{" "}
            <Link href="/cloud/account/#coaches">Settings</Link>.
          </span>
        </p>
      )}

      {practice && (
        <p className="jn-notice" role="note">
          <Icon name="plan" size={18} />
          <span>
            {first} has set your first practice: <b>{practice.name}</b> (
            {templateLine(practice)}). It starts when you accept, and it&apos;s
            the first session you&apos;ll be offered.
          </span>
        </p>
      )}

      <fieldset className="jn-scopes">
        <legend>
          <h2>What should {first} see?</h2>
        </legend>
        <div className="jn-scope-grid">
          {SCOPES.map((s) => (
            <label key={s.value} className="jn-scope">
              <input
                type="radio"
                name="scope"
                value={s.value}
                checked={scope === s.value}
                disabled={busy !== null}
                onChange={() => setScope(s.value)}
              />
              <span className="jn-scope-icon" aria-hidden="true">
                <Icon name={s.icon} size={20} />
              </span>
              <span className="jn-scope-text">
                <span className="jn-scope-title">{s.label}</span>
                <span className="jn-scope-line">{s.detail}</span>
              </span>
              <span className="jn-scope-check" aria-hidden="true">
                <Icon name="check" size={16} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="jn-detail" aria-live="polite">
        <section className="pane pane-pad" aria-labelledby="jn-see-h">
          <h2 id="jn-see-h">{first} will see</h2>
          <ul className="jn-list">
            {willSee.map((item, i) => (
              <li key={i}>
                <Icon name={item.icon} size={18} />
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="pane pane-pad" aria-labelledby="jn-not-h">
          <h2 id="jn-not-h">{first} won&apos;t see or do</h2>
          <ul className="jn-list" data-tone="off">
            {wontSee.map((item, i) => (
              <li key={i}>
                <Icon name={item.icon} size={18} />
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="pane pane-pad" aria-labelledby="jn-can-h">
          <h2 id="jn-can-h">{first} can</h2>
          <ul className="jn-list">
            {canDo.map((item, i) => (
              <li key={i}>
                <Icon name={item.icon} size={18} />
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="pane pane-pad jn-decide" aria-label="Your answer">
        <p>
          <Icon name="share" size={18} />
          <span>
            You can change what {first} sees, or stop sharing, at any time under{" "}
            <b>Settings → Coaches and sharing</b>. Stopping takes effect straight away.
          </span>
        </p>
        <div className="jn-buttons">
          <button
            type="button"
            className="button"
            disabled={busy !== null}
            onClick={() => respond(true)}
          >
            <Icon name="check" size={18} />
            {busy === "accept"
              ? "Sharing…"
              : `Accept: share ${curves ? "scores and curves" : "scores only"}`}
          </button>
          {confirmDecline ? (
            <span className="jn-confirm">
              <span className="label">
                Decline {first}&apos;s invite? The link stops working.
              </span>
              <button
                type="button"
                className="button"
                data-variant="danger"
                data-size="small"
                disabled={busy !== null}
                onClick={() => respond(false)}
              >
                {busy === "decline" ? "Declining…" : "Decline"}
              </button>
              <button
                type="button"
                className="button"
                data-variant="ghost"
                data-size="small"
                onClick={() => setConfirmDecline(false)}
              >
                Back
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="button"
              data-variant="ghost"
              disabled={busy !== null}
              onClick={() => setConfirmDecline(true)}
            >
              Decline
            </button>
          )}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </Frame>
  );
}

function Frame({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`container review jn${wide ? " jn-wide" : ""}`}>
      {children}
    </div>
  );
}

function Outcome({
  icon,
  tone,
  title,
  children,
}: {
  icon: IconName;
  tone: "ok" | "warn" | "info";
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="pane jn-outcome"
      data-tone={tone}
      aria-labelledby="jn-outcome-h"
    >
      <span className="jn-outcome-icon" aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <div className="jn-outcome-body">
        <h1 id="jn-outcome-h">{title}</h1>
        {children}
      </div>
    </section>
  );
}

function Actions({ sharing = false }: { sharing?: boolean }) {
  return (
    <div className="row">
      <Link className="button" data-size="small" href="/cloud/">
        <Icon name="history" size={16} />
        Go to your sessions
      </Link>
      {sharing && (
        <Link
          className="button"
          data-variant="ghost"
          data-size="small"
          href="/cloud/account/#coaches"
        >
          <Icon name="share" size={16} />
          Sharing
        </Link>
      )}
    </div>
  );
}
