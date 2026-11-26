// Rate limits for the API's own routes. Better Auth limits /api/auth itself
// (server/auth.ts); nothing else had one. First used by the public invite
// lookup (T-0129), and meant to be reused (the waitlist is the next candidate).
//
// Caveats, as for Better Auth's limiter (T-0111, parked): the buckets are in
// memory, so they reset on restart and each API instance keeps its own (two
// Cloud Run instances allow twice the limit). The client's address is the
// socket's unless TRUSTED_PROXY_HOPS says which proxy's X-Forwarded-For entry
// to believe (T-0133; see `clientIp`).

import { isIPv4, isIPv6 } from "node:net";
import type { Context, Env, MiddlewareHandler } from "hono";
import { trustedProxyHops } from "./env";

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
 * The client's address, as a rate-limit key (see `addressKey`).
 *
 * `trustedHops` is how many proxies in front of the API append to
 * X-Forwarded-For: TRUSTED_PROXY_HOPS, 0 unless set (server/env.ts). With 0 the
 * header is ignored and the socket's address is used, since with no proxy a
 * client writes that header itself and could pick a new bucket per request.
 * With N > 0, the Nth entry from the right: the one the outermost trusted
 * proxy wrote, which no client can forge (anything left of it may be).
 *
 * With fewer entries than N, or no header, the socket's address (then the
 * proxy's own: one bucket, which fails closed); with no socket either,
 * "unknown" (one bucket for everyone, likewise).
 *
 * N must match the deployment (I-16): too low and every client shares the
 * proxy's bucket; too high and a client picks its own.
 */
export function clientIp(c: Context, trustedHops: number = trustedProxyHops()): string {
  if (trustedHops > 0) {
    const forwarded = (c.req.header("x-forwarded-for") ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (forwarded.length >= trustedHops) return addressKey(forwarded[forwarded.length - trustedHops]);
  }
  const socket = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket?.remoteAddress;
  return socket ? addressKey(socket) : "unknown";
}

/** The one rate-limit key every unparseable address shares (see `addressKey`). */
export const INVALID_ADDRESS_KEY = "invalid";

/**
 * One bucket per client: an IPv4 address as it is; an IPv6 address by its /64
 * prefix (one subscriber's network, whose addresses it can rotate freely),
 * written `2001:db8:1:2::/64`; an IPv4-mapped IPv6 address (`::ffff:1.2.3.4`,
 * which Node reports for IPv4 clients on a dual-stack socket) as its IPv4
 * address. Brackets, a zone (`%eth0`) and a port on an IPv4 address are
 * dropped. Anything else shares the one key `INVALID_ADDRESS_KEY` (T-0135):
 * kept as it was, every new garbage string would get a fresh bucket.
 */
export function addressKey(address: string): string {
  let a = address.trim();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(a);
  if (bracketed) a = bracketed[1];
  const v4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(a);
  if (v4WithPort) a = v4WithPort[1];
  if (isIPv4(a)) return a;
  a = a.replace(/%.*$/, "");
  if (!isIPv6(a)) return INVALID_ADDRESS_KEY;
  const groups = ipv6Groups(a);
  const mapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (mapped) return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
  return `${groups.slice(0, 4).map((g) => g.toString(16)).join(":")}::/64`;
}

/** The eight 16-bit groups of a valid IPv6 address (with `::` expanded and a dotted IPv4 tail converted). */
function ipv6Groups(address: string): number[] {
  let a = address.toLowerCase();
  const tail = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(a);
  if (tail) {
    const [b0, b1, b2, b3] = tail.slice(1).map(Number);
    a = `${a.slice(0, tail.index)}${((b0 << 8) | b1).toString(16)}:${((b2 << 8) | b3).toString(16)}`;
  }
  const [head, rest] = a.split("::");
  const left = head ? head.split(":") : [];
  const right = rest ? rest.split(":") : [];
  const zeros = rest === undefined ? [] : Array<string>(8 - left.length - right.length).fill("0");
  return [...left, ...zeros, ...right].map((g) => parseInt(g, 16));
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
