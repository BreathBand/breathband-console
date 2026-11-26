// The public site's waitlist: anyone, signed in or not, leaves an email address
// once. The answer is the same whether or not the address was already there.

import { waitlist } from "../db/schema";
import { fail, jsonObject, type DataApp, type DataDeps } from "./data";

/** firestore.rules (waitlist create): the local adapter's email pattern, 254 characters, a source of up to 32. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MAX_SOURCE = 32;

export function waitlistRoutes(routes: DataApp, { db }: DataDeps) {
  routes.post("/waitlist", async (c) => {
    const { email, source } = await jsonObject(c.req.raw);
    const address = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (address.length > MAX_EMAIL || !EMAIL.test(address)) fail("invalid-email", "Enter a valid email address.");
    if (typeof source !== "string" || source.length > MAX_SOURCE) fail("invalid-input", `source: text, up to ${MAX_SOURCE} characters`);
    await db.insert(waitlist).values({ email: address, source }).onConflictDoNothing({ target: waitlist.email });
    return c.json({ ok: true });
  });
}
