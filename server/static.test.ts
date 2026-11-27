import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "./db/client";
import { createHash } from "node:crypto";
import { API_POLICY, createApp, HSTS, SECURITY_HEADERS } from "./index";
import { IMMUTABLE, pagePolicy } from "./static";

// A small static export, shaped like `next build` with trailingSlash: true.
const root = mkdtempSync(join(tmpdir(), "breathband-out-"));
const files: Record<string, string> = {
  "index.html": "<!doctype html><title>home</title>",
  "404.html": "<!doctype html><title>not found</title>",
  "cloud/login/index.html": "<!doctype html><title>login</title>",
  "cloud/index.txt": "rsc payload",
  "about.html": "<!doctype html><title>about</title>",
  "_next/static/chunks/app-3f2a.js": "console.log('chunk');",
  "_next/static/css/site-9b1c.css": "body{}",
  "favicon.ico": "icon",
};
for (const [path, body] of Object.entries(files)) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), body);
}
// A sibling of the export, reachable only by climbing out of it: must never be served.
const secret = `${root}-secret.txt`;
const secretName = basename(secret);
writeFileSync(secret, "secret");

const { client, db } = createDb(":memory:");
const app = createApp({ db, mode: "production", appUrl: "http://localhost:3000", staticDir: root });

afterAll(() => {
  client.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(secret, { force: true });
});

function expectSecurityHeaders(response: Response) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    expect(response.headers.get(name), name).toBe(value);
  }
}

describe("static export", () => {
  it("serves an HTML page with the security headers and no long-term caching", async () => {
    const response = await app.request("/cloud/login/");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toBe(files["cloud/login/index.html"]);
    expectSecurityHeaders(response);
    expect(response.headers.get("Cache-Control")).toBeNull();
    expect(response.headers.get("ETag")).toMatch(/^"[0-9a-f]+-[0-9a-f]+"$/);
    expect(response.headers.get("Last-Modified")).not.toBeNull();
  });

  it("serves a /_next/static/ asset as immutable and still with the security headers", async () => {
    const response = await app.request("/_next/static/chunks/app-3f2a.js");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe(IMMUTABLE);
    expectSecurityHeaders(response);
  });

  it.each([
    ["/", "index.html"],
    ["/cloud/login", "cloud/login/index.html"], // $uri/
    ["/about", "about.html"], // $uri.html
    ["/cloud/index.txt", "cloud/index.txt"], // $uri
    ["/favicon.ico", "favicon.ico"],
  ])("try_files: %s serves %s with 200", async (path, file) => {
    const response = await app.request(path);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(files[file]);
  });

  it.each(["/missing", "/missing/", "/about/", "/_next/static/chunks/gone.js"])(
    "%s answers 404 with 404.html and the security headers",
    async (path) => {
      const response = await app.request(path);
      expect(response.status).toBe(404);
      expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
      expect(await response.text()).toBe(files["404.html"]);
      expect(response.headers.get("Cache-Control")).toBeNull();
      expectSecurityHeaders(response);
    },
  );

  it.each([`/../${secretName}`, `/%2e%2e/${secretName}`, `/..%2f${secretName}`, `/..%5c${secretName}`])(
    "never serves a file outside the export (%s)",
    async (path) => {
      const response = await app.request(path);
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain("secret");
    },
  );

  it("answers HEAD with the headers and no body", async () => {
    const response = await app.request("/cloud/login/", { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toBe(String(files["cloud/login/index.html"].length));
    expectSecurityHeaders(response);
    expect(await response.text()).toBe("");
  });

  it("answers 304 to a matching If-None-Match, keeping the cache headers", async () => {
    const first = await app.request("/_next/static/css/site-9b1c.css");
    const etag = first.headers.get("ETag") ?? "";
    const again = await app.request("/_next/static/css/site-9b1c.css", { headers: { "If-None-Match": etag } });
    expect(again.status).toBe(304);
    expect(again.headers.get("Cache-Control")).toBe(IMMUTABLE);
    expectSecurityHeaders(again);
  });

  it("keeps /api out of the static export", async () => {
    const health = await app.request("/api/health");
    expect(await health.json()).toEqual({ ok: true, db: "up" });
    const unknown = await app.request("/api/nope");
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: { code: "not-found", message: "Not found" } });
  });
});

describe("Content-Security-Policy and HSTS", () => {
  const sha = (text: string) => `'sha256-${createHash("sha256").update(text).digest("base64")}'`;

  it("allows exactly a page's own inline scripts by hash, and scripts from this origin", () => {
    const html = '<script>self.theme="dark"</script><script src="/_next/static/chunks/a.js" async=""></script><script id="_R_">self.__next_f.push([1])</script>';
    const policy = pagePolicy(html);
    expect(policy).toContain(`script-src 'self' ${sha('self.theme="dark"')} ${sha("self.__next_f.push([1])")};`);
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
  });

  it("sends a page its own policy, everything else the API's, and HSTS in production", async () => {
    const page = await app.request("/cloud/login/");
    expect(page.headers.get("Content-Security-Policy")).toBe(pagePolicy(files["cloud/login/index.html"]));
    expect(page.headers.get("Strict-Transport-Security")).toBe(HSTS);
    const chunk = await app.request("/_next/static/chunks/app-3f2a.js");
    expect(chunk.headers.get("Content-Security-Policy")).toBe(API_POLICY);
    const health = await app.request("/api/health");
    expect(health.headers.get("Content-Security-Policy")).toBe(API_POLICY);

    const dev = createApp({ db, mode: "development", appUrl: "http://localhost:3000" });
    expect((await dev.request("/api/health")).headers.get("Strict-Transport-Security")).toBeNull();
  });
});
