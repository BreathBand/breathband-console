import type { ReactNode } from "react";

// Line icons from the design directions (24 px grid, square caps, mitred
// joins in the Coach Console style). Decorative: pair them with text.
const PATHS = {
  athletes: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="16.5" cy="9" r="2.6" />
      <path d="M15.5 14.2c2.6-.3 4.6 1.3 5 4.3" />
    </>
  ),
  history: <path d="M4 18h3l3-9 4 12 3-9h3" />,
  share: (
    <>
      <circle cx="7" cy="12" r="2.5" />
      <circle cx="17" cy="6.5" r="2.5" />
      <circle cx="17" cy="17.5" r="2.5" />
      <path d="m9.2 10.8 5.6-3.1M9.2 13.2l5.6 3.1" />
    </>
  ),
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  cloud: <path d="M7 18.5h10.5a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18.5Z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  marker: <path d="M6 21V4M6 4h11l-2.5 4L17 12H6" />,
  pencil: <path d="M4.5 19.5 5.5 15 15.5 5a2.1 2.1 0 0 1 3 3l-10 10-4 1.5Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  lungs: (
    <>
      <path d="M12 4v8M12 10c-1.5 1-3 1.2-4 1M12 10c1.5 1 3 1.2 4 1" />
      <path d="M8.5 7C6 7 4 11 4 16c0 2.5 1.6 3.6 3.5 3.2 1.8-.3 2.5-1.5 2.5-3.5V9c0-1.1-.6-2-1.5-2ZM15.5 7C18 7 20 11 20 16c0 2.5-1.6 3.6-3.5 3.2-1.8-.3-2.5-1.5-2.5-3.5V9c0-1.1.6-2 1.5-2Z" />
    </>
  ),
  signOut: <path d="M10 4.5H5.5v15H10M14 8l4 4-4 4M18 12H9" />,
  refresh: <path d="M19 12a7 7 0 1 1-2.05-4.95M19 4.5V9h-4.5" />,
  dashboard: (
    <>
      <rect x="4" y="4" width="7" height="9" />
      <rect x="13" y="4" width="7" height="5" />
      <rect x="13" y="11" width="7" height="9" />
      <rect x="4" y="15" width="7" height="5" />
    </>
  ),
  plan: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="1" />
      <path d="M9 3.5h6v2.5H9zM8.5 11l1.5 1.5 3-3M8.5 16.5h7" />
    </>
  ),
  comment: <path d="M4.5 5.5h15v10h-8l-4.5 3.5v-3.5h-2.5Z" />,
  kudos: <path d="M12 19.5s-7-4.3-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.2c0 5-7 9.3-7 9.3Z" />,
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
  print: (
    <>
      <path d="M7 9V4h10v5M7 16.5H4.5V9h15v7.5H17" />
      <rect x="7" y="13.5" width="10" height="6.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" />
    </>
  ),
  note: <path d="M6 4.5h12v15H6zM9 9h6M9 12.5h6M9 16h3.5" />,
  trash: <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />,
  group: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
    </>
  ),
  play: <path d="M8 5.5v13l10-6.5Z" />,
  compare: <path d="M4 19.5h16M5 15l4.5-5 4 3L19 6.5M5 11.5l4.5 2 4-4.5L19 12" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" />,
  close: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <path d="m4 4 16 16M9.8 5.8A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.6 7.7A16.4 16.4 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1" />
      <path d="m4 6.5 8 6.5 8-6.5" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 17.5h2" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1" />
      <path d="M9 20h6M12 16.5V20" />
    </>
  ),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5M12 16v.4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      style={{ flex: "none" }}
    >
      {PATHS[name]}
    </svg>
  );
}

/** Placeholder BB monogram until the client sends logo files. */
export function Mark({ size = 26, label = "BreathBand" }: { size?: number; label?: string }) {
  return (
    <svg width={size} height={(size * 22) / 26} viewBox="0 0 26 22" role="img" aria-label={label}>
      <path d="M5 4h5.5a3.5 3.5 0 0 1 0 7H5V4Zm0 7h6.2a3.8 3.8 0 0 1 0 7.6H5V11Z" fill="currentColor" />
      <path
        d="M13 4h5.5a3.5 3.5 0 0 1 0 7H13V4Zm0 7h6.2a3.8 3.8 0 0 1 0 7.6H13V11Z"
        fill="currentColor"
        opacity=".55"
      />
    </svg>
  );
}
