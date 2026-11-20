import Link from "next/link";
import { Mark } from "@/components/Icon";

/** "Breathband® BreathCloud" lockup for the signed-out header; links to the BreathCloud landing page. */
export function Brand() {
  return (
    <Link href="/cloud/" className="bc-brand">
      <span aria-hidden="true" className="bc-brand-mark">
        <Mark />
      </span>
      <span>
        <span className="bc-brand-maker">
          Breathband<sup>®</sup>{" "}
        </span>
        <span className="bc-brand-product">BreathCloud</span>
      </span>
    </Link>
  );
}
