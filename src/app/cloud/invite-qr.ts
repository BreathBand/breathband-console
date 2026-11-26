import { create } from "qrcode";

// The invite link as a QR code, built in the browser (planning/v1/02 §4.1 step
// 10, 03 E9): a professional shows it in the room or the class and people scan
// it. `qrcode` only computes the modules; the page draws them as an SVG path,
// so there's no canvas, no image request and nothing on a server.

/** Blank modules around the code, as the QR standard asks, so phones can find its edges. */
export const QUIET_ZONE = 4;

export interface QrShape {
  /** Modules per side, without the quiet zone. */
  size: number;
  /** The viewBox side, with the quiet zone on every edge. */
  box: number;
  /** One 1×1 square per dark module, offset by the quiet zone. */
  path: string;
  /** How many dark modules the path draws. */
  dark: number;
}

/** The QR code for `text` at error correction M (a printed or on-screen link). */
export function qrShape(text: string): QrShape {
  const { modules } = create(text, { errorCorrectionLevel: "M" });
  const { size, data } = modules;
  const parts: string[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (data[row * size + col]) parts.push(`M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`);
    }
  }
  return { size, box: size + 2 * QUIET_ZONE, path: parts.join(""), dark: parts.length };
}
