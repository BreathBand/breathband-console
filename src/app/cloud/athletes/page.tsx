"use client";

import Link from "next/link";
import { EmptyState } from "@/components/States";
import { useAuth } from "@/lib/backend/BackendProvider";
import { Roster } from "../Roster";

// /cloud/athletes/ — the coach's full roster, and where invite codes are redeemed.
export default function AthletesPage() {
  const auth = useAuth();
  if (auth.status !== "signed-in") return null;

  if (auth.profile?.role !== "coach") {
    return (
      <div className="container">
        <EmptyState title="This page is for coaches">
          <p className="muted">
            To let a coach see your sessions, create an invite code on the <Link href="/cloud/sharing/">Sharing</Link> page.
          </p>
        </EmptyState>
      </div>
    );
  }
  return <Roster coachId={auth.user.uid} />;
}
