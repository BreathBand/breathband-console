// Serves the static export (`out/`) the way nginx.conf did:
//
//   try_files $uri $uri/ $uri.html =404;   error_page 404 /404.html;
//
// plus immutable caching for /_next/static/ (hashed file names). The security
// headers come from the app-wide middleware, so they are on these responses too;
// an HTML page also gets its own Content-Security-Policy, which allows exactly
// the inline scripts in that page (Next's payload and the theme script) by hash.

import { createHash } from "node:crypto";
import type { Stats } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { Context } from "hono";
import { getMimeType } from "hono/utils/mime";

export const IMMUTABLE = "public, max-age=31536000, immutable";

type Found = { path: string; stats: Stats };

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

/**
 * The policy for one exported page: scripts from this origin plus the page's own
 * inline scripts by sha256, nothing else; styles allow inline (React style
 * attributes); images also data: and blob: (QR codes, downloads); no framing.
 */
export function pagePolicy(html: string): string {
  const hashes = [...html.matchAll(INLINE_SCRIPT)].map((m) => `'sha256-${createHash("sha256").update(m[1]).digest("base64")}'`);
  return [
    "default-src 'self'",
    `script-src 'self' ${[...new Set(hashes)].join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** By path and mtime: a page's policy is worked out once per build. */
const policies = new Map<string, string>();

async function policyFor(file: Found): Promise<string> {
  const key = `${file.path}|${file.stats.mtimeMs}`;
  let policy = policies.get(key);
  if (!policy) {
    policy = pagePolicy(await readFile(file.path, "utf8"));
    policies.set(key, policy);
  }
  return policy;
}

export function serveExport(root: string) {
  const base = resolve(root);

  return async (c: Context): Promise<Response> => {
    const uri = decodePath(new URL(c.req.url).pathname);
    if (uri !== null) {
      for (const candidate of tryFiles(uri)) {
        const found = await findFile(base, candidate);
        if (found) {
          const cacheControl = uri.startsWith("/_next/static/") ? IMMUTABLE : undefined;
          return send(c, found, 200, cacheControl);
        }
      }
    }
    const notFoundPage = await findFile(base, "/404.html");
    if (notFoundPage) return send(c, notFoundPage, 404);
    return c.text("Not Found", 404);
  };
}

/** The candidates nginx tries for `$uri $uri/ $uri.html`, with `index index.html` for folders. */
function tryFiles(uri: string): string[] {
  if (uri.endsWith("/")) return [`${uri}index.html`];
  return [uri, `${uri}/index.html`, `${uri}.html`];
}

function decodePath(pathname: string): string | null {
  try {
    const decoded = decodeURIComponent(pathname);
    return decoded.includes("\0") ? null : decoded;
  } catch {
    return null;
  }
}

async function findFile(base: string, uri: string): Promise<Found | null> {
  const path = resolve(join(base, uri));
  if (path !== base && !path.startsWith(base + sep)) return null;
  try {
    const stats = await stat(path);
    return stats.isFile() ? { path, stats } : null;
  } catch {
    return null;
  }
}

async function send(c: Context, file: Found, status: 200 | 404, cacheControl?: string): Promise<Response> {
  const { stats } = file;
  // nginx's ETag: hex mtime (seconds) and size.
  const etag = `"${Math.floor(stats.mtimeMs / 1000).toString(16)}-${stats.size.toString(16)}"`;
  const lastModified = stats.mtime.toUTCString();
  const headers: Record<string, string> = {
    "Content-Type": getMimeType(file.path) ?? "application/octet-stream",
  };
  if (file.path.endsWith(".html")) headers["Content-Security-Policy"] = await policyFor(file);
  if (status === 200) {
    headers.ETag = etag;
    headers["Last-Modified"] = lastModified;
    if (cacheControl) headers["Cache-Control"] = cacheControl;
    if (isFresh(c, etag, stats)) return c.body(null, 304, headers);
  }
  headers["Content-Length"] = String(stats.size);
  if (c.req.method === "HEAD") return c.body(null, status, headers);
  return c.body(new Uint8Array(await readFile(file.path)), status, headers);
}

function isFresh(c: Context, etag: string, stats: Stats): boolean {
  const ifNoneMatch = c.req.header("If-None-Match");
  if (ifNoneMatch) return ifNoneMatch.split(",").some((tag) => tag.trim() === etag || tag.trim() === "*");
  const ifModifiedSince = c.req.header("If-Modified-Since");
  if (!ifModifiedSince) return false;
  const since = Date.parse(ifModifiedSince);
  return !Number.isNaN(since) && Math.floor(stats.mtimeMs / 1000) * 1000 <= since;
}
