// Serves the static export (`out/`) the way nginx.conf did:
//
//   try_files $uri $uri/ $uri.html =404;   error_page 404 /404.html;
//
// plus immutable caching for /_next/static/ (hashed file names). The security
// headers come from the app-wide middleware, so they are on these responses too.

import type { Stats } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { Context } from "hono";
import { getMimeType } from "hono/utils/mime";

export const IMMUTABLE = "public, max-age=31536000, immutable";

type Found = { path: string; stats: Stats };

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
