import type { Backend } from "@/lib/backend";
import type { EventProps, ProductEventName } from "@/lib/domain/events";

/**
 * Records a product event (D15, R1) and forgets it: an event that can't be sent
 * (signed out, offline, refused) never gets in the person's way.
 */
export function track(backend: Backend, name: ProductEventName, props?: EventProps): void {
  void backend.data.trackEvents([{ name, ...(props ? { props } : {}), at: new Date().toISOString() }]).catch(() => undefined);
}
