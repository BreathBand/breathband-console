"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/States";
import { AthleteConsole } from "../AthleteConsole";
import { SessionReview } from "./SessionReview";

// /cloud/session/?athlete=<uid>&id=<sessionId>[&type=paced|open]
export default function SessionPage() {
  return (
    <Suspense fallback={null}>
      <SessionDetail />
    </Suspense>
  );
}

function SessionDetail() {
  const params = useSearchParams();
  const athleteId = params.get("athlete");
  const sessionId = params.get("id");

  if (!athleteId || !sessionId) {
    return (
      <div className="container">
        <EmptyState title="This link is missing a session">
          <Link href="/cloud/">Back to BreathCloud</Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <AthleteConsole key={athleteId} athleteId={athleteId} sessionId={sessionId}>
      {(ctx) => {
        const session = ctx.sessions.find((s) => s.id === sessionId);
        if (!session) {
          return (
            <EmptyState title="This session doesn't exist">
              <p className="muted">
                It may have been deleted. <Link href={ctx.overviewHref}>See all sessions</Link>
              </p>
            </EmptyState>
          );
        }
        return <SessionReview key={session.id} session={session} ctx={ctx} />;
      }}
    </AthleteConsole>
  );
}
