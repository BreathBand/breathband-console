import type { Metadata, Viewport } from "next";
import { Funnel_Display, Funnel_Sans, Geist_Mono } from "next/font/google";
import { SiteFooter, WaitlistBand } from "./_components/SiteFooter";
import { SiteHeader } from "./_components/SiteHeader";
import { SITE_URL } from "./_lib/meta";
import "./site.css";

// The marketing identity ("Carbon & Breath"): Funnel Display for headlines,
// Funnel Sans for text, Geist Mono only for readings (timers, scores, axes,
// status). next/font self-hosts all three at build time.
const display = Funnel_Display({
  variable: "--font-display",
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  display: "swap",
});

const sans = Funnel_Sans({
  variable: "--font-ui",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

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
    <div className={`site ${display.variable} ${sans.variable} ${mono.variable}`}>
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
