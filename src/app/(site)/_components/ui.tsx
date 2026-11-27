import type { ReactNode } from "react";

/**
 * The Breathband BB monogram, drawn in currentColor through the logo's alpha
 * mask (`public/brand/bb-mark.png`). Decorative: the wordmark beside it names it.
 */
export function Mark({ size = 24 }: { size?: number }) {
  return <span aria-hidden="true" className="s-mark" style={{ width: size, height: size }} />;
}

export function Wordmark() {
  return (
    <span className="s-wordmark">
      Breathband<sup>®</sup>
    </span>
  );
}

export function ArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="s-arrow">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Check({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="m3 8.5 3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** ▲ for breathing in, ▼ for breathing out: the shape cue that travels with the colour. */
export function Tri({ up, size = 10 }: { up: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" focusable="false" className="s-tri">
      <path d={up ? "M7 2 13 12H1Z" : "M7 12 1 2h12Z"} fill="currentColor" />
    </svg>
  );
}

/** An app screenshot (780 × 1688 render) in a phone frame. */
export function Phone({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="s-phone">
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, pre-sized WebP */}
      <img src={src} alt={alt} width={780} height={1688} loading={priority ? "eager" : "lazy"} decoding="async" />
    </div>
  );
}

/** A BreathCloud capture in a plain window frame, labelled as demo data. */
export function Window({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="s-window">
      <div className="s-window-bar" aria-hidden="true">
        <span className="s-window-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="s-window-label">{label}</span>
        <span className="s-window-demo">Demo data</span>
      </div>
      {children}
    </figure>
  );
}

/** A plain <img> for pre-sized WebP captures (static export, no optimiser). */
export function Shot({
  src,
  alt,
  width,
  height,
  priority,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Above the fold: load at once instead of lazily. */
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export, pre-sized WebP
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
    />
  );
}
