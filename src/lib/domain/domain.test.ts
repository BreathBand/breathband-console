import { describe, expect, it } from "vitest";
import { activity } from "./activity";
import { describeMode, formatDuration, initials } from "./format";
import { combineTransitionScores, formatScore, headline, scoreWord } from "./scores";
import { DEFAULT_ALERTS, DEFAULT_TARGETS, type Assignment, type SessionSummary, type Waveform } from "./types";
import { buckets, slopePerWeek, summarize } from "./trends";
import { assignmentProgress, awaitingReply, describeAssignment, dueText, threads } from "./coaching";
import { sessionsCsv } from "./csv";
import { breathDeviations, waveFrame } from "./waveform";

describe("scores", () => {
  it("shows whole numbers, or one decimal when averaging made one", () => {
    expect(formatScore(7)).toBe("7");
    expect(formatScore(6.0)).toBe("6");
    expect(formatScore(7.5)).toBe("7.5");
    expect(formatScore(6.66)).toBe("6.7");
  });

  it("names the 1–10 bands", () => {
    expect(scoreWord(10)).toEqual({ word: "Excellent", band: "ok" });
    expect(scoreWord(7.5)).toEqual({ word: "Good", band: "ok" });
    expect(scoreWord(6.9)).toEqual({ word: "Fair", band: "mid" });
    expect(scoreWord(1)).toEqual({ word: "Starting out", band: "low" });
  });

  it("combines like the app: mean of the timing and depth means", () => {
    expect(combineTransitionScores({ inhale: 8, exhale: 7 }, { inhale: 7, exhale: 8 })).toBe(7.5);
    expect(combineTransitionScores({ inhale: 6, exhale: 5 }, { inhale: 6, exhale: 5 })).toBe(5.5);
  });

  it("picks a headline for each scoring version, and the rate for open sessions", () => {
    const transition = { total: 7.5, timing: { inhale: 8, exhale: 7 }, depth: { inhale: 7, exhale: 8 }, smoothness: null };
    expect(headline({ scores: transition, respirationRateBpm: 6 })).toMatchObject({ kind: "transition", text: "7.5", word: "Good" });
    expect(headline({ scores: { overall: 72.4, depth: 70, timing: 75 }, respirationRateBpm: 6 })).toMatchObject({
      kind: "legacy",
      text: "72%",
    });
    expect(headline({ scores: null, respirationRateBpm: 14 })).toEqual({ kind: "rate", value: 14, text: "14" });
    expect(headline({ scores: null, respirationRateBpm: null }).text).toBe("–");
  });
});

describe("activity", () => {
  const now = new Date("2026-11-19T12:00:00Z");
  const session = (daysAgo: number, total: number | null): SessionSummary => ({
    id: `d${daysAgo}`,
    athleteId: "a",
    startedAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
    durationSec: 300,
    mode: total === null ? "open" : "paced",
    pacerHalfCycleSec: total === null ? null : 5,
    scores:
      total === null
        ? null
        : { total, timing: { inhale: total, exhale: total }, depth: { inhale: total, exhale: total }, smoothness: null },
    scoringVersion: "transition-v1",
    respirationRateBpm: total === null ? 14 : 6,
    note: "",
    waveformPath: "",
    appVersion: "",
  });

  it("counts the last week and flags nothing for a regular athlete", () => {
    const a = activity([session(0, 7), session(2, null), session(5, 7), session(9, 6.5)], now);
    expect(a).toMatchObject({ daysSince: 0, lastWeek: 3, flags: [] });
    expect(a.scored.map((s) => s.id)).toEqual(["d0", "d5", "d9"]);
  });

  it("flags 3+ days without a session and a 2-point drop on the recent average", () => {
    const a = activity([session(4, 4.5), session(6, 7), session(8, 7), session(10, 6.5), session(12, 7)], now);
    // A drop that big over two weeks also reads as a downward trend.
    expect(a.flags.map((f) => f.kind)).toEqual(["missed", "down", "trend"]);
    expect(a.flags[1].text).toBe("Score down 2.4 on their average");
  });

  it("handles an athlete with no sessions", () => {
    expect(activity([], now)).toMatchObject({ newest: null, daysSince: null, lastWeek: 0, flags: [] });
  });
});

