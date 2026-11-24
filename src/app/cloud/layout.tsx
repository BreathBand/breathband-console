import type { Metadata } from "next";
import { BackendProvider } from "@/lib/backend/BackendProvider";
import { DeviceProvider } from "@/lib/device/DeviceProvider";
import { CloudShell } from "./CloudShell";
import "./console.css";
import "./shell.css";
import "./product.css";
import "./home.css";
import "./sessions.css";
import "./welcome/welcome.css";
import "./settings/settings.css";
import "./record/record.css";
import "./session/review.css";

export const metadata: Metadata = {
  title: "BreathCloud",
  // The console is behind a login; keep it out of search results.
  robots: { index: false, follow: false },
};

export default function CloudLayout({ children }: LayoutProps<"/cloud">) {
  return (
    <BackendProvider>
      <DeviceProvider>
        <CloudShell>{children}</CloudShell>
      </DeviceProvider>
    </BackendProvider>
  );
}
