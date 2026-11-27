// Product events (D15, R1): the signed-in person's, in a batch, from the list
// in src/lib/domain/events.ts. The same checks as the local adapter.

import { eventsProblem, type ProductEvent } from "@/lib/domain/events";
import { productEvents } from "../db/schema";
import { fail, jsonObject, type DataApp, type DataDeps } from "./data";

export function eventRoutes(routes: DataApp, { db }: DataDeps) {
  routes.post("/events", async (c) => {
    const { events } = await jsonObject(c.req.raw);
    const problem = eventsProblem(events as ProductEvent[]);
    if (problem) fail("invalid-input", problem);
    const userId = c.get("uid");
    await db.insert(productEvents).values((events as ProductEvent[]).map((e) => ({ userId, name: e.name, props: e.props ?? null, at: new Date(e.at) })));
    return c.json({ ok: true });
  });
}
