import type { Metadata, Viewport } from "next";
import { SiteFooter, WaitlistBand } from "./_components/SiteFooter";
import { SiteHeader } from "./_components/SiteHeader";
import { SITE_URL } from "./_lib/meta";
import "./site.css";

// The marketing surface of "Carbon & Breath". Its fonts (Funnel Display, Funnel
// Sans, Geist Mono) are loaded once in the root layout and shared with BreathCloud.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
};

export const viewport: Viewport = {
  themeColor: "#121110",
  colorScheme: "dark",
};

// Everything the public site renders sits inside `.site`, so its styles never
// reach /cloud (which has its own layout and stylesheet).
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <a href="#main" className="s-skip">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <WaitlistBand />
      <SiteFooter />
    </div>
  );
}