describe("format", () => {
  it("labels sessions the way the app does", () => {
    expect(describeMode({ mode: "paced", pacerHalfCycleSec: 5 })).toBe("Paced 5-5");
    expect(describeMode({ mode: "open", pacerHalfCycleSec: null })).toBe("Open");
    expect(formatDuration(300)).toBe("5:00");
    expect(initials("Alex Morgan")).toBe("AM");
    expect(initials("cher")).toBe("CH");
  });
});

describe("breath deviations", () => {
  // 5-5 pacer for 60 s at 20 Hz; the user follows 0.5 s late at 80% of the pacer's depth.
  const hz = 20;
  const pacer: number[] = [];
  const user: number[] = [];
  for (let i = 0; i < 60 * hz; i++) {
    const t = i / hz;
    pacer.push(10 - 2 * Math.cos((Math.PI * t) / 5));
    user.push(10 - 1.6 * Math.cos((Math.PI * (t - 0.5)) / 5));
  }
  const waveform: Waveform = { sampleIntervalMs: 50, user, pacer, markers: [], calibration: { min: 0, max: 20 } };

  it("frames the signal around the pacer's centre", () => {
    const frame = waveFrame(waveform);
    expect(frame.hz).toBe(20);
    expect(frame.duration).toBe(60);
    expect(frame.midline).toBeCloseTo(10, 1);
    expect(frame.range).toBeGreaterThan(2);
  });

  it("finds each breath's lag and depth against the pacer", () => {
    const breaths = breathDeviations(waveform);
    expect(breaths.length).toBe(5);
    expect(breaths[0]).toMatchObject({ n: 1, tPeak: 5, tTrough: 10, inLag: 0.5, outLag: 0.5 });
    for (const b of breaths) {
      expect(b.inDepth).toBeCloseTo(-20, -1);
      expect(b.outDepth).toBeCloseTo(-20, -1);
    }
  });

  it("returns nothing for an open session", () => {
    expect(breathDeviations({ ...waveform, pacer: null })).toEqual([]);
  });
});

