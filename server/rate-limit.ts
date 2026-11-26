// Rate limits for the API's own routes. Better Auth limits /api/auth itself
// (server/auth.ts); nothing else had one. First used by the public invite
// lookup (T-0129), and meant to be reused (the waitlist is the next candidate).
//
// Caveats, as for Better Auth's limiter (T-0111, parked): the buckets are in
// memory, so they reset on restart and each API instance keeps its own (two
// Cloud Run instances allow twice the limit); and the client's address comes
// from X-Forwarded-For, which is only as good as the proxy that writes it (see
// `clientIp`).

import type { Context, Env, MiddlewareHandler } from "hono";

export interface RateLimitOptions {
  /** Requests a key may make at once, and per window on average. */
  limit: number;
  windowMs: number;
  /** Keys kept at most; past it, full buckets go first, then the least recently used. */
  maxKeys?: number;
  now?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests left right now. */
  remaining: number;
  /** When refused, how long until the next request would be allowed. 0 when allowed. */
  retryAfterMs: number;
}

export interface RateLimiter {
  /** Counts one request for `key`, and says whether it may go ahead. A refused request costs nothing. */
  take(key: string): RateLimitResult;
  /** How many keys are being tracked. */
  size(): number;
}

const DEFAULT_MAX_KEYS = 10_000;

/**
 * A token bucket per key: `limit` tokens, refilled evenly over `windowMs`.
 * Unlike a fixed window there's no burst of twice the limit across a window's
 * edge: over any window a key gets at most `limit` plus what refilled in it.
 */
export function createRateLimiter({ limit, windowMs, maxKeys = DEFAULT_MAX_KEYS, now = Date.now }: RateLimitOptions): RateLimiter {
  if (!(limit >= 1) || !(windowMs > 0) || !(maxKeys >= 1)) throw new Error("rate limit: limit, windowMs and maxKeys must be positive");
  const perMs = limit / windowMs;
  const buckets = new Map<string, { tokens: number; at: number }>();

  const level = (b: { tokens: number; at: number }, t: number) => Math.min(limit, b.tokens + (t - b.at) * perMs);

  function makeRoom(t: number) {
    if (buckets.size < maxKeys) return;
    for (const [key, b] of buckets) if (level(b, t) >= limit) buckets.delete(key);
    // Still full: drop the least recently used (a Map iterates in insertion order; `take` re-inserts).
    for (const key of buckets.keys()) {
      if (buckets.size < maxKeys) break;
      buckets.delete(key);
    }
  }

  return {
    take(key) {
      const t = now();
      const existing = buckets.get(key);
      if (existing) buckets.delete(key);
      else makeRoom(t);
      const tokens = existing ? level(existing, t) : limit;
      const allowed = tokens >= 1;
      const left = allowed ? tokens - 1 : tokens;
      buckets.set(key, { tokens: left, at: t });
      return { allowed, remaining: Math.floor(left), retryAfterMs: allowed ? 0 : Math.ceil((1 - left) / perMs) };
    },
    size: () => buckets.size,
  };
}

/**
 * The client's address. Behind a proxy that appends the address it saw to
 * X-Forwarded-For (Cloud Run's front end does), the entry `trustedHops` from
 * the right is the one no client can forge; anything left of it may be. With
 * no X-Forwarded-For (or fewer entries than `trustedHops`), the socket's address; failing that, "unknown" (one
 * bucket for everyone, which fails closed rather than open).
 *
 * `trustedHops` must match the deployment: 1 for Cloud Run alone, 2 behind a
 * load balancer as well (I-16, parked on T-0111 and T-0129). Too few, and
 * every client shares the proxy's bucket; with no proxy at all, a client can
 * write the header itself and pick its own bucket.
 */
export function clientIp(c: Context, trustedHops = 1): string {
  const forwarded = (c.req.header("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (trustedHops > 0 && forwarded.length >= trustedHops) return forwarded[forwarded.length - trustedHops];
  const socket = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket?.remoteAddress;
  return socket || "unknown";
}

/**
 * Middleware: refuses with 429 once `keyOf`'s bucket is empty, answering as
 * the data routes do (`{ error: { code, message } }`; "unavailable", which the
 * http adapter already knows) with Retry-After in seconds. Requests are
 * counted before the route runs, whatever it answers, so a guess that misses
 * costs as much as one that hits.
 */
export function rateLimit<E extends Env = Env>(limiter: RateLimiter, keyOf: (c: Context<E>) => string): MiddlewareHandler<E> {
  return async (c, next) => {
    const result = limiter.take(keyOf(c));
    if (!result.allowed) {
      c.header("Retry-After", String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))));
      return c.json({ error: { code: "unavailable", message: "Too many requests. Wait a minute and try again." } }, 429);
    }
    await next();
  };
}
