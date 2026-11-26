import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../console.css", import.meta.url), "utf8");

function rules(source: string): { selector: string; within: string[] }[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const stack: string[] = [];
  const out: { selector: string; within: string[] }[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{") {
      const prelude = text.slice(start, i).trim();
      if (!prelude.startsWith("@")) out.push({ selector: prelude, within: [...stack] });
      stack.push(prelude);
      start = i + 1;
    } else if (c === "}") {
      stack.pop();
      start = i + 1;
    } else if (c === ";") {
      start = i + 1;
    }
  }
  return out;
}

describe("Compare page side-by-side table", () => {
  it("labels every cell with its column header, in the same order", () => {
    const headers = [...page.matchAll(/<th(?: className="num")?>([^<]+)<\/th>/g)].map((m) => m[1]);
    const labels = [...page.matchAll(/<Cell label=(?:"([^"]+)"|(\{[^}]+\}))/g)].map((m) => m[1] ?? m[2]);
    expect(headers).toEqual([
      "{terms.One}",
      "Sessions",
      "A week",
      "Average score",
      "Change",
      "On target",
      "Breathing rate",
      "Weakest part",
    ]);
    expect(labels).toEqual(headers);
  });

  it("keeps the labels hidden until the phone layout shows them", () => {
    expect(page).toMatch(/<span className="compare-label" hidden>/);
    expect(page).toMatch(/<table className="table compare-table">/);
  });

  it("only restyles the table at 640px and below", () => {
    const own = rules(css).filter((r) => /compare-(table|label)/.test(r.selector));
    expect(own.length).toBeGreaterThan(0);
    for (const rule of own) expect(rule.within, rule.selector).toEqual(["@media (max-width: 640px)"]);
    expect(own.map((r) => r.selector)).toContain(".table-scroll:has(.compare-table)");
  });
});
