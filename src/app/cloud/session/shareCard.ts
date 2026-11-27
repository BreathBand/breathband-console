import { describeMode, formatDuration, formatLongDay } from "@/lib/domain/format";
import { formatScore, isTransitionScores, scoreWord } from "@/lib/domain/scores";
import type { SessionSummary } from "@/lib/domain/types";

// Share as an image (I6): a small card with the session's headline number, its
// word and when, for the person to post or send. The number and the word only:
// nothing about how the score is worked out.

export type ShareCard = { big: string; unit: string; word: string; detail: string };

export function shareCardOf(session: Pick<SessionSummary, "mode" | "pacerHalfCycleSec" | "scores" | "respirationRateBpm" | "startedAt" | "durationSec">): ShareCard {
  const when = `${describeMode(session)} · ${formatLongDay(session.startedAt)} · ${formatDuration(session.durationSec)}`;
  if (isTransitionScores(session.scores)) {
    return { big: formatScore(session.scores.total), unit: "/ 10", word: `${scoreWord(session.scores.total).word} · Total Breath Score`, detail: when };
  }
  const rate = session.respirationRateBpm;
  return { big: rate === null ? "–" : String(Math.round(rate)), unit: "br/min", word: "Breathing rate", detail: when };
}

const WIDTH = 1080;
const HEIGHT = 1080;

/** The card as a PNG, drawn with the page's own colour tokens and fonts. */
export async function shareCardPng(card: ShareCard): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("no 2D canvas");
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

  g.fillStyle = token("--c-pane", "#fbfaf8");
  g.fillRect(0, 0, WIDTH, HEIGHT);
  g.fillStyle = token("--c-ink", "#121110");
  g.textBaseline = "alphabetic";

  g.font = `600 48px ${font}`;
  g.fillText("Breathband", 96, 150);

  g.font = `700 320px ${font}`;
  g.fillText(card.big, 96, 600);
  const bigWidth = g.measureText(card.big).width;
  g.font = `500 64px ${font}`;
  g.fillStyle = token("--c-ink-2", "#57534c");
  g.fillText(card.unit, 96 + bigWidth + 24, 600);

  g.fillStyle = token("--c-ink", "#121110");
  g.font = `600 56px ${font}`;
  g.fillText(card.word, 96, 720);
  g.fillStyle = token("--c-ink-2", "#57534c");
  g.font = `400 40px ${font}`;
  g.fillText(card.detail, 96, 800, WIDTH - 192);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png"));
}

/** Shares the image where the browser can (phones), otherwise downloads it. */
export async function shareOrDownload(png: Blob, filename: string): Promise<void> {
  const file = new File([png], filename, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "My Breathband session" });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(png);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
