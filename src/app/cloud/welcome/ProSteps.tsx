"use client";

import { Icon } from "@/components/Icon";
import { MAX_SPORT_OTHER } from "@/lib/domain/goal-questions";
import {
  CLINICIAN_PROFESSIONS,
  COACH_LEVELS,
  COACH_SPORTS,
  EDUCATOR_ROLES,
  MAX_COUNTRY,
  MAX_ORGANISATION,
  PRO_KINDS,
  USE_CASES,
} from "@/lib/domain/pro-profile";
import { DEFAULT_TERMS, nounsFor, PEOPLE_TERMS } from "@/lib/domain/terminology";
import type { ProKind, ProProfile } from "@/lib/domain/types";
import { Ask, Chips } from "./GoalQuestions";

// The professional track's first steps (planning/v1/02 §4.1 steps 2–5):
// what kind of work, the practice, what it's for, and how people are called.
// Every one is required; nothing is stored until the last step's Finish.

const toggle = <T,>(list: T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/** Step 2: coach, clinician or educator. */
export function KindStep({ kind, onPick, first }: { kind: ProKind | null; onPick: (kind: ProKind) => void; first: string }) {
  return (
    <>
      <h1>What kind of work do you do, {first}?</h1>
      <p className="welcome-lede">This sets the questions that follow and the words BreathCloud uses for the people you work with.</p>
      <div className="level-list" role="radiogroup" aria-label="Your work">
        {PRO_KINDS.map((k) => (
          <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className="level-opt" onClick={() => onPick(k.id)}>
            <span className="level-radio" aria-hidden="true" />
            <span>
              <b>{k.label}</b>
              <small>{k.detail}</small>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

const ORGANISATION_LABEL: Record<ProKind, string> = {
  coach: "Team or club",
  clinician: "Clinic or practice",
  educator: "School or college",
};

/** Step 3: the practice, asked per kind. Names are optional; the choices aren't. */
export function PracticeStep({ value, onChange }: { value: ProProfile; onChange: (next: ProProfile) => void }) {
  const organisation = (
    <label className="field welcome-field">
      {ORGANISATION_LABEL[value.kind]} (optional)
      <input value={value.organisation ?? ""} maxLength={MAX_ORGANISATION} autoComplete="organization" onChange={(e) => onChange({ ...value, organisation: e.target.value })} />
    </label>
  );
  return (
    <>
      <h1>Your practice</h1>
      <p className="welcome-lede">So BreathCloud fits the people you work with.</p>
      <div className="welcome-asks">
        {value.kind === "coach" && (
          <>
            <Ask question="Which sports do you coach?" hint="Pick any.">
              <Chips
                options={COACH_SPORTS}
                selected={value.sports}
                onPick={(s) => {
                  const next = { ...value, sports: toggle(value.sports, s) };
                  if (!next.sports.includes("other")) delete next.sportOther;
                  onChange(next);
                }}
              />
              {value.sports.includes("other") && (
                <label className="field">
                  Your sport or activity
                  <input value={value.sportOther ?? ""} maxLength={MAX_SPORT_OTHER} onChange={(e) => onChange({ ...value, sportOther: e.target.value })} />
                </label>
              )}
            </Ask>
            <Ask question="At what level?">
              <Chips options={COACH_LEVELS} selected={value.level ? [value.level] : []} onPick={(l) => onChange({ ...value, level: value.level === l ? null : l })} />
            </Ask>
            {organisation}
          </>
        )}
        {value.kind === "clinician" && (
          <>
            <Ask question="What's your profession?">
              <Chips
                options={CLINICIAN_PROFESSIONS}
                selected={value.profession ? [value.profession] : []}
                onPick={(p) => onChange({ ...value, profession: value.profession === p ? null : p })}
              />
            </Ask>
            {organisation}
            <label className="field welcome-field">
              Country
              <input value={value.country ?? ""} maxLength={MAX_COUNTRY} autoComplete="country-name" onChange={(e) => onChange({ ...value, country: e.target.value })} />
            </label>
          </>
        )}
        {value.kind === "educator" && (
          <>
            {organisation}
            <Ask question="What's your role?">
              <Chips
                options={EDUCATOR_ROLES}
                selected={value.profession ? [value.profession] : []}
                onPick={(p) => onChange({ ...value, profession: value.profession === p ? null : p })}
              />
            </Ask>
            <p className="welcome-hint">
              <Icon name="info" size={16} />
              For now, Breathband is for students aged 16 and over.
            </p>
          </>
        )}
      </div>
    </>
  );
}

/** Step 4: what they'll use it for, from their kind's list. At least one. */
export function UsesStep({ value, onChange }: { value: ProProfile; onChange: (next: ProProfile) => void }) {
  return (
    <>
      <h1>What will you use it for?</h1>
      <p className="welcome-lede">So we know what you&rsquo;ll want from BreathCloud.</p>
      <Ask question="Pick any that apply" hint="At least one.">
        <Chips options={USE_CASES[value.kind]} selected={value.useCases} onPick={(u) => onChange({ ...value, useCases: toggle(value.useCases, u) })} />
      </Ask>
    </>
  );
}

/** Step 5: how they refer to people. Starts at the kind's default. */
export function PeopleStep({ value, onChange }: { value: ProProfile; onChange: (next: ProProfile) => void }) {
  const fallback = DEFAULT_TERMS[value.kind];
  return (
    <>
      <h1>How do you refer to the people you work with?</h1>
      <p className="welcome-lede">BreathCloud will call them this. Some pages still say &ldquo;athletes&rdquo; for now.</p>
      <div className="level-list" role="radiogroup" aria-label="People are called">
        {PEOPLE_TERMS.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={value.terminology === t.id} className="level-opt" onClick={() => onChange({ ...value, terminology: t.id })}>
            <span className="level-radio" aria-hidden="true" />
            <span>
              <b>{t.label}</b>
              <small>
                &ldquo;Invite {t.id === "athletes" ? "an" : "a"} {nounsFor(t.id).one}&rdquo;{t.id === fallback ? " · usual for your work" : ""}
              </small>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
