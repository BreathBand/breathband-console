"use client";

import { MOOD_SCORES, MOOD_WORDS } from "@/lib/domain/mood";
import type { MoodScore } from "@/lib/domain/types";
import "./mood.css";

/**
 * Focus's mood check-in (J6): five faces, one tap, before and after a
 * session. Optional: nothing has to be picked, and a second tap on the chosen
 * face clears it.
 */
export function MoodFaces({
  question,
  value,
  onChange,
}: {
  question: string;
  value: MoodScore | null;
  onChange: (mood: MoodScore | null) => void;
}) {
  return (
    <fieldset className="mood-check">
      <legend>{question}</legend>
      <div className="mood-faces">
        {MOOD_SCORES.map((mood) => (
          <button
            key={mood}
            type="button"
            aria-pressed={value === mood}
            aria-label={`${MOOD_WORDS[mood]}, ${mood} of 5`}
            onClick={() => onChange(value === mood ? null : mood)}
          >
            <Face mood={mood} />
            <span aria-hidden="true">{MOOD_WORDS[mood]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** A face whose mouth curves from a frown (1) through flat (3) to a smile (5). */
function Face({ mood }: { mood: MoodScore }) {
  const bend = (mood - 3) * 3;
  const y = mood < 3 ? 16.5 : 15;
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.8" cy="9.5" r="1.1" fill="currentColor" />
      <circle cx="15.2" cy="9.5" r="1.1" fill="currentColor" />
      <path d={`M8 ${y} Q12 ${y + bend} 16 ${y}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
