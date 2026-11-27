import type { Metadata } from "next";
import { AccessibilityStatement } from "../docs/AccessibilityStatement";
import { DocFrame } from "../docs/DocFrame";

export const metadata: Metadata = {
  title: "Accessibility statement · BreathCloud",
  description: "How accessible BreathCloud is, the known gaps, and how to report a problem.",
};

// /cloud/accessibility/ — readable signed in or out (CloudShell's DOC_PATHS).
export default function AccessibilityPage() {
  return (
    <DocFrame>
      <AccessibilityStatement />
    </DocFrame>
  );
}
