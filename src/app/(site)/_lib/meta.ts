import type { Metadata } from "next";

// The public site's address. Until the domain is chosen (PLAN.md D1), set
// NEXT_PUBLIC_SITE_URL at build time so canonical, Open Graph and sitemap
// URLs are absolute and correct.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const OG_IMAGE = {
  url: "/site/og.png",
  width: 1200,
  height: 630,
  alt: "Breathband: the band that scores your breathing. A pacer ring with a breath inside it, and a breathing line in red and blue.",
};

export function pageMeta({
  title,
  description,
  path,
  absoluteTitle,
}: {
  title: string;
  description: string;
  path: string;
  /** Use the title as is, without the "· Breathband" suffix. */
  absoluteTitle?: boolean;
}): Metadata {
  const full = absoluteTitle ? title : `${title} · Breathband`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "Breathband",
      locale: "en",
      url: path,
      title: full,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: full,
      description,
      images: [OG_IMAGE.url],
    },
  };
}

/** The public pages, for the sitemap. */
export const PAGES = ["/", "/coaches/"] as const;

/** Header and footer navigation: anchors on the home page, plus the coaches page. */
export const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#score", label: "The score" },
  { href: "/coaches/", label: "Coaches" },
  { href: "/#faq", label: "FAQ" },
] as const;
