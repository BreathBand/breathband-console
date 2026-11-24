"use client";

import { useEffect, useState } from "react";

/**
 * Width of an element in CSS pixels, kept up to date as it resizes. Charts
 * draw at their real width so text and strokes aren't scaled.
 *
 *   const [width, ref] = useElementWidth();
 *   <div ref={ref}>{width > 0 && <Chart width={width} />}</div>
 */
export function useElementWidth(): [number, (el: HTMLElement | null) => void] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);

  return [width, setEl];
}
