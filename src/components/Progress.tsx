import { STATUS_TEXT, type AssignmentStatus } from "@/lib/domain/coaching";

/** Sessions done out of the target, as a bar with the count beside it. */
export function Progress({ done, target, status }: { done: number; target: number; status: AssignmentStatus }) {
  const share = Math.min(1, done / Math.max(1, target));
  return (
    <span className="progress" data-status={status}>
      <span className="progress-bar" aria-hidden="true">
        <span style={{ width: `${share * 100}%` }} />
      </span>
      <span className="progress-n">
        {done}/{target}
        <span className="sr-only"> sessions done</span>
      </span>
    </span>
  );
}

export function StatusChip({ status }: { status: AssignmentStatus }) {
  return (
    <span className="chip" data-status={status}>
      {STATUS_TEXT[status]}
    </span>
  );
}
