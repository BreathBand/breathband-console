"use client";

import type { ReactNode } from "react";
import { useElementWidth } from "@/lib/useElementWidth";

/** Renders `children(width)` once the box has been measured; holds the height until then. */
export function Measured({ height, children }: { height: number; children: (width: number) => ReactNode }) {
  const [width, ref] = useElementWidth();
  return <div ref={ref}>{width > 0 ? children(width) : <div style={{ height }} />}</div>;
}
