import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { trackTopbarHeight } from "./topbarHeight";

const css = readFileSync(fileURLToPath(new URL("./console.css", import.meta.url)), "utf8");

function block(selector: string, from = 0): string {
  const start = css.indexOf(`${selector} {`, from);
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

function mediaBlock(query: string): string {
  const start = css.indexOf(`@media ${query} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = css.indexOf("\n@media", start + 1);
  return css.slice(start, next < 0 ? undefined : next);
}

class FakeObserver {
  static last: FakeObserver | undefined;
  observed: unknown[] = [];
  disconnected = false;
  constructor(readonly callback: () => void) {
    FakeObserver.last = this;
  }
  observe(target: unknown) {
    this.observed.push(target);
  }
  disconnect() {
    this.disconnected = true;
  }
}

function fakeHeader(height: number) {
  const props = new Map<string, string>();
  const app = { style: { setProperty: (name: string, value: string) => props.set(name, value) } };
  const header = { offsetHeight: height, parentElement: app };
  return { header: header as unknown as HTMLElement, props };
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeObserver.last = undefined;
});

describe("trackTopbarHeight", () => {
  it("writes the bar's height to its parent each time the bar resizes", () => {
    vi.stubGlobal("ResizeObserver", FakeObserver);
    const { header, props } = fakeHeader(57);
    const stop = trackTopbarHeight(header);
    const observer = FakeObserver.last!;
    expect(observer.observed).toEqual([header]);

    observer.callback();
    expect(props.get("--topbar-measured")).toBe("57px");

    (header as unknown as { offsetHeight: number }).offsetHeight = 101;
    observer.callback();
    expect(props.get("--topbar-measured")).toBe("101px");

    stop?.();
    expect(observer.disconnected).toBe(true);
  });

  it("does nothing when the bar is gone", () => {
    vi.stubGlobal("ResizeObserver", FakeObserver);
    expect(trackTopbarHeight(null)).toBeUndefined();
    expect(FakeObserver.last).toBeUndefined();
  });
});

describe("top bar CSS", () => {
  it("lets the bar wrap instead of overflowing the window", () => {
    expect(block(".topbar-row")).toContain("flex-wrap: wrap");
  });

  it("sticks the rail under the measured bar height, falling back to one row", () => {
    expect(block(".app")).toContain("--topbar-h: var(--topbar-measured, 57px)");
    expect(block(".rail")).toContain("top: var(--topbar-h)");
  });

  it("tightens the bar only between the 960px and 1280px breakpoints", () => {
    const compact = mediaBlock("(min-width: 961px) and (max-width: 1280px)");
    expect(compact).toContain(".topbar-row");
    expect(compact).toMatch(/\.brand > span,\s*\.sync-text \{[^}]*clip: rect\(0 0 0 0\)/);
    expect(compact).toMatch(/\.topnav a \{\s*padding: 0 var\(--s-3\);\s*\}/);
  });

  it("keeps the wrapped phone and tablet bar from before", () => {
    const narrow = mediaBlock("(max-width: 960px)");
    expect(narrow).toContain("--topbar-h: 0px");
    expect(narrow).toMatch(/\.topbar-row \{\s*flex-wrap: wrap;\s*padding: var\(--s-3\) var\(--s-5\);\s*gap: var\(--s-3\) var\(--s-4\);/);
  });
});
