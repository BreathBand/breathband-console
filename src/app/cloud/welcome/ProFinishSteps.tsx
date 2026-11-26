"use client";

import { Icon } from "@/components/Icon";
import { SCOPE_CHOICES, SESSIONS_PER_WEEK_CHOICES, targetsText, withProDefaults } from "@/lib/domain/pro-defaults";
import { templateLine, templatesFor } from "@/lib/domain/pro-templates";
import { PRIVATE_NOTES_HINT, PRO_TERMS_DRAFT_NOTE, PROFESSIONAL_TERMS_POINTS, proTermsBoxes } from "@/lib/domain/pro-terms";
import { nounsFor } from "@/lib/domain/terminology";
import type { ProConsentKind, ProProfile } from "@/lib/domain/types";
import { Ask, Chips } from "./GoalQuestions";

// The professional track's last steps (planning/v1/02 §4.1 steps 6–8): the
// defaults for the people they invite, the practice templates they start with,
// and the professional terms. Nothing is stored until the done step's Finish.

/** Step 7: the targets and sharing scope the people they invite start with. Sessions a week and the scope can be changed. */
export function DefaultsStep({ value, onChange }: { value: ProProfile; onChange: (next: ProProfile) => void }) {
  const p = withProDefaults(value);
  const targets = p.defaultTargets ?? {};
  const people = nounsFor(p.terminology).many;
  return (
    <>
      <h1>Defaults for the {people} you invite</h1>
      <p className="welcome-lede">Where each of your {people} starts. You can change them for anyone later.</p>
      <div className="welcome-asks">
        <Ask question="Sessions a week">
          <Chips
            options={SESSIONS_PER_WEEK_CHOICES.map((n) => ({ id: String(n), label: String(n) }))}
            selected={targets.sessionsPerWeek !== undefined ? [String(targets.sessionsPerWeek)] : []}
            onPick={(n) => onChange({ ...p, defaultTargets: { ...targets, sessionsPerWeek: Number(n) } })}
          />
        </Ask>
        <p className="welcome-hint">
          <Icon name="info" size={16} />
          Starting targets: {targetsText(targets)}.{targets.score === undefined ? " No score target at first." : ""}
        </p>
        <Ask question="What your invites ask them to share">
          <div className="level-list" role="radiogroup" aria-label="What your invites ask them to share">
            {SCOPE_CHOICES.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={p.scopeRequested === s.id} className="level-opt" onClick={() => onChange({ ...p, scopeRequested: s.id })}>
                <span className="level-radio" aria-hidden="true" />
                <span>
                  <b>{s.label}</b>
                  <small>{s.detail}</small>
                </span>
              </button>
            ))}
          </div>
        </Ask>
        <p className="welcome-hint">
          <Icon name="lock" size={16} />
          They choose in the end: each person sees what you ask for and can share less.
        </p>
      </div>
    </>
  );
}

/** Step 8: the practice templates for their kind, ready when they set practice. */
export function TemplatesStep({ value }: { value: ProProfile }) {
  return (
    <>
      <h1>Practice templates</h1>
      <p className="welcome-lede">Ready-made practice for your work. Start from one when you set practice for someone.</p>
      <ul className="welcome-templates" aria-label="Your practice templates">
        {templatesFor(value.kind).map((t) => (
          <li key={t.id}>
            <b>{t.name}</b>
            <span className="welcome-template-line">{templateLine(t)}</span>
            <small>{t.detail}</small>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Step 6 (shown last, before Finish): the professional terms, and a clinician's or educator's acknowledgement. Every box is required. */
export function TermsStep({ value, agreed, onAgreed }: { value: ProProfile; agreed: ProConsentKind[]; onAgreed: (next: ProConsentKind[]) => void }) {
  const boxes = proTermsBoxes(value.kind);
  return (
    <>
      <h1>Professional terms</h1>
      <p className="welcome-lede">The terms for working with people in BreathCloud, in brief.</p>
      <div className="welcome-notice" role="note" aria-label="Draft">
        <Icon name="info" size={18} />
        <div>
          <b>Draft</b>
          <p>{PRO_TERMS_DRAFT_NOTE}</p>
        </div>
      </div>
      <ul className="welcome-terms">
        {PROFESSIONAL_TERMS_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <fieldset className="welcome-agree">
        <legend className="sr-only">Your agreement</legend>
        {boxes.map((b) => (
          <label key={b.kind} className="welcome-check">
            <input
              type="checkbox"
              checked={agreed.includes(b.kind)}
              onChange={(e) => onAgreed(e.target.checked ? [...agreed.filter((k) => k !== b.kind), b.kind] : agreed.filter((k) => k !== b.kind))}
            />
            <span>
              <b>{b.label}</b>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="welcome-hint">
        <Icon name="lock" size={16} />
        Your private notes on each person: {PRIVATE_NOTES_HINT}
      </p>
    </>
  );
}

/** Whether every box on the terms step is ticked. */
export const termsAgreed = (value: ProProfile, agreed: readonly ProConsentKind[]) => proTermsBoxes(value.kind).every((b) => agreed.includes(b.kind));
