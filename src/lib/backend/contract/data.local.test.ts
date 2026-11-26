import { createLocalBackend } from "../local";
import { createSeededDb, type DbStore, type LocalDb } from "../local/db";
import { describeCoachToolsContract } from "./coach-tools.contract";
import { describeCoachingContract } from "./coaching.contract";
import type { DataContractHarness, Person } from "./data.harness";
import { linkThroughInvites, signUpInput } from "./data.harness";
import { describeGroupContract } from "./group.contract";
import { describeMoodContract } from "./mood.contract";
import { describeProfileContract } from "./profile.contract";
import { describeSessionsContract } from "./sessions.contract";
import { describeWaitlistContract } from "./waitlist.contract";

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
  const people = new Map<string, Person>();

  return {
    async person(role = "athlete") {
      const backend = open();
      const input = signUpInput(role);
      const user = await backend.auth.signUp(input);
      const person = { uid: user.uid, email: user.email, birthYear: input.birthYear, backend };
      people.set(user.uid, person);
      return person;
    },
    signedOut: open,
    link: linkThroughInvites(people),
    // The local adapter has no route besides DataService that changes an account.
    updateAccount: async () => "refused",
  };
}

describeProfileContract("local", localHarness);
describeSessionsContract("local", localHarness);
describeMoodContract("local", localHarness);
describeCoachingContract("local", localHarness);
describeCoachToolsContract("local", localHarness);
describeGroupContract("local", localHarness);
describeWaitlistContract("local", localHarness);