describe("coaching", () => {
  const now = new Date("2026-11-20T12:00:00.000Z");
  const plan: Assignment = {
    id: "a1",
    coachId: "c",
    athleteId: "x",
    createdAt: "2026-11-15T09:00:00.000Z",
    mode: "paced",
    pacerHalfCycleSec: 5,
    durationSec: 300,
    target: 3,
    dueAt: "2026-11-22T23:00:00.000Z",
    note: "",
    cancelled: false,
  };
  const session = (startedAt: string, extra: Partial<SessionSummary> = {}): SessionSummary => ({
    id: startedAt,
    athleteId: "x",
    startedAt,
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

  it("counts matching sessions inside the window only", () => {
    const sessions = [
      session("2026-11-19T08:00:00.000Z"),
      session("2026-11-18T08:00:00.000Z", { pacerHalfCycleSec: 2 }),
      session("2026-11-17T08:00:00.000Z", { durationSec: 180 }),
      session("2026-11-16T08:00:00.000Z", { durationSec: 295 }),
      session("2026-11-14T08:00:00.000Z"),
    ];
    const p = assignmentProgress(plan, sessions, now);
    expect(p.done).toBe(2);
    expect(p.daysLeft).toBe(3);
    expect(p.status).toBe("active");
    expect(dueText(p.daysLeft)).toBe("Due in 2 days");
  });

  it("is behind when there are more sessions left than days, and missed once it's past", () => {
    expect(assignmentProgress({ ...plan, target: 5 }, [], now).status).toBe("behind");
    expect(assignmentProgress({ ...plan, dueAt: "2026-11-19T23:00:00.000Z" }, [], now)).toMatchObject({ status: "missed" });
    expect(dueText(0)).toBe("Was due yesterday");
    expect(describeAssignment(plan)).toBe("Paced 5-5 · 5:00 · 3 times");
  });

  it("finds threads where the athlete spoke last", () => {
    const c = (id: string, sessionId: string, authorRole: "coach" | "athlete", kind: "comment" | "kudos" = "comment") => ({
      id, athleteId: "x", sessionId, authorId: authorRole, authorName: authorRole, authorRole, kind, text: "t",
      createdAt: `2026-11-1${id}T08:00:00.000Z`,
    });
    const comments = [c("1", "s1", "coach"), c("2", "s1", "athlete"), c("3", "s2", "athlete"), c("4", "s2", "coach"), c("5", "s2", "coach", "kudos")];
    expect(awaitingReply(comments).map((x) => x.id)).toEqual(["2"]);
    expect(threads(comments).get("s2")?.kudos).toHaveLength(1);
    // A coach's kudos after the athlete's comment answers it.
    expect(awaitingReply([...comments, c("6", "s1", "coach", "kudos")])).toEqual([]);
  });

  it("writes a CSV that quotes notes", () => {
    const csv = sessionsCsv([session("2026-11-19T08:00:00.000Z", { note: 'Felt "tight", then fine' })]);
    expect(csv.split("\r\n")[1]).toBe('2026-11-19T08:00:00.000Z,Paced 5-5,300,transition-v1,,,,,,,6,"Felt ""tight"", then fine"');
  });
});

describe("alerts and trends", () => {
  const now = new Date("2026-11-20T12:00:00.000Z");
  const scored = (daysAgo: number, total: number, extra: Partial<SessionSummary> = {}): SessionSummary => ({
    id: `s${daysAgo}`,
    athleteId: "x",
    startedAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
    durationSec: 300,
    mode: "paced",
    pacerHalfCycleSec: 5,
    scores: { total, timing: { inhale: total, exhale: total - 1 }, depth: { inhale: total, exhale: total }, smoothness: null },
    scoringVersion: "transition-v1",
    respirationRateBpm: 6,
    note: "",
    waveformPath: "",
    appVersion: "",
    ...extra,
  });

  it("raises target, trend and rate flags, and respects switched-off rules", () => {
    const sessions = [
      scored(1, 5),
      scored(4, 5.5),
      scored(8, 6.5, { mode: "open", scores: null, pacerHalfCycleSec: null, respirationRateBpm: 19 }),
      scored(10, 6.5),
      scored(15, 6.8),
      scored(19, 9.5),
    ];
    const kinds = activity(sessions, now).flags.map((f) => f.kind);
    expect(kinds).toEqual(expect.arrayContaining(["down", "target", "trend", "rate"]));
    const quiet = activity(sessions, now, { ...DEFAULT_ALERTS, scoreDrop: null, belowTarget: null, trendingDown: false, rateOutOfRange: false });
    expect(quiet.flags).toEqual([]);
    expect(slopePerWeek([{ t: 0, v: 1 }, { t: 86_400_000 * 7, v: 2 }, { t: 86_400_000 * 14, v: 3 }])).toBe(1);
  });

  it("summarises a period against the one before", () => {
    const sessions = [scored(2, 8), scored(9, 7), scored(40, 6)];
    const { current, previous, sentences } = summarize(sessions, now, 30, DEFAULT_TARGETS);
    expect(current).toMatchObject({ count: 2, average: 7.5, onTarget: 2, minutes: 10 });
    expect(previous.count).toBe(1);
    expect(sentences[0]).toMatch(/^2 sessions in the last 30 days \(1 more than the 30 days before\)/);
    expect(sentences.join(" ")).toContain("Weakest part: exhale timing, averaging 6.5.");
    expect(buckets(sessions, now, 7)).toHaveLength(7);
    expect(buckets(sessions, now, 90)).toHaveLength(13);
  });
});
