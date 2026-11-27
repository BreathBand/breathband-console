// A coach's "Needs a look" rules: one row per coach, once they save their own.
// Until then GET answers null, and the web applies their kind's defaults.

import { eq } from "drizzle-orm";
import { z } from "zod";
import type { AlertRules } from "@/lib/domain/types";
import { canUseCoachData } from "../authz";
import { alertRules } from "../db/schema";
import { fail, jsonObject, type DataApp, type DataDeps } from "./data";

/** The local adapter's limits (saveAlertRules): each number is off (null) or above 0, up to its maximum. */
const upTo = (max: number) => z.number().gt(0).max(max).nullable();

const rulesSchema = z.object({
  missedDays: upTo(60),
  scoreDrop: upTo(9),
  belowTarget: upTo(5),
  trendingDown: z.boolean(),
  rateOutOfRange: z.boolean(),
  practiceBehind: z.boolean(),
});

export function alertRoutes(routes: DataApp, { db }: DataDeps) {
  routes.get("/coaches/:coachId/alert-rules", async (c) => {
    const coachId = c.req.param("coachId");
    if (!canUseCoachData(c.get("uid"), coachId)) fail("permission-denied");
    const [row] = await db.select().from(alertRules).where(eq(alertRules.coachId, coachId));
    if (!row) return c.json(null);
    const { missedDays, scoreDrop, belowTarget, trendingDown, rateOutOfRange, practiceBehind } = row;
    const rules: AlertRules = { missedDays, scoreDrop, belowTarget, trendingDown, rateOutOfRange, practiceBehind };
    return c.json(rules);
  });

  routes.put("/coaches/:coachId/alert-rules", async (c) => {
    const coachId = c.req.param("coachId");
    if (!canUseCoachData(c.get("uid"), coachId)) fail("permission-denied");
    const parsed = rulesSchema.safeParse(await jsonObject(c.req.raw));
    if (!parsed.success) fail("invalid-input", "missedDays up to 60, scoreDrop up to 9, belowTarget up to 5, each above 0 or null; the rest true or false");
    const rules = parsed.data;
    await db
      .insert(alertRules)
      .values({ coachId, ...rules })
      .onConflictDoUpdate({ target: alertRules.coachId, set: { ...rules, updatedAt: new Date() } });
    return c.json({ ok: true });
  });
}
