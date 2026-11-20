import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import "./globals.css";

// The Coach Console direction's type: Plex Sans for reading, Plex Sans
// Condensed for labels, metadata and chart text. next/font self-hosts them at
// build time, so the browser never calls Google.
const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const plexCondensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-condensed",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Breathband",
    template: "%s · Breathband",
  },
  description: "Breathband — guided breathing training with a wearable sensor.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plex.variable} ${plexCondensed.variable}`}>
      <body>{children}</body>
    </html>
  );
}
