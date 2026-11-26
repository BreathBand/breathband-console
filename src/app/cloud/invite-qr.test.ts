import { create } from "qrcode";
import { describe, expect, it } from "vitest";
import { QUIET_ZONE, qrShape } from "./invite-qr";

const LINK = "https://breathband.example/cloud/join/?code=K7Q2-M9XD";

describe("the invite QR code", () => {
  it("draws every dark module of the link's QR code, and nothing else", () => {
    const expected = create(LINK, { errorCorrectionLevel: "M" }).modules;
    const shape = qrShape(LINK);
    expect(shape.size).toBe(expected.size);
    expect(shape.dark).toBe([...expected.data].filter(Boolean).length);
    expect(shape.path.match(/M/g)).toHaveLength(shape.dark);
  });

  it("leaves a quiet zone of four modules on every side", () => {
    const shape = qrShape(LINK);
    expect(shape.box).toBe(shape.size + 2 * QUIET_ZONE);
    const corners = [...shape.path.matchAll(/M(\d+) (\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(Math.min(...corners.flat())).toBe(QUIET_ZONE);
    expect(Math.max(...corners.flat())).toBe(QUIET_ZONE + shape.size - 1);
  });

  it("changes with the link, and is the same for the same link", () => {
    expect(qrShape(LINK).path).toBe(qrShape(LINK).path);
    expect(qrShape(`${LINK}X`).path).not.toBe(qrShape(LINK).path);
  });
});
