"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { ErrorState, Skeleton } from "@/components/States";
import { useBackend } from "@/lib/backend/BackendProvider";
import { initials } from "@/lib/domain/format";
import { inviteHeadline, invitePractice, inviteScope, proTitle } from "@/lib/domain/invite-context";
import { templateLine } from "@/lib/domain/pro-templates";
import { useLoad } from "@/lib/useLoad";
import { AuthFrame } from "../auth/AuthFrame";

/**
 * /cloud/join/ for a visitor who isn't signed in (T-0129, planning/v1/02 §2):
 * who invited them, in the professional's own terms, what they ask to see and
 * the first practice, then sign up (or sign in) to accept. The code rides
 * along in `?next=`, so they come back to the join page to choose the scope
 * and accept. The public lookup only answers a pending invite, with the
 * minimum; every other code gets the same neutral message.
 */
export function PublicJoin({ code }: { code: string }) {
  return (
    <AuthFrame>
      <div className="bc-auth-stack">
        {code ? (
          <Preview code={code} />
        ) : (
          <Unavailable title="This link is missing its invite code" next={null}>
            Open the link exactly as it was sent to you, including the part after <code>?code=</code>. If it still
            doesn&apos;t work, ask the person who sent it for a new one.
          </Unavailable>
        )}
      </div>
    </AuthFrame>
  );
}

const joinPath = (code: string) => `/cloud/join/?code=${encodeURIComponent(code)}`;
const withNext = (href: string, next: string | null) => (next ? `${href}?next=${encodeURIComponent(next)}` : href);

function Preview({ code }: { code: string }) {
  const backend = useBackend();
  const data = useLoad(`join-public:${code}`, () => backend.data.getPublicCoachInvite(code));
  const next = joinPath(code);

  if (data.status === "loading") return <Skeleton lines={4} label="Opening the invite…" />;
  if (data.status === "error") return <ErrorState error={data.error} what="the invite" onRetry={data.retry} />;

  const invite = data.data;
  if (!invite) {
    return (
      <Unavailable title="This invite isn't available" next={next}>
        The link may have expired, been used or been cancelled, or part of it may be missing. Ask the person who sent it
        for a new one. If you&apos;ve already accepted it, sign in to see who you share with.
      </Unavailable>
    );
  }

  const name = invite.coachName;
  const first = name.split(" ")[0];
  const practice = invitePractice(invite.coachKind, invite.practice);

  return (
    <section className="bc-card jn-public" aria-labelledby="jn-public-h">
      <span className="avatar lg jn-avatar" aria-hidden="true">
        {initials(name)}
      </span>
      <span className="bc-eyebrow">Invitation to share from your {proTitle(invite)}</span>
      <h1 id="jn-public-h">{inviteHeadline(name, invite, inviteScope(invite))}</h1>
      <p className="bc-lede">
        You can change this or stop sharing at any time. Nothing is shared until you have an account and accept, and
        before you do, you choose what {first} can see.
      </p>
      {practice && (
        <p className="bc-note" role="note">
          <Icon name="plan" size={18} />
          <span>
            {first} has set your first practice: <b>{practice.name}</b> ({templateLine(practice)}). It starts when you
            accept.
          </span>
        </p>
      )}
      <div className="bc-actions">
        <Link className="button bc-submit" href={withNext("/cloud/signup/", next)}>
          Sign up to accept
        </Link>
        <Link className="button bc-ghost" href={withNext("/cloud/login/", next)}>
          I already have an account
        </Link>
      </div>
    </section>
  );
}

/** Unknown, expired, used, cancelled or missing: the same neutral message for each, naming nobody. */
function Unavailable({ title, next, children }: { title: string; next: string | null; children: ReactNode }) {
  return (
    <section className="bc-card" aria-labelledby="jn-public-h">
      <h1 id="jn-public-h">{title}</h1>
      <p className="bc-lede">{children}</p>
      <div className="bc-actions">
        <Link className="button bc-ghost" href={withNext("/cloud/login/", next)}>
          Sign in
        </Link>
        <Link className="button bc-ghost" href="/cloud/">
          About BreathCloud
        </Link>
      </div>
    </section>
  );
}
