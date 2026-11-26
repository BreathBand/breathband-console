// Invite codes, both ways: an athlete's code for a coach (coaching.ts) and a
// coach's link for an athlete (coach-invites.ts). Codes are 8 characters with
// no look-alikes, as on the local adapter; only a hash is stored.

import { createHash } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** The stored form of an invite code: SHA-256 of the normalised code, hex. */
export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** How a typed code is read: stray spaces and lower case still match. */
export function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

/** 8 characters from `bytes` (8 or more). 32 divides 256, so no bias. */
export function codeFrom(bytes: Uint8Array): string {
  return Array.from(bytes.subarray(0, 8), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** A random code. */
export function inviteCode(): string {
  return codeFrom(crypto.getRandomValues(new Uint8Array(8)));
}

/** A primary-key or unique-index violation from libSQL, as drizzle passes it on (wrapped in `cause`). */
export function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && /^SQLITE_CONSTRAINT_(PRIMARYKEY|UNIQUE)$/.test(code)) return true;
    if (/UNIQUE constraint failed/.test(e.message)) return true;
  }
  return false;
}

/**
 * Inserts with a fresh code until one is free: `insert(attempt)` stores a row
 * whose code depends on the attempt number. A collision is rare (40 bits), so
 * a few tries are plenty; anything but a collision fails at once.
 */
export async function withFreshCode<T>(insert: (attempt: number) => Promise<T>, tries = 5): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await insert(attempt);
    } catch (error) {
      if (attempt + 1 >= tries || !isUniqueViolation(error)) throw error;
    }
  }
}
