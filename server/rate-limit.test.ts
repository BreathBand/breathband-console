import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter, rateLimit } from "./rate-limit";

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
  const ipOf = async (headers: Record<string, string>, hops?: number) => {
    const app = new Hono();
    app.get("/", (c) => c.text(clientIp(c, hops)));
    return (await app.request("/", { headers })).text();
  };

  it("takes the entry the trusted proxy wrote: the rightmost for one hop, so a client can't pick its own", async () => {
    expect(await ipOf({ "X-Forwarded-For": "203.0.113.9" })).toBe("203.0.113.9");
    expect(await ipOf({ "X-Forwarded-For": "1.2.3.4, 203.0.113.9" })).toBe("203.0.113.9");
    expect(await ipOf({ "X-Forwarded-For": "1.2.3.4, 203.0.113.9, 10.0.0.1" }, 2)).toBe("203.0.113.9");
  });

  it("falls back to 'unknown' without the header or a socket (one shared bucket: fails closed)", async () => {
    expect(await ipOf({})).toBe("unknown");
    expect(await ipOf({ "X-Forwarded-For": "203.0.113.9" }, 2)).toBe("unknown");
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
