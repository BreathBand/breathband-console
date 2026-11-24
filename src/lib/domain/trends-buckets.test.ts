import { describe, expect, it } from "vitest";
import { bucketAverage, bucketRate, inPeriod, periodStats, rangeLabel, type Bucket } from "./trends";
import { DEFAULT_TARGETS, type SessionSummary, type TransitionScores } from "./types";

const DAY_MS = 86_400_000;
const now = new Date("2026-11-24T12:00:00.000Z");

const session = (id: string, extra: Partial<SessionSummary> = {}): SessionSummary => ({
  id,
  athleteId: "a",
  startedAt: now.toISOString(),
  durationSec: 300,
  mode: "paced",
  pacerHalfCycleSec: 5,
  scores: null,
  scoringVersion: "transition-v1",
  respirationRateBpm: 6,
  note: "",
  waveformPath: "",
  appVersion: "",
  ...extra,
});

const scores = (total: number, timing: [number, number], depth: [number, number]): TransitionScores => ({
  total,
  timing: { inhale: timing[0], exhale: timing[1] },
  depth: { inhale: depth[0], exhale: depth[1] },
  smoothness: null,
});

const scored = (id: string, total: number) => session(id, { scores: scores(total, [total, total], [total, total]) });
const open = (id: string, rate: number | null) =>
  session(id, { mode: "open", pacerHalfCycleSec: null, scores: null, respirationRateBpm: rate });
const at = (id: string, ms: number) => session(id, { startedAt: new Date(now.getTime() - ms).toISOString() });
const bucket = (sessions: SessionSummary[]): Bucket => ({ start: 0, end: DAY_MS, sessions });

describe("rangeLabel", () => {
  it("uses the label of a listed range", () => {
    expect(rangeLabel(30)).toBe("30 days");
    expect(rangeLabel(182)).toBe("6 months");
  });

  it("falls back to a count of days", () => {
    expect(rangeLabel(14)).toBe("14 days");
  });
});

describe("inPeriod", () => {
  const sessions = [
    at("now", 0),
    at("just-before-now", 1),
    at("week-ago", 7 * DAY_MS),
    at("two-weeks-ago", 14 * DAY_MS),
    at("before-two-weeks", 14 * DAY_MS + 1),
  ];
  const ids = (list: SessionSummary[]) => list.map((s) => s.id);

  it("takes the last days, start inclusive and end exclusive", () => {
    expect(ids(inPeriod(sessions, now, 7))).toEqual(["just-before-now", "week-ago"]);
  });

  it("takes the period before with offset 1", () => {
    expect(ids(inPeriod(sessions, now, 7, 1))).toEqual(["two-weeks-ago"]);
  });
});

describe("periodStats", () => {
  const best = session("best", { scores: scores(8, [8, 7], [9, 8]) });
  const sessions = [
    best,
    session("second", { scores: scores(6, [6, 5], [7, 6]) }),
    session("legacy", { scoringVersion: "legacy-v1", scores: { overall: 90, depth: 90, timing: 90 } }),
    open("in-range", 14),
    open("fast", 18),
    open("slow", 10),
    open("no-rate", null),
  ];
  const stats = periodStats(sessions, 14, DEFAULT_TARGETS);

  it("picks the best scored session", () => {
    expect(stats.best).toBe(best);
  });

  it("finds the weakest sub-score by its mean", () => {
    expect(stats.weakest).toEqual({ label: "exhale timing", value: 6 });
  });

  it("counts open sessions with a rate and those outside the target range", () => {
    expect(stats.openCount).toBe(3);
    expect(stats.rateOutside).toBe(2);
  });

  it("averages sessions per week over the period", () => {
    expect(stats.perWeek).toBe(3.5);
  });

  it("has no best or weakest without scored sessions", () => {
    const empty = periodStats([open("o", 14)], 7, DEFAULT_TARGETS);
    expect(empty.best).toBeNull();
    expect(empty.weakest).toBeNull();
    expect(empty.perWeek).toBe(1);
  });
});

describe("bucketAverage", () => {
  it("is null for an empty bucket or one with nothing scored", () => {
    expect(bucketAverage(bucket([]))).toBeNull();
    expect(bucketAverage(bucket([open("o", 14)]))).toBeNull();
  });

  it("averages the scored sessions to one decimal", () => {
    const b = bucket([scored("a", 7), scored("b", 8), scored("c", 8), open("o", 14)]);
    expect(bucketAverage(b)).toBe(7.7);
  });
});

describe("bucketRate", () => {
  it("is null for an empty bucket", () => {
    expect(bucketRate(bucket([]))).toBeNull();
  });

  it("averages open-session rates to one decimal", () => {
    expect(bucketRate(bucket([open("a", 12), open("b", 13), open("c", 15)]))).toBe(13.3);
  });

  it("ignores paced sessions and null rates", () => {
    expect(bucketRate(bucket([open("a", 12), open("b", null), scored("p", 7)]))).toBe(12);
    expect(bucketRate(bucket([scored("p", 7), open("b", null)]))).toBeNull();
  });
});
