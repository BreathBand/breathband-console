import { createLocalBackend } from "../local";
import { createSeededDb, type DbStore, type LocalDb } from "../local/db";
import type { DataContractHarness } from "./data.harness";
import { signUpInput } from "./data.harness";
import { describeProfileContract } from "./profile.contract";
import { describeSessionsContract } from "./sessions.contract";

/**
 * One set of data, many browsers: each store sees the shared data with its own
 * `currentUid`, the way each person's browser has its own session.
 */
function localHarness(): DataContractHarness {
  let shared: LocalDb = createSeededDb();
  const browser = (): DbStore => {
    let currentUid: string | null = null;
    return {
      read: () => ({ ...shared, currentUid }),
      write: (next) => {
        currentUid = next.currentUid;
        shared = { ...next, currentUid: null };
      },
    };
  };
  const open = () => createLocalBackend({ store: browser(), latencyMs: 0 });

  return {
    async person(role = "athlete") {
      const backend = open();
      const input = signUpInput(role);
      const user = await backend.auth.signUp(input);
      return { uid: user.uid, email: user.email, birthYear: input.birthYear, backend };
    },
    signedOut: open,
    async link(coachId, athleteId, scope) {
      const others = shared.coachLinks.filter((l) => !(l.coachId === coachId && l.athleteId === athleteId));
      const link = { coachId, athleteId, scope: scope!, createdAt: new Date().toISOString(), targets: null };
      shared = { ...shared, coachLinks: scope ? [...others, link] : others };
    },
  };
}

describeProfileContract("local", localHarness);
describeSessionsContract("local", localHarness);
