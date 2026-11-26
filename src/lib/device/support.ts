import type { BluetoothSupport } from "./bluetooth";

/** The browsers whose Web Bluetooth story differs, read from the user agent. */
export type BrowserFamily = "chromium" | "firefox" | "safari" | "ios" | "other";

/** What the page can see about Web Bluetooth. Read once from the browser, or built by hand in tests. */
export interface SupportEnv {
  isSecureContext: boolean;
  /** `navigator.bluetooth` exists. */
  hasBluetooth: boolean;
  userAgent: string;
}

export interface BandSupport {
  bluetooth: BluetoothSupport;
  browser: BrowserFamily;
}

/** What to tell the person when the band can't connect from this browser. */
export interface SupportAdvice {
  title: string;
  detail: string;
}

/** iOS first: every iPhone and iPad browser (Chrome and Edge too) is WebKit, without Web Bluetooth. */
export function browserFamily(userAgent: string): BrowserFamily {
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  if (/Firefox\/|FxiOS/.test(userAgent)) return "firefox";
  if (/Edg\/|Chrome\/|Chromium\/|OPR\//.test(userAgent)) return "chromium";
  if (/Safari\//.test(userAgent)) return "safari";
  return "other";
}

/**
 * Whether the band can connect from here. Web Bluetooth needs Chrome, Edge or
 * Opera on a computer or Android, on a secure page (HTTPS or localhost); the
 * browser hides the API on insecure pages, so an insecure page is reported as
 * such whatever the browser.
 */
export function detectSupport(env: SupportEnv | null): BandSupport {
  if (!env) return { bluetooth: "unsupported", browser: "other" };
  const browser = browserFamily(env.userAgent);
  if (!env.isSecureContext) return { bluetooth: "insecure", browser };
  return { bluetooth: env.hasBluetooth ? "supported" : "unsupported", browser };
}

/** The browser's side of detectSupport; null outside a browser. */
export function readSupportEnv(): SupportEnv | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null;
  return {
    isSecureContext: window.isSecureContext,
    hasBluetooth: "bluetooth" in navigator && Boolean((navigator as Navigator & { bluetooth?: unknown }).bluetooth),
    userAgent: navigator.userAgent,
  };
}

const NEEDS = "Connecting the band needs Chrome or Edge on a computer or an Android phone.";

/** Plain words for what to do instead, or null when the band can connect from here. */
export function supportAdvice(support: BandSupport): SupportAdvice | null {
  if (support.bluetooth === "supported") return null;
  if (support.bluetooth === "insecure") {
    return {
      title: "This page isn't on a secure connection.",
      detail: "Browsers only allow Bluetooth on secure pages. Open BreathCloud from its https:// address in Chrome or Edge.",
    };
  }
  const why: Record<BrowserFamily, string> = {
    ios: "iPhone and iPad browsers don't let websites use Bluetooth.",
    firefox: "Firefox doesn't let websites use Bluetooth.",
    safari: "Safari doesn't let websites use Bluetooth.",
    chromium: "Bluetooth is turned off for websites in this browser.",
    other: "This browser doesn't let websites use Bluetooth.",
  };
  return { title: why[support.browser], detail: NEEDS };
}

let cached: BandSupport | null = null;

/**
 * This browser's support, read once (it can't change while the page is open)
 * so it can be a `useSyncExternalStore` snapshot.
 */
export function currentSupport(): BandSupport {
  cached ??= detectSupport(readSupportEnv());
  return cached;
}

/** The server render's snapshot: nothing is known yet. */
export const UNKNOWN_SUPPORT: BandSupport = { bluetooth: "unsupported", browser: "other" };
