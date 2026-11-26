// /api/auth/*: Better Auth's own handler (sign up, sign in, sign out, session,
// verify email, password reset). Its rate limiter runs inside the handler; the
// sign-in rule is SIGN_IN_RATE_LIMIT in server/auth.ts.

import { Hono } from "hono";
import type { Auth } from "../auth";

export function authRoutes(auth: Auth) {
  const routes = new Hono();
  routes.on(["GET", "POST"], "/*", (c) => auth.handler(c.req.raw));
  return routes;
}
