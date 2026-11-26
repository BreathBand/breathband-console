"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  CALM_HOPES,
  CALM_TIMES,
  DAY_PARTS,
  FOCUS_STRESSORS,
  MAX_EXAM_DATES,
  MAX_SPORT_OTHER,
  MAX_TRAIN_WANTS,
  TRAIN_SPORTS,
  TRAIN_WANTS,
  WEEKDAYS,
  type TrackDetails,
} from "@/lib/domain/goal-questions";
import { goalOf } from "@/lib/domain/preferences";
import type { BreathGoal, CalmDetails, FocusDetails, TrainDetails, Weekday } from "@/lib/domain/types";

type Option<T extends string> = { id: T; label: string };

const toggle = <T,>(list: T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/** Turns one day on or off, keeping the week in order. */
export const toggleDay = (days: Weekday[], day: Weekday): Weekday[] =>
  WEEKDAYS.map((w) => w.id).filter((w) => (w === day ? !days.includes(w) : days.includes(w)));

/** Pill toggles: several can be on (`multiple`) or one, which a second press turns off. */
export function Chips<T extends string>({
  options,
  selected,
  onPick,
  label,
  max,
}: {
  options: Option<T>[];
  selected: T[];
  onPick: (id: T) => void;
  /** Names the row when it isn't the whole question (e.g. "Training days"). */
  label?: string;
  max?: number;
}) {
  const id = useId();
  const full = max !== undefined && selected.length >= max;
  const chips = (
    <div className="welcome-chips">
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button key={o.id} type="button" aria-pressed={on} disabled={!on && full} onClick={() => onPick(o.id)}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
  if (!label) return chips;
  return (
    <div className="welcome-chiprow" role="group" aria-labelledby={id}>
      <span id={id}>{label}</span>
      {chips}
    </div>
  );
}

export function Ask({ question, hint, children }: { question: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="welcome-ask">
      <legend>{question}</legend>
      {hint && <small>{hint}</small>}
      {children}
    </fieldset>
  );
}

/** "Skip them and you start on 3-minute open sessions." */
export function skipDefaultText(goal: BreathGoal): string {
  const s = goalOf(goal).session;
  const minutes = Math.round(s.durationSec / 60);
  return `${minutes}-minute ${s.mode === "paced" ? "paced" : "open"} sessions`;
}

const COPY: Record<BreathGoal, { title: string; lede: string }> = {
  train: { title: "Your training", lede: "A few taps, so your sessions and reminders fit your training." },
  focus: { title: "Your studies", lede: "So Breathband fits around your studies, and stays quiet in class." },
  calm: { title: "What would help?", lede: "Two quick taps, so your reminders fit your day." },
};

/** Step 5: the goal's own questions. Every one is optional. */
export function GoalQuestions({ goal, value, onChange }: { goal: BreathGoal; value: TrackDetails; onChange: (next: TrackDetails) => void }) {
  return (
    <>
      <h1>{COPY[goal].title}</h1>
      <p className="welcome-lede">
        {COPY[goal].lede} Skip them and you start on <b>{skipDefaultText(goal)}</b>.
      </p>
      {goal === "train" && <TrainQuestions value={value as TrainDetails} onChange={onChange} />}
      {goal === "focus" && <FocusQuestions value={value as FocusDetails} onChange={onChange} />}
      {goal === "calm" && <CalmQuestions value={value as CalmDetails} onChange={onChange} />}
    </>
  );
}

function TrainQuestions({ value, onChange }: { value: TrainDetails; onChange: (next: TrainDetails) => void }) {
  const pickSport = (sport: TrainDetails["sport"]) => {
    const next = { ...value, sport: value.sport === sport ? null : sport };
    if (next.sport !== "other") delete next.sportOther;
    onChange(next);
  };
  return (
    <div className="welcome-asks">
      <Ask question="What's your sport or activity?">
        <Chips options={TRAIN_SPORTS} selected={value.sport ? [value.sport] : []} onPick={pickSport} />
        {value.sport === "other" && (
          <label className="field">
            Your sport or activity
            <input
              value={value.sportOther ?? ""}
              maxLength={MAX_SPORT_OTHER}
              onChange={(e) => onChange({ ...value, sportOther: e.target.value })}
            />
          </label>
        )}
      </Ask>
      <Ask question="What do you want from your breathing?" hint={`Pick up to ${MAX_TRAIN_WANTS}.`}>
        <Chips options={TRAIN_WANTS} selected={value.wants} max={MAX_TRAIN_WANTS} onPick={(w) => onChange({ ...value, wants: toggle(value.wants, w) })} />
      </Ask>
      <Ask question="When do you train?">
        <Chips
          label="Days"
          options={WEEKDAYS}
          selected={value.trainingDays}
          onPick={(d) => onChange({ ...value, trainingDays: toggleDay(value.trainingDays, d) })}
        />
        <Chips
          label="Time of day"
          options={DAY_PARTS}
          selected={value.trainingTime ? [value.trainingTime] : []}
          onPick={(t) => onChange({ ...value, trainingTime: value.trainingTime === t ? null : t })}
        />
      </Ask>
    </div>
  );
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const examLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function FocusQuestions({ value, onChange }: { value: FocusDetails; onChange: (next: FocusDetails) => void }) {
  const [exam, setExam] = useState("");
  const canAdd = /^\d{4}-\d{2}-\d{2}$/.test(exam) && exam >= todayIso() && !value.examDates.includes(exam) && value.examDates.length < MAX_EXAM_DATES;
  const addExam = () => {
    if (!canAdd) return;
    onChange({ ...value, examDates: [...value.examDates, exam].sort() });
    setExam("");
  };
  return (
    <div className="welcome-asks">
      <Ask question="When does stress get in the way?" hint="Pick any.">
        <Chips options={FOCUS_STRESSORS} selected={value.stressors} onPick={(s) => onChange({ ...value, stressors: toggle(value.stressors, s) })} />
      </Ask>
      <Ask question="Any exams coming up?" hint={`Up to ${MAX_EXAM_DATES} dates.`}>
        <div className="welcome-exam">
          <label className="field">
            Exam date
            <input
              type="date"
              value={exam}
              min={todayIso()}
              disabled={value.examDates.length >= MAX_EXAM_DATES}
              onChange={(e) => setExam(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addExam();
                }
              }}
            />
          </label>
          <button type="button" className="button" data-variant="ghost" disabled={!canAdd} onClick={addExam}>
            Add date
          </button>
        </div>
        {value.examDates.length > 0 && (
          <ul className="welcome-exams" aria-label="Exams added">
            {value.examDates.map((d) => (
              <li key={d}>
                {examLabel(d)}
                <button
                  type="button"
                  aria-label={`Remove ${examLabel(d)}`}
                  onClick={() => onChange({ ...value, examDates: value.examDates.filter((x) => x !== d) })}
                >
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Ask>
      <Ask question="When do you study, and when are you in class?" hint="Rough times are fine. We won't remind you in class.">
        <Chips label="Study" options={DAY_PARTS} selected={value.studyTimes} onPick={(t) => onChange({ ...value, studyTimes: toggle(value.studyTimes, t) })} />
        <Chips label="In class" options={DAY_PARTS} selected={value.classTimes} onPick={(t) => onChange({ ...value, classTimes: toggle(value.classTimes, t) })} />
      </Ask>
      <Ask question="Check in on your mood before and after each session?" hint="Five faces, one tap, before and after.">
        <div className="seg" role="group" aria-label="Mood check-in">
          {[true, false].map((on) => (
            <button key={String(on)} type="button" aria-pressed={value.moodCheckins === on} onClick={() => onChange({ ...value, moodCheckins: on })}>
              {on ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </Ask>
    </div>
  );
}

function CalmQuestions({ value, onChange }: { value: CalmDetails; onChange: (next: CalmDetails) => void }) {
  return (
    <div className="welcome-asks">
      <Ask question="What are you hoping for?" hint="Pick any.">
        <Chips options={CALM_HOPES} selected={value.hopes} onPick={(h) => onChange({ ...value, hopes: toggle(value.hopes, h) })} />
      </Ask>
      <Ask question="When suits you best?">
        <Chips options={CALM_TIMES} selected={value.bestTime ? [value.bestTime] : []} onPick={(t) => onChange({ ...value, bestTime: value.bestTime === t ? null : t })} />
      </Ask>
    </div>
  );
}
