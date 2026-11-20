"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { formatLongDay, initials } from "@/lib/domain/format";
import type { UserProfile } from "@/lib/domain/types";
import { signOutToLanding } from "../CloudShell";
import { AlertRulesSection } from "./AlertRulesForm";

// /cloud/account/ — the signed-in user's own details.
export default function AccountPage() {
  const auth = useAuth();
  if (auth.status !== "signed-in" || !auth.profile) return null;
  return <Account key={auth.profile.uid} profile={auth.profile} />;
}

function Account({ profile }: { profile: UserProfile }) {
  const backend = useBackend();
  const [name, setName] = useState(profile.displayName);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const coach = profile.role === "coach";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    try {
      await backend.data.updateProfile(profile.uid, { displayName: name });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="container review narrow">
      <div className="title-row">
        <h1>Account</h1>
        <span>The same account signs you in to the Breathband app.</span>
      </div>

      <section className="pane pane-pad" aria-labelledby="profile-h">
        <div className="pane-h">
          <h2 id="profile-h">Profile</h2>
        </div>
        <div className="account-who">
          <span className="avatar lg" aria-hidden="true">
            {initials(profile.displayName)}
          </span>
          <dl className="facts">
            <dt>Email</dt>
            <dd>{profile.email}</dd>
            <dt>Account type</dt>
            <dd>{coach ? "Coach" : "Athlete"}</dd>
            <dt>Member since</dt>
            <dd>{formatLongDay(profile.createdAt)}</dd>
          </dl>
        </div>
        <form className="invite-form" onSubmit={onSubmit}>
          <label className="field grow">
            Name shown to {coach ? "your athletes" : "your coaches"}
            <input
              required
              maxLength={80}
              value={name}
              autoComplete="name"
              onChange={(e) => {
                setName(e.target.value);
                setStatus("idle");
              }}
            />
          </label>
          <button type="submit" className="button" disabled={status === "saving" || !name.trim() || name.trim() === profile.displayName}>
            {status === "saving" ? "Saving…" : "Save name"}
          </button>
        </form>
        {status === "saved" && (
          <p className="ok-text" role="status">
            <Icon name="check" size={18} /> Saved
          </p>
        )}
        {status === "error" && (
          <p className="error" role="alert">
            Couldn&apos;t save your name. Try again.
          </p>
        )}
      </section>

      <section className="pane pane-pad" aria-labelledby="access-h">
        <div className="pane-h">
          <h2 id="access-h">{coach ? "Athletes" : "Coaches"}</h2>
        </div>
        <p className="muted">
          {coach ? (
            <>
              Athletes add you with a one-time invite code and choose what you see. Enter new codes on the{" "}
              <Link href="/cloud/athletes/#invite-athlete">Athletes</Link> page, or send an athlete an invite link from there.
            </>
          ) : (
            <>
              Choose which coaches see your sessions, and whether they see your breathing curves, on the{" "}
              <Link href="/cloud/sharing/">Sharing</Link> page.
            </>
          )}
        </p>
      </section>

      {coach && <AlertRulesSection coachId={profile.uid} />}

      <div className="row">
        <button type="button" className="button" data-variant="ghost" onClick={() => signOutToLanding(backend)}>
          <Icon name="signOut" size={18} />
          Sign out
        </button>
      </div>
    </div>
  );
}
