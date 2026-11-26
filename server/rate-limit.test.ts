import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addressKey, clientIp, createRateLimiter, rateLimit } from "./rate-limit";

// T-0129: the API's own rate limiter (Better Auth limits only /api/auth).

const clock = (start = 0) => {
  let t = start;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
};

describe("createRateLimiter", () => {
  it("allows `limit` at once per key, then refuses, saying when to come back", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: time.now });
    expect([1, 2, 3].map(() => limiter.take("a").allowed)).toEqual([true, true, true]);
    expect(limiter.take("a")).toEqual({ allowed: false, remaining: 0, retryAfterMs: 20_000 });
    // Another key has its own bucket.
    expect(limiter.take("b")).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("refills evenly over the window, and a refused request costs nothing", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: time.now });
    for (let i = 0; i < 3; i++) limiter.take("a");
    time.advance(19_999);
    expect(limiter.take("a").allowed).toBe(false);
    time.advance(1);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(false);
    time.advance(60_000);
    expect(limiter.take("a")).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("never allows more than the limit plus what refilled, however the requests are timed", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 30, windowMs: 60_000, now: time.now });
    let allowed = 0;
    // A request every 100 ms for 2 minutes: 30 at first, then one per 2 s.
    for (let i = 0; i < 1200; i++) {
      if (limiter.take("ip").allowed) allowed++;
      time.advance(100);
    }
    expect(allowed).toBeGreaterThanOrEqual(30 + 59);
    expect(allowed).toBeLessThanOrEqual(30 + 60);
  });

  it("keeps at most maxKeys, dropping full buckets first, then the least recently used", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, maxKeys: 3, now: time.now });
    limiter.take("a");
    limiter.take("a");
    limiter.take("b");
    limiter.take("c");
    expect(limiter.size()).toBe(3);
    limiter.take("a"); // refused; "a" is now the most recently used
    limiter.take("d"); // over: "b" goes (least recently used, none full yet)
    expect(limiter.size()).toBe(3);
    expect(limiter.take("a").allowed).toBe(false); // "a" kept its empty bucket
    time.advance(1000); // every bucket full again
    limiter.take("e");
    expect(limiter.size()).toBeLessThanOrEqual(3);
  });

  it("refuses nonsense options", () => {
    expect(() => createRateLimiter({ limit: 0, windowMs: 1000 })).toThrow();
    expect(() => createRateLimiter({ limit: 1, windowMs: 0 })).toThrow();
  });
});

