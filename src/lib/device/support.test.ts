import { describe, expect, it } from "vitest";
import { browserFamily, detectSupport, supportAdvice, type SupportEnv } from "./support";

const UA = {
  chromeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  chromeIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  safariIpad: "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
};

const env = (over: Partial<SupportEnv> = {}): SupportEnv => ({ isSecureContext: true, hasBluetooth: true, userAgent: UA.chromeWindows, ...over });

describe("browserFamily", () => {
  it("tells the browsers apart that matter for Web Bluetooth", () => {
    expect(browserFamily(UA.chromeWindows)).toBe("chromium");
    expect(browserFamily(UA.edge)).toBe("chromium");
    expect(browserFamily(UA.chromeAndroid)).toBe("chromium");
    expect(browserFamily(UA.firefox)).toBe("firefox");
    expect(browserFamily(UA.safariMac)).toBe("safari");
    expect(browserFamily("curl/8.4.0")).toBe("other");
  });

  it("puts every iPhone and iPad browser under iOS, Chrome included", () => {
    expect(browserFamily(UA.chromeIphone)).toBe("ios");
    expect(browserFamily(UA.safariIpad)).toBe("ios");
  });
});

describe("detectSupport", () => {
  it("Bluetooth available: a secure page in Chrome or Edge", () => {
    expect(detectSupport(env())).toEqual({ bluetooth: "supported", browser: "chromium" });
    expect(detectSupport(env({ userAgent: UA.edge }))).toEqual({ bluetooth: "supported", browser: "chromium" });
  });

  it("Bluetooth not available: no navigator.bluetooth", () => {
    expect(detectSupport(env({ hasBluetooth: false, userAgent: UA.firefox }))).toEqual({ bluetooth: "unsupported", browser: "firefox" });
    expect(detectSupport(env({ hasBluetooth: false, userAgent: UA.safariMac }))).toEqual({ bluetooth: "unsupported", browser: "safari" });
    expect(detectSupport(env({ hasBluetooth: false, userAgent: UA.chromeIphone }))).toEqual({ bluetooth: "unsupported", browser: "ios" });
  });

  it("insecure context: reported as such whatever the browser offers", () => {
    expect(detectSupport(env({ isSecureContext: false }))).toEqual({ bluetooth: "insecure", browser: "chromium" });
    expect(detectSupport(env({ isSecureContext: false, hasBluetooth: false }))).toEqual({ bluetooth: "insecure", browser: "chromium" });
  });

  it("outside a browser, nothing is supported", () => {
    expect(detectSupport(null)).toEqual({ bluetooth: "unsupported", browser: "other" });
  });
});

describe("supportAdvice", () => {
  it("says nothing when the band can connect", () => {
    expect(supportAdvice({ bluetooth: "supported", browser: "chromium" })).toBeNull();
  });

  it("names the browser's problem and what works instead", () => {
    for (const browser of ["firefox", "safari", "ios", "other", "chromium"] as const) {
      const advice = supportAdvice({ bluetooth: "unsupported", browser });
      expect(advice?.detail).toBe("Connecting the band needs Chrome or Edge on a computer or an Android phone.");
    }
    expect(supportAdvice({ bluetooth: "unsupported", browser: "ios" })?.title).toMatch(/iPhone and iPad/);
    expect(supportAdvice({ bluetooth: "unsupported", browser: "firefox" })?.title).toMatch(/Firefox/);
    expect(supportAdvice({ bluetooth: "unsupported", browser: "safari" })?.title).toMatch(/Safari/);
  });

  it("asks for a secure page when the context is insecure", () => {
    const advice = supportAdvice({ bluetooth: "insecure", browser: "chromium" });
    expect(advice?.title).toMatch(/secure connection/);
    expect(advice?.detail).toMatch(/https:\/\//);
  });
});
