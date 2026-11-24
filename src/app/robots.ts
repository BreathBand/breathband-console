import type { MetadataRoute } from "next";
import { SITE_URL } from "./(site)/_lib/meta";

// Static export: prerendered to /robots.txt at build time.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The console is behind a login and also sends noindex.
      disallow: "/cloud/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
