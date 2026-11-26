"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { ErrorState, Skeleton } from "@/components/States";
import { useBackend } from "@/lib/backend/BackendProvider";
import { defaultFlags, rulesInForce } from "@/lib/domain/default-flags";
import { DEFAULT_ALERTS, type AlertRules } from "@/lib/domain/types";
import { useLoad } from "@/lib/useLoad";
import { useProKind, useTerms } from "../useTerms";

/** What puts someone under "Needs a look" on the coach's dashboard and roster. */
export function AlertRulesSection({ coachId }: { coachId: string }) {
  const backend = useBackend();
  const kind = useProKind();
  const rules = useLoad(`alerts:${coachId}:${kind}`, async () => rulesInForce(await backend.data.getAlertRules(coachId), kind));
  return (
    <section className="pane pane-pad" aria-labelledby="alerts-h" id="alerts">
      <div className="pane-h">
        <h2 id="alerts-h">What needs a look</h2>
        <span className="meta">Flags on your dashboard and roster</span>
      </div>
      {rules.status === "loading" ? (
        <Skeleton lines={4} />
      ) : rules.status === "error" ? (
        <ErrorState error={rules.error} what="your alert rules" onRetry={rules.retry} />
      ) : (
        <RulesForm key={JSON.stringify(rules.data)} coachId={coachId} initial={rules.data} />
      )}
    </section>
  );
}

function RulesForm({ coachId, initial }: { coachId: string; initial: AlertRules }) {
  const backend = useBackend();
  const kind = useProKind();
  const t = useTerms();
  const [r, setR] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = JSON.stringify(r) !== JSON.stringify(initial) && status !== "saved";
  const change = (next: AlertRules) => {
    setR(next);
    setStatus("idle");
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await backend.data.saveAlertRules(coachId, r);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const numberRule = (key: "missedDays" | "scoreDrop" | "belowTarget", label: (n: number) => string, field: { min: number; max: number; step: number; unit: string }) => {
    const on = r[key] !== null;
    return (
      <li className="rule">
        <label className="rule-toggle">
          <input type="checkbox" checked={on} onChange={() => change({ ...r, [key]: on ? null : DEFAULT_ALERTS[key] })} />
          <span>{label(r[key] ?? DEFAULT_ALERTS[key]!)}</span>
        </label>
        {on && (
          <label className="rule-value">
            <input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={r[key]!}
              onChange={(e) => change({ ...r, [key]: Math.max(field.min, Math.min(field.max, Number(e.target.value) || field.min)) })}
            />
            <span className="label">{field.unit}</span>
          </label>
        )}
      </li>
    );
  };
  const boolRule = (key: "trendingDown" | "rateOutOfRange" | "practiceBehind", text: string) => (
    <li className="rule">
      <label className="rule-toggle">
        <input type="checkbox" checked={r[key]} onChange={() => change({ ...r, [key]: !r[key] })} />
        <span>{text}</span>
      </label>
    </li>
  );

  return (
    <form onSubmit={submit}>
      <ul className="rules-list">
        {numberRule("missedDays", (n) => `No session for ${n} days or more`, { min: 1, max: 60, step: 1, unit: "days" })}
        {numberRule("scoreDrop", (n) => `Latest score ${n} points or more below their recent average`, { min: 0.5, max: 9, step: 0.5, unit: "points" })}
        {numberRule("belowTarget", (n) => `${n} or more of the last 5 scored sessions under their score target`, { min: 1, max: 5, step: 1, unit: "of 5" })}
        {boolRule("trendingDown", "Scores falling steadily over the last three weeks")}
        {boolRule("rateOutOfRange", "An open session with a breathing rate outside their target range")}
        {boolRule("practiceBehind", "Practice falling behind its pace")}
      </ul>
      <p className="label">Comments waiting for your reply always show. Each {t.one}&apos;s targets are on their Trends tab.</p>
      <div className="row">
        <button type="submit" className="button" data-size="small" disabled={!dirty || status === "saving"}>
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        <button type="button" className="button" data-variant="ghost" data-size="small" onClick={() => change(defaultFlags(kind))}>
          Back to defaults
        </button>
        {status === "saved" && (
          <span className="ok-text inline" role="status">
            <Icon name="check" size={16} /> Saved
          </span>
        )}
        {status === "error" && (
          <span className="error" role="alert">
            Couldn&apos;t save. Try again.
          </span>
        )}
      </div>
    </form>
  );
}
