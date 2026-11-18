import type { NextConfig } from "next";

// Static export: `next build` writes plain HTML/CSS/JS to `out/`, which any
// static host can serve — Firebase Hosting, a Cloud Storage bucket, or the
// nginx container in `Dockerfile` (Cloud Run). The browser talks to the
// backend directly (see src/lib/backend), so no Node server is needed.
//
// Constraints this implies (see docs/PLAN.md, "Static export rules"):
// no server actions, no route handlers that read the request, no proxy,
// no dynamic `[id]` routes without generateStaticParams — use `?id=` query
// strings for per-record pages instead.
//
// cacheComponents / partialPrefetching (create-next-app defaults) are off:
// they optimise server rendering, which a static export doesn't have.
const nextConfig: NextConfig = {
  output: "export",
  // `/cloud/login` is emitted as `/cloud/login/index.html`, which every
  // static host resolves without rewrite rules.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
