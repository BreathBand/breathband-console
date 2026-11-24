import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1];
  if (body === undefined) throw new Error(`No ${selector} rule in globals.css`);
  return body;
}

describe("globals.css", () => {
  it("makes .table-scroll the containing block of what it scrolls", () => {
    const body = rule(".table-scroll");
    expect(body).toMatch(/position:\s*relative;/);
    expect(body).toMatch(/overflow-x:\s*auto;/);
  });

  it("keeps .sr-only text absolutely positioned and clipped", () => {
    const body = rule(".sr-only");
    expect(body).toMatch(/position:\s*absolute;/);
    expect(body).toMatch(/overflow:\s*hidden;/);
  });
});
