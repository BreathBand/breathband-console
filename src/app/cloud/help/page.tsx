import type { Metadata } from "next";
import { DocFrame } from "../docs/DocFrame";
import { HelpCentre } from "../docs/HelpCentre";

export const metadata: Metadata = {
  title: "Help · BreathCloud",
  description: "Wearing and pairing the Breathband, calibrating, your scores, sharing, and a guide for professionals.",
};

// /cloud/help/ — readable signed in or out (CloudShell's DOC_PATHS).
export default function HelpPage() {
  return (
    <DocFrame>
      <HelpCentre />
    </DocFrame>
  );
}
