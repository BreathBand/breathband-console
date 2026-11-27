import type { Metadata } from "next";
import { DocFrame } from "../docs/DocFrame";
import { PrivacyPolicy } from "../docs/PrivacyPolicy";

export const metadata: Metadata = {
  title: "Privacy policy · BreathCloud",
  description: "What Breathband keeps about you, why, where and for how long, and how to download or delete it.",
};

// /cloud/privacy/ — readable signed in or out (CloudShell's DOC_PATHS).
export default function PrivacyPage() {
  return (
    <DocFrame>
      <PrivacyPolicy />
    </DocFrame>
  );
}
