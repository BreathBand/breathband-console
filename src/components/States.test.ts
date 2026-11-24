import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BackendError } from "@/lib/backend";
import { EmptyState, ErrorState } from "./States";

describe("EmptyState", () => {
  it("titles itself with an h2 by default", () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { title: "No sessions yet" }));
    expect(html).toBe('<div class="empty"><h2>No sessions yet</h2></div>');
  });

  it("titles itself with an h1 at level 1, keeping the same markup otherwise", () => {
    const html = renderToStaticMarkup(
      createElement(EmptyState, { title: "This link is missing a session", level: 1 }, createElement("p", null, "Back")),
    );
    expect(html).toBe('<div class="empty"><h1>This link is missing a session</h1><p>Back</p></div>');
  });

  it("titles itself with an h2 at level 2", () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { title: "Nothing set right now", level: 2 }));
    expect(html).toContain("<h2>Nothing set right now</h2>");
    expect(html).not.toContain("<h1");
  });
});

describe("ErrorState", () => {
  it("still titles a load failure with an h2", () => {
    const html = renderToStaticMarkup(createElement(ErrorState, { error: new Error("offline"), what: "sessions" }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("<h2>Couldn&#x27;t load sessions</h2>");
    expect(html).not.toContain("<h1");
  });

  it("still words a permission error with an h2", () => {
    const error = new BackendError("permission-denied", "no");
    const html = renderToStaticMarkup(createElement(ErrorState, { error, what: "sessions" }));
    expect(html).toContain("<h2>You don&#x27;t have access to this</h2>");
  });
});
