import { createLocalBackend } from "../local";
import { createSeededDb, memoryStore } from "../local/db";
import { describeAuthContract } from "./auth.contract";

describeAuthContract("local", { confirmsEmail: false, revealsEmailInUse: true }, () => {
  // One store is one browser's localStorage: a reload is a new adapter on the same store.
  const store = memoryStore(createSeededDb());
  const open = () => createLocalBackend({ store, latencyMs: 0 });
  return {
    backend: open(),
    reload: open,
    // The local adapter has no email: accounts are confirmed from the start.
    confirmEmail: async () => {},
  };
});
