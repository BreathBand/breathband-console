import type { Metadata } from "next";
import { DocFrame } from "../docs/DocFrame";
import { Terms } from "../docs/Terms";

export const metadata: Metadata = {
  title: "Terms of use · BreathCloud",
  description: "The terms for using Breathband and BreathCloud, with a section for coaches, clinicians and educators.",
};

// /cloud/terms/ — readable signed in or out (CloudShell's DOC_PATHS).
export default function TermsPage() {
  return (
    <DocFrame>
      <Terms />
    </DocFrame>
  );
}
