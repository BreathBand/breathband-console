import type { Ring } from "@/lib/domain/habit";

const SIZE = 56;
const STROKE = 6;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/**
 * The daily ring (J1): today's minutes against the minutes a day the person
 * planned. It fills quietly and closes at the plan; nothing animates or chimes.
 */
export function DailyRing({ ring }: { ring: Ring }) {
  return (
    <div className="home-ring" data-closed={ring.closed || undefined}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle className="ring-track" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE} />
        {ring.fraction > 0 && (
          <circle
            className="ring-fill"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            strokeWidth={STROKE}
            strokeDasharray={`${(ring.fraction * C).toFixed(2)} ${C.toFixed(2)}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
      </svg>
      <p>
        <span className="label">Today</span>
        <span>
          <b className="display">{ring.minutes}</b> of {ring.goalMinutes} min{ring.closed ? ", ring closed" : ""}
        </span>
      </p>
    </div>
  );
}
