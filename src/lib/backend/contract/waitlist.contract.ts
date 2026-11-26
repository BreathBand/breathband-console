import { describe, it } from "vitest";
import type { DataContractHarness } from "./data.harness";
import { refusal } from "./data.harness";

// The waitlist section of the shared adapter suite: the public site's sign-up,
// open to anyone signed in or not. Run by contract/data.local.test.ts and
// http/data.http.test.ts; the http side also checks what gets stored.

export function describeWaitlistContract(adapter: string, setup: () => DataContractHarness | Promise<DataContractHarness>) {
  describe(`DataService contract, waitlist: ${adapter}`, () => {
    it("takes an email address from anyone, and the same one again in any case without complaint", async () => {
      const h = await setup();
      const visitor = h.signedOut().data;
      const email = `fan-${Date.now()}@example.test`;
      await visitor.joinWaitlist({ email, source: "hero" });
      await visitor.joinWaitlist({ email: `  ${email.toUpperCase()} `, source: "footer" });
      await (await h.person()).backend.data.joinWaitlist({ email: `other-${email}`, source: "footer" });
    });

    it.each(["nope", "", "two words@example.test", "a@b"])("refuses %j as an email address", async (email) => {
      const h = await setup();
      await refusal(h.signedOut().data.joinWaitlist({ email, source: "hero" }), "invalid-email");
    });
  });
}
