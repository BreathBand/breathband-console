import { describe, expect, it } from "vitest";
import { formatDay, formatLongDay, formatSessionDate, formatTime } from "./format";

const iso = new Date(2026, 10, 8, 7, 36).toISOString();
const locale = "en-GB";
const spaced = (s: string) => s.replace(/\s/g, " ");

describe("formatSessionDate", () => {
  it("shows the weekday, day, month and time", () => {
    expect(spaced(formatSessionDate(iso, locale))).toMatch(/^Sun 8 Nov, 0?7:36$/);
  });
});

describe("formatDay", () => {
  it("shows the weekday by default", () => {
    expect(spaced(formatDay(iso, locale))).toBe("Sun 8 Nov");
  });

  it("leaves the weekday out when asked", () => {
    expect(spaced(formatDay(iso, locale, false))).toBe("8 Nov");
  });
});

describe("formatLongDay", () => {
  it("adds the year", () => {
    expect(spaced(formatLongDay(iso, locale))).toBe("Sun, 8 Nov 2026");
  });
});

describe("formatTime", () => {
  it("shows the local time", () => {
    expect(spaced(formatTime(iso, locale))).toMatch(/^0?7:36$/);
  });
});
