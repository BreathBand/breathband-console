import type { Metadata } from "next";
import { BackendProvider } from "@/lib/backend/BackendProvider";
import { CloudShell } from "./CloudShell";
import "./console.css";

export const metadata: Metadata = {
  title: "BreathCloud",
  // The console is behind a login; keep it out of search results.
  robots: { index: false, follow: false },
};

export default function CloudLayout({ children }: LayoutProps<"/cloud">) {
  return (
    <BackendProvider>
      <CloudShell>{children}</CloudShell>
    </BackendProvider>
  );
}
