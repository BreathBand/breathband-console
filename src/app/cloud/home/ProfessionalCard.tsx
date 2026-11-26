import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Progress } from "@/components/Progress";
import { describeAssignment, dueText, isOpen, timeAgo } from "@/lib/domain/coaching";
import type { Workspace } from "../AthleteWorkspace";
import { PRO_WORD, type Professional } from "./tailor";

/**
 * "From Lena": the professional someone came through, first on their Home
 * (planning/v1/02 §3.5 and §5.1). Their open practice and latest comment, or
 * what happens next when they haven't set any yet.
 */
export function ProfessionalCard({ ws, pro }: { ws: Workspace; pro: Professional }) {
  const first = pro.name.split(" ")[0];
  const plan = ws.plans.filter(isOpen)[0];
  return (
    <section className="pane home-pro" aria-labelledby="pro-h">
      <div className="home-pro-who">
        <span className="home-pro-avatar" aria-hidden="true">
          {first.charAt(0)}
        </span>
        <div>
          <h2 id="pro-h">From {first}</h2>
          <p className="home-small">
            {pro.name}, your {PRO_WORD[pro.kind]}
          </p>
        </div>
      </div>
      <div className="home-pro-body">
        {plan ? (
          <div className="home-plan">
            <span className="plan-what">
              {first} has set your practice: {describeAssignment(plan.assignment)}
            </span>
            <Progress done={plan.done} target={plan.assignment.target} status={plan.status} />
            <span className="plan-due label">{dueText(plan.daysLeft)}</span>
          </div>
        ) : (
          <p className="muted small-text">
            {first} sees your sessions as you record them. Practice {first} sets shows up here.
          </p>
        )}
        <LatestComment ws={ws} />
      </div>
      <Link className="link small" href={ws.tabHref("plan")}>
        Practice
        <Icon name="chevronRight" size={16} />
      </Link>
    </section>
  );
}

/** The newest comment someone else left on one of the athlete's sessions. */
export function LatestComment({ ws }: { ws: Workspace }) {
  const c = ws.comments.filter((x) => x.kind === "comment" && x.authorId !== ws.viewerId).slice(-1)[0];
  if (!c) return null;
  const s = ws.sessions.find((x) => x.id === c.sessionId);
  return (
    <figure className="home-quote">
      <blockquote>“{c.text}”</blockquote>
      <figcaption className="label">
        {c.authorName} · {timeAgo(c.createdAt, ws.now)}
        {s && (
          <>
            {" · "}
            <Link href={`${ws.sessionHref(s.id)}#comments`}>Reply</Link>
          </>
        )}
      </figcaption>
    </figure>
  );
}
