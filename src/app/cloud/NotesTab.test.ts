import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRIVATE_NOTES_HINT } from "@/lib/domain/pro-terms";
import { NOTES_PLACEHOLDER } from "./NotesTab";

// T-0148 (E14): the private notes carry the standing hint (02 §4.3, D-G), and their prompt doesn't invite health detail.

const source = readFileSync(new URL("./NotesTab.tsx", import.meta.url), "utf8");

describe("the professional's private notes", () => {
  it("show the private-notes hint under 'Only you can see these', tied to the notes box", () => {
    const lock = source.indexOf("Only you can see these");
    const hint = source.indexOf("{PRIVATE_NOTES_HINT}");
    const box = source.indexOf("<textarea");
    expect(lock).toBeGreaterThan(-1);
    expect(hint).toBeGreaterThan(lock);
    expect(box).toBeGreaterThan(hint);
    expect(source).toMatch(/<p className="label" id="notes-hint">/);
    expect(source).toMatch(/aria-describedby="notes-hint"/);
    expect(PRIVATE_NOTES_HINT).toBe("For practice notes only. Don't record diagnoses or medical history here.");
  });

  it("prompt for practice, not injuries or other health detail", () => {
    expect(NOTES_PLACEHOLDER).toBe("Goals, what works for them, what to try next…");
    expect(NOTES_PLACEHOLDER).not.toMatch(/injur|diagnos|medical|condition|symptom|health/i);
    expect(source).not.toContain("injuries");
  });
});
