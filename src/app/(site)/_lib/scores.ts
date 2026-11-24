// The words the app puts beside a 1–10 score (the design directions'
// proposal, still to be confirmed by the client). A word always travels with
// the colour, so colour never carries the meaning alone.
export type Band = "high" | "good" | "mid" | "low";

export const SCORE_WORDS: { min: number; word: string; band: Band; range: string }[] = [
  { min: 9, word: "Excellent", band: "high", range: "9–10" },
  { min: 7, word: "Good", band: "good", range: "7–8.9" },
  { min: 5, word: "Fair", band: "mid", range: "5–6.9" },
  { min: 3, word: "Building", band: "low", range: "3–4.9" },
  { min: 1, word: "Starting out", band: "low", range: "1–2.9" },
];

export function scoreWord(score: number) {
  return SCORE_WORDS.find((w) => score >= w.min) ?? SCORE_WORDS[SCORE_WORDS.length - 1];
}

/** Whole numbers stay whole; otherwise one decimal. */
export function formatScore(score: number): string {
  return Math.round(score * 10) % 10 === 0 ? String(Math.round(score)) : score.toFixed(1);
}
