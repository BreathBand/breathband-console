"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useBackend } from "@/lib/backend/BackendProvider";

type State = "idle" | "saving" | "done" | "error";

/** "Tell me when bands are available": the waitlist, for someone signed in without a band. */
export function Waitlist({ email }: { email: string }) {
  const backend = useBackend();
  const [state, setState] = useState<State>("idle");

  async function join() {
    setState("saving");
    try {
      await backend.data.joinWaitlist({ email, source: "onboarding-band" });
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="welcome-waitlist">
      <p>No band yet? We&rsquo;ll email you when you can get one.</p>
      {state === "done" ? (
        <p role="status">
          <Icon name="check" size={16} /> You&rsquo;re on the list. We&rsquo;ll write to {email}.
        </p>
      ) : (
        <button type="button" className="button" data-variant="ghost" disabled={state === "saving"} onClick={() => void join()}>
          <Icon name="mail" size={18} />
          {state === "saving" ? "Adding you…" : "Tell me when bands are available"}
        </button>
      )}
      {state === "error" && (
        <p className="error" role="alert">
          Couldn&rsquo;t add you to the list. Try again.
        </p>
      )}
    </div>
  );
}
