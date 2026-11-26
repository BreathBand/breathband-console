import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Don't read .env files: .env.local can hold real database credentials.
  envDir: false,
  test: {
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
    setupFiles: ["./server/db/test-setup.ts"],
  },
});
