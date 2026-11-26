"use client";

import { Icon } from "@/components/Icon";
import { DAILY_MINUTES, SESSIONS_A_WEEK, WEEKDAYS, type Plan } from "@/lib/domain/goal-questions";
import { goalOf } from "@/lib/domain/preferences";
import type { BreathGoal, ReminderPreferences } from "@/lib/domain/types";
import { Ask, Chips, toggleDay } from "./GoalQuestions";

/** "every day", "weekdays", or "Tue, Thu, Sat". */
export function daysText(days: ReminderPreferences["days"]): string {
  if (days.length === 7) return "every day";
  if (days.length === 5 && !days.includes("sat") && !days.includes("sun")) return "weekdays";
  return WEEKDAYS.filter((d) => days.includes(d.id))
    .map((d) => d.label)
    .join(", ");
}

/** Step 7: how often, how long a day, and when to remind. Prefilled from the track and its answers. */
export function PlanStep({ goal, plan, onChange }: { goal: BreathGoal; plan: Plan; onChange: (next: Plan) => void }) {
  const r = plan.reminders;
  const setReminders = (next: Partial<ReminderPreferences>) => onChange({ ...plan, reminders: { ...r, ...next } });
  return (
    <>
      <h1>Your plan</h1>
      <p className="welcome-lede">
        Set up for <b>{goalOf(goal).label}</b> from your answers. Change anything.
      </p>
      <div className="welcome-asks">
        <Ask question="Weekly goal" hint="A coach's target replaces it once you share with them.">
          <div className="seg" role="group" aria-label="Sessions a week">
            {SESSIONS_A_WEEK.map((n) => (
              <button key={n} type="button" aria-pressed={plan.sessionsPerWeek === n} onClick={() => onChange({ ...plan, sessionsPerWeek: n })}>
                {n}
              </button>
            ))}
          </div>
          <small>sessions a week</small>
        </Ask>
        <Ask question="Minutes a day" hint="How long you'd like to breathe each day.">
          <div className="seg" role="group" aria-label="Minutes a day">
            {DAILY_MINUTES.map((m) => (
              <button key={m} type="button" aria-pressed={plan.dailyMinutes === m} onClick={() => onChange({ ...plan, dailyMinutes: m })}>
                {m} min
              </button>
            ))}
          </div>
        </Ask>
        <Ask question="Reminder">
          <div className="seg" role="group" aria-label="Reminders">
            {[true, false].map((on) => (
              <button
                key={String(on)}
                type="button"
                aria-pressed={r.enabled === on}
                onClick={() => setReminders({ enabled: on, days: on && r.days.length === 0 ? WEEKDAYS.map((d) => d.id) : r.days })}
              >
                {on ? "On" : "Off"}
              </button>
            ))}
          </div>
          {r.enabled && (
            <>
              <label className="field welcome-time">
                Reminder time
                <input type="time" value={r.time} required onChange={(e) => e.target.value && setReminders({ time: e.target.value })} />
              </label>
              <Chips
                label="Days"
                options={WEEKDAYS}
                selected={r.days}
                onPick={(d) => {
                  const days = toggleDay(r.days, d);
                  setReminders(days.length ? { days } : { days, enabled: false });
                }}
              />
            </>
          )}
        </Ask>
      </div>
      <p className="welcome-hint">
        <Icon name="info" size={16} />
        Reminders aren&rsquo;t sent yet. We&rsquo;ll use this time once they are.
      </p>
    </>
  );
}
