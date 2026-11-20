import type { MetadataRoute } from "next";
import { PAGES, SITE_URL } from "./(site)/_lib/meta";

// Static export: prerendered to /sitemap.xml at build time. Public pages only;
// /cloud/ stays out.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
