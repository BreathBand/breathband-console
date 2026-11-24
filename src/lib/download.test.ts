import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadText, slug } from "./download";

describe("slug", () => {
  it("lower-cases and joins words with a dash", () => {
    expect(slug("Alex Morgan")).toBe("alex-morgan");
  });

  it("strips accents", () => {
    expect(slug("Zoë Ångström")).toBe("zoe-angstrom");
  });

  it("turns underscores and runs of spaces into one dash", () => {
    expect(slug("a_b   c")).toBe("a-b-c");
  });

  it("falls back to 'athlete' when nothing is left", () => {
    expect(slug("!!!")).toBe("athlete");
  });
});

describe("downloadText", () => {
  let anchor: { href: string; download: string; click: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  let append: ReturnType<typeof vi.fn>;
  let blobs: Blob[];
  let createObjectURL: ReturnType<typeof vi.spyOn>;
  let revokeObjectURL: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    append = vi.fn();
    blobs = [];
    vi.stubGlobal("document", { createElement: vi.fn(() => anchor), body: { append } });
    createObjectURL = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return "blob:x";
    });
    revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("clicks a temporary link to the file and removes it", async () => {
    downloadText("alex-morgan.csv", "a,b\n1,2\n");
    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(anchor.href).toBe("blob:x");
    expect(anchor.download).toBe("alex-morgan.csv");
    expect(append).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.remove).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(await blobs[0].text()).toBe("a,b\n1,2\n");
  });

  it("makes a CSV by default and uses a passed type", () => {
    downloadText("a.csv", "x");
    downloadText("a.json", "{}", "application/json");
    expect(blobs.map((b) => b.type)).toEqual(["text/csv;charset=utf-8", "application/json"]);
  });

  it("revokes the object URL only after the timer runs", () => {
    downloadText("a.csv", "x");
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:x");
  });
});
