import { describe, expect, it } from "vitest";
import { eventsProblem, MAX_EVENTS_PER_CALL, type ProductEvent } from "./events";

const at = "2026-11-27T10:00:00.000Z";

describe("eventsProblem", () => {
  it("takes listed events with flat words, numbers and yes/no", () => {
    expect(eventsProblem([{ name: "session_saved", props: { mode: "open", minutes: 3, first: true }, at }])).toBeNull();
    expect(eventsProblem([{ name: "onboarding_step_viewed", at }])).toBeNull();
  });

  it("refuses unknown names, lists or objects as values, long text, bad times and too many", () => {
    expect(eventsProblem([{ name: "raw_signal" as never, at }])).toMatch(/^name/);
    expect(eventsProblem([{ name: "session_saved", props: { samples: [1, 2] as never }, at }])).toMatch(/props\.samples/);
    expect(eventsProblem([{ name: "session_saved", props: { note: "x".repeat(65) }, at }])).toMatch(/props\.note/);
    expect(eventsProblem([{ name: "session_saved", props: { n: Number.NaN }, at }])).toMatch(/props\.n/);
    expect(eventsProblem([{ name: "session_saved", at: "yesterday" }])).toMatch(/^at/);
    const many: ProductEvent[] = Array.from({ length: MAX_EVENTS_PER_CALL + 1 }, () => ({ name: "session_saved", at }));
    expect(eventsProblem(many)).toMatch(/^events/);
    expect(eventsProblem([])).toMatch(/^events/);
  });
});
