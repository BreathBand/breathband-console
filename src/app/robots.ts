import type { MetadataRoute } from "next";

// Static export: prerendered to /robots.txt at build time. BreathCloud is behind
// a login and also sends noindex; the public site (breathband-site) serves its
// own robots.txt and sitemap.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
