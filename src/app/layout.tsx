import type { Metadata } from "next";
import { Funnel_Display, Funnel_Sans, Geist_Mono } from "next/font/google";
import { THEME_KEY } from "@/lib/theme";
import "./globals.css";

// One type system for the site and BreathCloud: Funnel Display for headlines
// and headline numbers, Funnel Sans for everything you read, Geist Mono only for
// live readings. next/font self-hosts them at build time, so the browser never
// calls Google.
const display = Funnel_Display({
  variable: "--font-display",
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

const sans = Funnel_Sans({
  variable: "--font-ui",
  weight: ["400", "500", "600", "700"],
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
  title: {
    default: "Breathband",
    template: "%s · Breathband",
  },
  description: "Breathband — guided breathing training with a wearable sensor.",
};

// Applies a theme chosen on the account page before the first paint, so a dark
// choice never flashes light. Without a choice the system preference applies.
const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