describe("clientIp", () => {
  // T-0133: the socket's address unless TRUSTED_PROXY_HOPS says which X-Forwarded-For entry a proxy wrote.
  const ipOf = async (headers: Record<string, string>, hops?: number, remoteAddress?: string) => {
    const app = new Hono();
    app.get("/", (c) => c.text(clientIp(c, hops)));
    const env = remoteAddress === undefined ? undefined : { incoming: { socket: { remoteAddress } } };
    return (await app.request("/", { headers }, env)).text();
  };
  const forged = { "X-Forwarded-For": "1.2.3.4, 203.0.113.9, 10.0.0.1" };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("with 0 hops (the default) ignores X-Forwarded-For and takes the socket's address", async () => {
    expect(await ipOf(forged, 0, "198.51.100.7")).toBe("198.51.100.7");
    expect(await ipOf({ "X-Forwarded-For": "1.2.3.4" }, undefined, "198.51.100.7")).toBe("198.51.100.7");
    vi.stubEnv("TRUSTED_PROXY_HOPS", "");
    expect(await ipOf(forged, undefined, "198.51.100.7")).toBe("198.51.100.7");
  });

  it("with 1 hop takes the rightmost entry, which the proxy wrote, so a client can't pick its own", async () => {
    expect(await ipOf({ "X-Forwarded-For": "203.0.113.9" }, 1, "10.0.0.1")).toBe("203.0.113.9");
    expect(await ipOf({ "X-Forwarded-For": "1.2.3.4, 203.0.113.9" }, 1, "10.0.0.1")).toBe("203.0.113.9");
    expect(await ipOf(forged, 1, "10.0.0.2")).toBe("10.0.0.1");
  });

  it("with 2 hops takes the second entry from the right", async () => {
    expect(await ipOf(forged, 2, "10.0.0.2")).toBe("203.0.113.9");
    expect(await ipOf({ "X-Forwarded-For": "203.0.113.9, 10.0.0.1" }, 2, "10.0.0.2")).toBe("203.0.113.9");
  });

  it("reads TRUSTED_PROXY_HOPS when no count is passed", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    expect(await ipOf(forged, undefined, "10.0.0.2")).toBe("10.0.0.1");
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    expect(await ipOf(forged, undefined, "10.0.0.2")).toBe("203.0.113.9");
    // A bad value is refused (readEnv refuses it at startup first), never read as "trust the header".
    vi.stubEnv("TRUSTED_PROXY_HOPS", "-1");
    const app = new Hono();
    app.get("/", (c) => c.text(clientIp(c)));
    expect((await app.request("/", { headers: forged }, { incoming: { socket: { remoteAddress: "10.0.0.2" } } })).status).toBe(500);
  });

  it("with fewer entries than the hops, or no header, takes the socket's address (the proxy's: fails closed)", async () => {
    expect(await ipOf({ "X-Forwarded-For": "203.0.113.9" }, 2, "10.0.0.2")).toBe("10.0.0.2");
    expect(await ipOf({}, 1, "10.0.0.2")).toBe("10.0.0.2");
  });

  it("falls back to 'unknown' without a usable header or a socket (one shared bucket: fails closed)", async () => {
    expect(await ipOf({})).toBe("unknown");
    expect(await ipOf({ "X-Forwarded-For": "203.0.113.9" }, 0)).toBe("unknown");
    expect(await ipOf({ "X-Forwarded-For": "203.0.113.9" }, 2)).toBe("unknown");
  });

  it("keys IPv6 clients by their /64, from the socket or the header", async () => {
    expect(await ipOf({}, 0, "2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
    expect(await ipOf({ "X-Forwarded-For": "2001:db8:1:2::9" }, 1, "10.0.0.1")).toBe("2001:db8:1:2::/64");
    expect(await ipOf({}, 0, "::ffff:203.0.113.9")).toBe("203.0.113.9");
  });
});

describe("addressKey", () => {
  it("keeps IPv4 as it is, dropping a port", () => {
    expect(addressKey("203.0.113.9")).toBe("203.0.113.9");
    expect(addressKey("203.0.113.9:51234")).toBe("203.0.113.9");
  });

  it("keys IPv6 by its /64 prefix, however it's written", () => {
    const key = "2001:db8:1:2::/64";
    for (const address of [
      "2001:db8:1:2::1",
      "2001:0db8:0001:0002:ffff:ffff:ffff:ffff",
      "2001:DB8:1:2:0:0:0:7",
      "[2001:db8:1:2::3]:443",
      "2001:db8:1:2::4%eth0",
      "2001:db8:1:2::1.2.3.4",
    ]) {
      expect(addressKey(address), address).toBe(key);
    }
    expect(addressKey("2001:db8:1:3::1")).toBe("2001:db8:1:3::/64");
    expect(addressKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(addressKey("::1")).toBe("0:0:0:0::/64");
  });

  it("reads an IPv4-mapped IPv6 address as its IPv4 address", () => {
    expect(addressKey("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(addressKey("::FFFF:cb00:7109")).toBe("203.0.113.9");
    expect(addressKey("0:0:0:0:0:ffff:203.0.113.9")).toBe("203.0.113.9");
  });

  it("keeps anything that isn't an address as it is", () => {
    expect(addressKey("unknown")).toBe("unknown");
    expect(addressKey("not-an-ip")).toBe("not-an-ip");
  });
});

describe("rateLimit middleware", () => {
  it("answers 429 with the data routes' error shape and Retry-After once a key is out", async () => {
    const app = new Hono();
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    app.get("/x", rateLimit(limiter, (c) => c.req.header("x-key") ?? ""), (c) => c.json({ ok: true }));
    const hit = (key: string) => app.request("/x", { headers: { "x-key": key } });
    expect((await hit("a")).status).toBe(200);
    expect((await hit("a")).status).toBe(200);
    const refused = await hit("a");
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe("30");
    expect(await refused.json()).toEqual({ error: { code: "unavailable", message: "Too many requests. Wait a minute and try again." } });
    expect((await hit("b")).status).toBe(200);
  });
});
