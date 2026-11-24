import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BreathDeviation } from "@/lib/domain/waveform";
import { BreathTable } from "./Waveform";

const breaths: BreathDeviation[] = [
  { n: 1, tPeak: 4, tTrough: 8, inLag: 0.2, outLag: -0.1, inDepth: 5, outDepth: -3 },
  { n: 2, tPeak: 12, tTrough: 16, inLag: 0, outLag: 0.3, inDepth: -2, outDepth: 4 },
];

describe("BreathTable", () => {
  it("is a focusable region named apart from the pane it sits in", () => {
    const html = renderToStaticMarkup(createElement(BreathTable, { breaths, t0: 0, t1: 20 }));
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    const label = html.match(/aria-label="([^"]*)"/)?.[1];
    expect(label).toBe("Timing and depth of each breath");
    expect(label).not.toBe("Breaths in view");
    expect(html.match(/<tbody>.*<\/tbody>/)?.[0].match(/<tr>/g)).toHaveLength(2);
  });

  it("renders no region when no breath is in the window", () => {
    const html = renderToStaticMarkup(createElement(BreathTable, { breaths, t0: 30, t1: 40 }));
    expect(html).toBe('<p class="muted">No complete breaths in this part of the session.</p>');
    expect(html).not.toContain('role="region"');
  });
});
